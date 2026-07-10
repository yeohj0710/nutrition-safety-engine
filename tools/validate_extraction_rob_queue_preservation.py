#!/usr/bin/env python3
"""Prove extraction/RoB routing preserves human assignments."""

import csv
import json
import tempfile
from pathlib import Path
from build_extraction_rob_work_queues import write_or_preserve


def main() -> int:
    fields = ["task_id", "report_id", "reviewer"]
    generated = [{"task_id": "T1", "report_id": "R1", "reviewer": ""}]
    tests = {}
    with tempfile.TemporaryDirectory() as temp:
        path = Path(temp) / "queue.csv"
        started = lambda row: bool(row.get("reviewer"))
        tests["missing_initialized"] = write_or_preserve(path, fields, generated, "task_id", ("report_id",), started) == "generated_no_human_data"
        with path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n"); writer.writeheader()
            writer.writerow({"task_id": "T1", "report_id": "R1", "reviewer": "REV-1"})
        before = path.read_bytes()
        tests["human_bytes_preserved"] = write_or_preserve(path, fields, generated, "task_id", ("report_id",), started) == "preserved_existing_human_data" and path.read_bytes() == before
        try:
            write_or_preserve(path, fields, [{"task_id": "T1", "report_id": "CHANGED", "reviewer": ""}], "task_id", ("report_id",), started)
            rejected = False
        except ValueError:
            rejected = path.read_bytes() == before
        tests["routing_change_rejected_without_write"] = rejected
    errors = [] if all(tests.values()) else ["extraction/RoB queue preservation failed"]
    print(json.dumps({"errors": errors, "tests": tests}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
