#!/usr/bin/env python3
"""Prove secondary-screening regeneration preserves human bytes."""

import csv
import json
import tempfile
from pathlib import Path
from build_secondary_screening_queue import write_or_preserve_queue


def main() -> int:
    fields = ["secondary_id", "record_id", "reviewer_2_id"]
    generated = [{"secondary_id": "S1", "record_id": "R1", "reviewer_2_id": ""}]
    tests = {}
    with tempfile.TemporaryDirectory() as temp:
        path = Path(temp) / "queue.csv"
        tests["missing_initialized"] = write_or_preserve_queue(path, fields, generated, ("reviewer_2_id",), ("record_id",)) == "generated_no_human_data"
        with path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n"); writer.writeheader()
            writer.writerow({"secondary_id": "S1", "record_id": "R1", "reviewer_2_id": "REV-2"})
        before = path.read_bytes()
        tests["human_bytes_preserved"] = write_or_preserve_queue(path, fields, generated, ("reviewer_2_id",), ("record_id",)) == "preserved_existing_human_data" and path.read_bytes() == before
        try:
            write_or_preserve_queue(path, fields, [{"secondary_id": "S1", "record_id": "CHANGED", "reviewer_2_id": ""}], ("reviewer_2_id",), ("record_id",))
            rejected = False
        except ValueError:
            rejected = path.read_bytes() == before
        tests["selection_change_rejected_without_write"] = rejected
    errors = [] if all(tests.values()) else ["secondary preservation failed"]
    print(json.dumps({"errors": errors, "tests": tests}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
