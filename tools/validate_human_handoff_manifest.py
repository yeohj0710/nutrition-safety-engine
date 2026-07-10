#!/usr/bin/env python3
"""Validate external-human handoff queue hashes and untouched decision fields."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "research/review_queue/human_handoff_manifest.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors: list[str] = []
    value = json.loads(MANIFEST.read_text(encoding="utf-8"))
    queues = value.get("queues", [])
    human_rows = 0
    for item in queues:
        path = ROOT / item["path"]
        if not path.is_file() or path.stat().st_size != item["size_bytes"] or sha(path) != item["sha256"]:
            errors.append(f"handoff hash/size mismatch: {item['path']}")
            continue
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        if len(rows) != item["row_count"]:
            errors.append(f"handoff row count mismatch: {item['path']}")
        populated = sum(any(row.get(field, "").strip() for field in item["protected_human_fields"]) for row in rows)
        if populated != item["rows_with_human_data"]:
            errors.append(f"handoff protected-field count mismatch: {item['path']}")
        human_rows += populated
    if value.get("queue_count") != len(queues) or len(queues) != 21:
        errors.append("expected 21 handoff queues")
    if value.get("rows_with_human_data") != human_rows or human_rows != 0:
        errors.append("unverified human data entered or count overstated")
    if value.get("human_work_complete") is not False or value.get("status") != "ready_for_external_review_not_completed":
        errors.append("human handoff completion overstated")
    result = {"errors": errors, "queues": len(queues), "rows": value.get("total_rows"),
              "rows_with_human_data": human_rows, "human_work_complete": False}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
