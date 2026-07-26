# -*- coding: utf-8 -*-
"""미분류 record-question 행을 로컬 에이전트 판정 배치로 만든다."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_MAP = ROOT / "data" / "curated_v2" / "evidence_map.csv"
CHECKPOINT = ROOT / "research" / "screening" / "llm_screening_runs.jsonl"
BATCH_DIR = ROOT / "research" / "screening" / "agent_batches"
VALID_QUESTIONS = {"A1", "A2", "B1", "B2", "B3"}
REQUIRED_CHECKPOINT_KEYS = {
    "record_id", "question_id", "decision", "reason_codes", "confidence", "status"
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_rows_sha256(rows: list[dict[str, str]]) -> str:
    payload = json.dumps(
        rows, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def load_frame(frame: str) -> list[dict[str, str]]:
    rows = []
    with EVIDENCE_MAP.open(encoding="utf-8-sig", newline="") as handle:
        for source in csv.DictReader(handle):
            if source["question_id"] not in VALID_QUESTIONS:
                continue
            basis = "abstract" if source["abstract"].strip() else "title_only"
            if frame != "all" and basis != frame:
                continue
            rows.append({
                "record_id": source["record_id"],
                "question_id": source["question_id"],
                "title": source["title"],
                "abstract": source["abstract"],
            })
    rows.sort(key=lambda row: (row["record_id"], row["question_id"]))
    return rows


def checkpoint_counter() -> Counter[tuple[str, str]]:
    counts: Counter[tuple[str, str]] = Counter()
    if not CHECKPOINT.exists():
        return counts
    with CHECKPOINT.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise SystemExit(f"체크포인트 {line_number}행 JSON 오류: {exc}") from exc
            if set(row) != REQUIRED_CHECKPOINT_KEYS:
                raise SystemExit(f"체크포인트 {line_number}행 스키마 불일치: {sorted(row)}")
            counts[(row["record_id"], row["question_id"])] += 1
    return counts


def pending_batch_keys() -> set[tuple[str, str]]:
    keys: set[tuple[str, str]] = set()
    if not BATCH_DIR.exists():
        return keys
    for path in BATCH_DIR.glob("v2_*.json"):
        try:
            batch = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for row in batch.get("rows", []):
            keys.add((row.get("record_id", ""), row.get("question_id", "")))
    return keys


def next_sequence(frame: str) -> int:
    pattern = re.compile(rf"^v2_{re.escape(frame)}_(\d+)$")
    sequences = []
    if BATCH_DIR.exists():
        for path in BATCH_DIR.glob(f"v2_{frame}_*.json"):
            match = pattern.match(path.stem)
            if match:
                sequences.append(int(match.group(1)))
    return max(sequences, default=0) + 1


def build_batches(frame: str, batch_size: int, count: int) -> list[Path]:
    if not 40 <= batch_size <= 60:
        raise SystemExit("배치 크기는 계획서에 따라 40~60행이어야 합니다.")
    done = checkpoint_counter()
    duplicates = [key for key, value in done.items() if value != 1]
    if duplicates:
        raise SystemExit(f"체크포인트 중복 키 {len(duplicates)}건: append 중단")
    pending = pending_batch_keys() - set(done)
    available = [
        row for row in load_frame(frame)
        if (row["record_id"], row["question_id"]) not in done
        and (row["record_id"], row["question_id"]) not in pending
    ]
    limit = batch_size * count
    selected = available[:limit]
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    sequence = next_sequence(frame)
    outputs = []
    for offset in range(0, len(selected), batch_size):
        rows = selected[offset:offset + batch_size]
        batch_id = f"v2_{frame}_{sequence:04d}"
        payload = {
            "batch_id": batch_id,
            "input_sha256": canonical_rows_sha256(rows),
            "evidence_basis": frame,
            "source_path": "data/curated_v2/evidence_map.csv",
            "source_sha256": sha256_file(EVIDENCE_MAP),
            "rows": rows,
        }
        path = BATCH_DIR / f"{batch_id}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        outputs.append(path)
        sequence += 1
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frame", choices=["abstract", "title_only"], required=True)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--count", type=int, default=1, help="생성할 최대 배치 수")
    args = parser.parse_args()
    if args.count < 1:
        raise SystemExit("--count는 1 이상이어야 합니다.")
    outputs = build_batches(args.frame, args.batch_size, args.count)
    for path in outputs:
        print(path.relative_to(ROOT))
    print(f"생성 배치 {len(outputs)}개 · 행 {sum(len(json.loads(p.read_text(encoding='utf-8'))['rows']) for p in outputs)}")


if __name__ == "__main__":
    main()
