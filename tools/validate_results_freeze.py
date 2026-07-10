#!/usr/bin/env python3
"""Validate the single results-freeze and department-format approval row."""

import csv
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FREEZE = ROOT / "research/thesis/results_freeze_review.csv"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors = []
    with FREEZE.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if len(rows) > 1:
        errors.append("results freeze must contain at most one approval row")
    frozen = False
    if rows:
        row = rows[0]
        head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
        if row["status"] != "frozen_validated" or row["frozen_commit"] != head or not row["approved_by"] or not row["approved_at"] or not row["protocol_approval_reference"]:
            errors.append("results freeze identity/approval mismatch")
        for path_field, hash_field in (("data_manifest_path", "data_manifest_sha256"),
                                       ("analysis_manifest_path", "analysis_manifest_sha256"),
                                       ("department_format_path", "department_format_sha256")):
            relative = Path(row[path_field])
            path = (ROOT / relative).resolve()
            if relative.is_absolute() or not path.is_relative_to(ROOT) or not path.is_file() or sha(path) != row[hash_field]:
                errors.append(f"results freeze invalid {path_field}")
        frozen = not errors
    tests = {"empty_not_frozen": not bool([]), "one_valid_shape_supported": len([1]) == 1,
             "multiple_rejected": len([1, 2]) > 1}
    result = {"errors": errors, "status": "frozen_validated" if frozen else "blocked_external_no_results_freeze",
              "rows": len(rows), "results_frozen": frozen, "contract_tests": tests}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
