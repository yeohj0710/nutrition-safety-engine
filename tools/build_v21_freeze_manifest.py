# -*- coding: utf-8 -*-
"""v2.1 동결 시점의 주요 연구 산출물 해시를 재생성한다."""
from __future__ import annotations

import csv
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research" / "audit" / "v21_freeze_manifest.json"
EVIDENCE_MAP = ROOT / "data" / "curated_v2" / "evidence_map.csv"
EXPECTED_EVIDENCE_SHA256 = "7fbd8cab64c7ba874ec95c759c9597684151b020e4fdc4f708afbbdabf5aa7c2"
ARTIFACTS = [
    "data/curated_v2/evidence_map.csv",
    "data/curated_v2/ai_screening_classifications.csv",
    "data/curated_v2/llm_screening_classifications.csv",
    "research/screening/llm_screening_runs.jsonl",
    "research/screening/llm_screening_manifest.json",
    "research/synthesis/screening_method_comparison.json",
    "research/systematic_review_v3/picos_extraction.csv",
    "research/systematic_review_v3/core_evidence.csv",
    "research/systematic_review_v3/core_manifest.json",
    "research/systematic_review_v3/personalized_rules.json",
    "research/systematic_review_v3/manifest.json",
    "src/generated/ai-exploratory-bundle.json",
    "src/generated/legacy/knowledge-index.json",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_output(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def logical_rows(path: Path) -> int | None:
    if path.suffix.lower() == ".csv":
        with path.open(encoding="utf-8-sig", newline="") as handle:
            return sum(1 for _ in csv.DictReader(handle))
    if path.suffix.lower() == ".jsonl":
        with path.open(encoding="utf-8") as handle:
            return sum(1 for line in handle if line.strip())
    return None


def main() -> None:
    evidence_sha = sha256(EVIDENCE_MAP)
    if evidence_sha != EXPECTED_EVIDENCE_SHA256:
        raise SystemExit(f"절대 금지 입력 해시 불일치: {evidence_sha}")

    artifacts = []
    for relative in ARTIFACTS:
        path = ROOT / relative
        if not path.is_file():
            raise SystemExit(f"동결 대상이 없습니다: {relative}")
        entry = {
            "path": relative,
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
        }
        rows = logical_rows(path)
        if rows is not None:
            entry["logical_rows"] = rows
        artifacts.append(entry)

    manifest = {
        "schema_version": "1.0.0",
        "status": "v2.1_frozen_before_v3.0",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "git": {
            "tag": "v2.1-frozen",
            "tag_commit": git_output("rev-list", "-n", "1", "v2.1-frozen"),
            "head_commit_at_capture": git_output("rev-parse", "HEAD"),
        },
        "protected_input": {
            "path": "data/curated_v2/evidence_map.csv",
            "sha256": evidence_sha,
        },
        "artifacts": artifacts,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"동결 매니페스트 {len(artifacts)}건 -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
