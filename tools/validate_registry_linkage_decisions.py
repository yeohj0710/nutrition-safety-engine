#!/usr/bin/env python3
"""Validate registry linkage decisions and human-progress states."""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def rows(relative: str) -> list[dict[str, str]]:
    with (ROOT / relative).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    errors = []
    source = {row["link_candidate_id"]: row for row in rows("data/interim/registry_report_link_candidates.csv")}
    queue = rows("data/interim/registry_linkage_decisions.csv")
    allowed = {"same_study_report", "not_same_study", "uncertain"}
    complete = 0
    for line, row in enumerate(queue, 2):
        original = source.get(row["link_candidate_id"])
        if original is None or any(row[field] != original[field] for field in
                                   ("registry_record_id", "nct_id", "pubmed_record_id", "pmid", "reference_type")):
            errors.append(f"row {line}: source lineage mismatch"); continue
        human = any(row[field].strip() for field in ("decision", "study_id", "report_id", "reason", "verified_by", "verified_at"))
        decision = row["decision"].strip()
        is_complete = decision in allowed and bool(row["reason"].strip() and row["verified_by"].strip() and row["verified_at"].strip())
        if decision == "same_study_report":
            is_complete = is_complete and bool(row["study_id"].strip() and row["report_id"].strip())
        expected = "complete_candidate_requires_validation" if is_complete else "in_progress_external_human_review" if human else "pending_external_human_review"
        if row["status"] != expected:
            errors.append(f"row {line}: expected status {expected}")
        complete += is_complete
    if len(queue) != 500 or set(source) != {row["link_candidate_id"] for row in queue}:
        errors.append("expected exact 500-candidate coverage")
    result = {"errors": errors, "rows": len(queue), "complete_candidates": complete,
              "status": "valid" if not errors else "invalid"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
