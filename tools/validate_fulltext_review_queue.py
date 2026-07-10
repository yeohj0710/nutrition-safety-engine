#!/usr/bin/env python3
"""Validate full-text queue coverage and untouched double-review fields."""

import csv
import json
from pathlib import Path

from build_fulltext_review_queue import selected

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/interim"


def rows(name: str) -> list[dict[str, str]]:
    with (DATA / name).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    errors: list[str] = []
    expected = selected(rows("secondary_screening_review_queue.csv"))
    queue = rows("full_text_review_queue.csv")
    expected_keys = {(row["record_id"], row["question_id"]) for row in expected}
    if len(queue) != len(expected) or {(row["record_id"], row["question_id"]) for row in queue} != expected_keys:
        errors.append("full-text queue does not cover secondary include/uncertain exactly")
    human = ("source_file_path", "source_file_sha256", "study_id", "study_link_verified_by", "design_family", "design_verified_by",
             "reviewer_1_id", "reviewer_1_decision", "reviewer_1_reason",
             "reviewer_1_at", "reviewer_2_id", "reviewer_2_decision", "reviewer_2_reason", "reviewer_2_at",
             "adjudicator_id", "final_decision", "final_reason")
    if any(any(row[field] for field in human) or row["status"] != "awaiting_fulltext_access_and_double_review" for row in queue):
        errors.append("full-text queue contains unverified access/review values")
    contract = json.loads((ROOT / "research/screening/full_text_queue_contract.json").read_text(encoding="utf-8"))
    if not contract.get("all_passed") or len(contract.get("contract_tests", {})) != 7:
        errors.append("full-text queue contract failed")
    result = {"errors": errors, "secondary_eligible_rows": len(expected), "fulltext_queue_rows": len(queue),
              "fulltext_human_reviews": 0, "contract_tests": len(contract.get("contract_tests", {}))}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
