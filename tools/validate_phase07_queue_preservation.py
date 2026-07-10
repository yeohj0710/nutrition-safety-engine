#!/usr/bin/env python3
"""Mutation tests proving Phase 07 builders never erase human review data."""

import csv
import json
import tempfile
from pathlib import Path

from build_phase07_review_queues import write_or_preserve


def main() -> int:
    fields = ["id", "reviewer", "decision"]
    generated = [{"id": "1", "reviewer": "", "decision": ""}]
    tests = {}
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        missing = root / "missing.csv"
        tests["missing_initialized"] = write_or_preserve(missing, fields, generated, ["reviewer", "decision"]) == "generated_no_human_data"
        human = root / "human.csv"
        with human.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
            writer.writeheader()
            writer.writerow({"id": "1", "reviewer": "REV-1", "decision": "acceptable"})
        before = human.read_bytes()
        status = write_or_preserve(human, fields, generated, ["reviewer", "decision"])
        tests["human_bytes_preserved"] = status == "preserved_existing_human_data" and human.read_bytes() == before
        mismatch = root / "mismatch.csv"
        mismatch.write_text("wrong,header\n", encoding="utf-8")
        before = mismatch.read_bytes()
        try:
            write_or_preserve(mismatch, fields, generated, ["reviewer", "decision"])
            rejected = False
        except ValueError:
            rejected = mismatch.read_bytes() == before
        tests["header_mismatch_rejected_without_write"] = rejected
    errors = [] if all(tests.values()) else ["Phase 07 preservation contract failed"]
    print(json.dumps({"errors": errors, "tests": tests}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
