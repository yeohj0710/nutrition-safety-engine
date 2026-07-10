#!/usr/bin/env python3
"""Prove Phase 05 fixture generation cannot erase human CSV rows."""

import csv
import json
import tempfile
from pathlib import Path

from phase05_proxy_metrics import initialize_or_validate_csv


def main() -> int:
    tests: dict[str, bool] = {}
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        path = root / "human.csv"
        fields = ["id", "reviewer", "status"]
        initialize_or_validate_csv(path, fields)
        tests["missing_file_initialized"] = path.is_file()
        with path.open("a", encoding="utf-8", newline="") as handle:
            csv.writer(handle).writerow(["ROW-1", "HUMAN-1", "verified"])
        before = path.read_bytes()
        initialize_or_validate_csv(path, fields)
        tests["existing_human_row_preserved_byte_exact"] = path.read_bytes() == before
        tests["header_mismatch_rejected_without_write"] = False
        try:
            initialize_or_validate_csv(path, ["wrong"])
        except ValueError:
            tests["header_mismatch_rejected_without_write"] = path.read_bytes() == before
    result = {"errors": [] if all(tests.values()) else ["human CSV preservation contract failed"],
              "tests": tests, "all_passed": all(tests.values())}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["all_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
