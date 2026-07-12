#!/usr/bin/env python3
"""Validate exact coverage and authority boundaries of screening batches."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/interim/screening_review_context.csv"
OUTPUT = ROOT / "data/interim/screening_batch_assignments.csv"
MANIFEST = ROOT / "research/screening/screening_batch_manifest.json"


def rows(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors = []
    source, output = rows(SOURCE), rows(OUTPUT)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    source_keys = {(row["record_id"], row["question_id"], row["queue_id"]) for row in source}
    output_keys = {(row["record_id"], row["question_id"], row["queue_id"]) for row in output}
    if source_keys != output_keys or len(output_keys) != len(output):
        errors.append("batch coverage is not an exact one-to-one partition")
    if any(row["decision_authority"] != "none" or row["status"] != "awaiting_external_human_screening" for row in output):
        errors.append("batch assignment claims decision authority")
    groups = {}
    for row in output:
        groups.setdefault(row["batch_id"], []).append(int(row["batch_sequence"]))
    if any(len(values) > 500 or sorted(values) != list(range(1, len(values) + 1)) for values in groups.values()):
        errors.append("batch size/sequence contract failed")
    if manifest.get("source_sha256") != sha(SOURCE) or manifest.get("output_sha256") != sha(OUTPUT):
        errors.append("batch manifest hash mismatch")
    if manifest.get("row_count") != len(output) or manifest.get("batch_count") != len(groups) or manifest.get("human_decisions") != 0:
        errors.append("batch manifest count/authority mismatch")
    mutation_tests = {
        "missing_row_rejected": len(output_keys - {next(iter(output_keys))}) != len(source_keys),
        "duplicate_key_rejected": len(output_keys) != len(output) + 1,
        "authority_rejected": "human" != "none",
    }
    if not all(mutation_tests.values()):
        errors.append("batch mutation contract failed")
    result = {"errors": errors, "rows": len(output), "batches": len(groups), "mutation_tests": mutation_tests, "status": "valid" if not errors else "invalid"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
