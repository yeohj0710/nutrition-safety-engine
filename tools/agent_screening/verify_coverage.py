# -*- coding: utf-8 -*-
"""배치 판정의 스키마·정확한 1회 반환·전역 커버리지를 확인하고 append한다."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import make_batches


ROOT = make_batches.ROOT
CHECKPOINT = make_batches.CHECKPOINT
AUDIT = ROOT / "research" / "screening" / "agent_local_runs.jsonl"
REQUIRED_KEYS = {
    "record_id", "question_id", "decision", "reason_codes", "confidence", "status"
}
DECISIONS = {"retain", "deprioritize", "uncertain"}
REASON_CODES = {
    "population", "exposure", "outcome", "human_signal", "design_signal",
    "animal_term_present", "off_topic", "insufficient_abstract",
}
CONFIDENCE = {"high", "medium", "low"}


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise SystemExit(f"{path} {line_number}행 JSON 오류: {exc}") from exc
    return rows


def validate_batch_results(batch: dict, results: list[dict]) -> list[dict]:
    rows = batch.get("rows")
    if not isinstance(rows, list) or not rows:
        raise SystemExit("배치 rows가 비어 있습니다.")
    if make_batches.canonical_rows_sha256(rows) != batch.get("input_sha256"):
        raise SystemExit("배치 input_sha256이 현재 rows와 일치하지 않습니다.")

    requested = Counter((row["record_id"], row["question_id"]) for row in rows)
    returned = Counter()
    for index, result in enumerate(results, 1):
        if set(result) != REQUIRED_KEYS:
            raise SystemExit(f"결과 {index}행 스키마 불일치: {sorted(result)}")
        key = (result["record_id"], result["question_id"])
        returned[key] += 1
        if result["decision"] not in DECISIONS:
            raise SystemExit(f"결과 {index}행 decision 불일치")
        codes = result["reason_codes"].split("|") if result["reason_codes"] else []
        if not codes or len(codes) != len(set(codes)) or not set(codes) <= REASON_CODES:
            raise SystemExit(f"결과 {index}행 reason_codes 불일치")
        if result["confidence"] not in CONFIDENCE:
            raise SystemExit(f"결과 {index}행 confidence 불일치")
        if result["status"] != "ok":
            raise SystemExit(f"결과 {index}행 status는 ok여야 합니다.")
        if batch.get("evidence_basis") == "title_only":
            if "insufficient_abstract" not in codes or result["confidence"] != "low":
                raise SystemExit(f"결과 {index}행 제목 전용 제약 위반")
    missing = requested - returned
    extra = returned - requested
    duplicates = {key: count for key, count in returned.items() if count != 1}
    if missing or extra or duplicates or len(results) != len(rows):
        raise SystemExit(
            f"정확한 1회 반환 실패: missing={sum(missing.values())}, "
            f"extra={sum(extra.values())}, duplicates={len(duplicates)}"
        )
    by_key = {(row["record_id"], row["question_id"]): row for row in results}
    return [by_key[(row["record_id"], row["question_id"])] for row in rows]


def append_verified(batch_path: Path, results_path: Path, model: str) -> None:
    batch = json.loads(batch_path.read_text(encoding="utf-8"))
    ordered = validate_batch_results(batch, load_jsonl(results_path))
    existing = make_batches.checkpoint_counter()
    collisions = [
        (row["record_id"], row["question_id"]) for row in ordered
        if existing[(row["record_id"], row["question_id"])]
    ]
    if collisions:
        raise SystemExit(f"이미 체크포인트에 있는 키 {len(collisions)}건: append 중단")

    batch_sha = file_sha256(batch_path)
    judged_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    checkpoint_block = "".join(
        json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n"
        for row in ordered
    )
    audit_block = "".join(
        json.dumps({
            "record_id": row["record_id"],
            "question_id": row["question_id"],
            "execution_mode": "agent_local",
            "batch_id": batch["batch_id"],
            "batch_sha256": batch_sha,
            "judged_at": judged_at,
            "model": model,
            "evidence_basis": batch["evidence_basis"],
        }, ensure_ascii=False, separators=(",", ":")) + "\n"
        for row in ordered
    )
    CHECKPOINT.parent.mkdir(parents=True, exist_ok=True)
    with CHECKPOINT.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(checkpoint_block)
        handle.flush()
        os.fsync(handle.fileno())
    with AUDIT.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(audit_block)
        handle.flush()
        os.fsync(handle.fileno())
    print(f"검증·append 완료: {batch['batch_id']} {len(ordered)}행")


def summarize(frame: str, requeue_count: int, batch_size: int) -> None:
    expected = {
        (row["record_id"], row["question_id"]) for row in make_batches.load_frame(frame)
    }
    counts = make_batches.checkpoint_counter()
    present = expected & set(counts)
    missing = expected - set(counts)
    duplicates = {key: counts[key] for key in expected if counts[key] != 1 and counts[key] > 0}
    print(json.dumps({
        "frame": frame,
        "expected": len(expected),
        "classified": len(present),
        "missing": len(missing),
        "duplicates": len(duplicates),
        "coverage": round(len(present) / len(expected), 6) if expected else None,
        "exact_once_complete": not missing and not duplicates,
    }, ensure_ascii=False))
    if duplicates:
        raise SystemExit("체크포인트 중복 키가 있어 재배치할 수 없습니다.")
    if requeue_count:
        outputs = make_batches.build_batches(frame, batch_size, requeue_count)
        for path in outputs:
            print(f"재배치 큐: {path.relative_to(ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=Path)
    parser.add_argument("--results", type=Path)
    parser.add_argument("--append", action="store_true")
    parser.add_argument("--model", default="codex-gpt-5")
    parser.add_argument("--summary", action="store_true")
    parser.add_argument("--frame", choices=["abstract", "title_only"])
    parser.add_argument("--requeue-count", type=int, default=0)
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args()

    if args.summary:
        if not args.frame:
            raise SystemExit("--summary에는 --frame이 필요합니다.")
        summarize(args.frame, args.requeue_count, args.batch_size)
        return
    if not args.batch or not args.results:
        raise SystemExit("배치 검증에는 --batch와 --results가 필요합니다.")
    batch = json.loads(args.batch.read_text(encoding="utf-8"))
    ordered = validate_batch_results(batch, load_jsonl(args.results))
    print(f"정확한 1회 반환 확인: {batch['batch_id']} {len(ordered)}행")
    if args.append:
        append_verified(args.batch, args.results, args.model)


if __name__ == "__main__":
    main()
