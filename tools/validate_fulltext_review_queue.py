#!/usr/bin/env python3
"""Validate full-text queue coverage and untouched double-review fields."""

import csv
import hashlib
import json
from pathlib import Path

from build_fulltext_review_queue import human_started, selected

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
    complete_candidates = 0
    for row in queue:
        started = human_started(row)
        reviewers_complete = all(row[field] for field in ("reviewer_1_id", "reviewer_1_decision", "reviewer_1_at",
                                                           "reviewer_2_id", "reviewer_2_decision", "reviewer_2_at"))
        reviewers_valid = row["reviewer_1_decision"] in {"include", "exclude"} and row["reviewer_2_decision"] in {"include", "exclude"}
        roles_distinct = row["reviewer_1_id"] != row["reviewer_2_id"] if reviewers_complete else False
        adjudication_ok = not reviewers_complete or row["reviewer_1_decision"] == row["reviewer_2_decision"] or bool(row["adjudicator_id"])
        source_ok = False
        if row["source_file_path"] and row["source_file_sha256"]:
            relative = Path(row["source_file_path"]); path = (ROOT / relative).resolve()
            source_ok = (not relative.is_absolute() and path.is_relative_to(ROOT) and path.is_file()
                         and "legacy_unverified" not in relative.parts
                         and hashlib.sha256(path.read_bytes()).hexdigest() == row["source_file_sha256"])
        complete = (row["fulltext_access_status"] == "obtained_verified" and source_ok
                    and all(row[field] for field in ("study_id", "study_link_verified_by", "design_family", "design_verified_by"))
                    and reviewers_complete and reviewers_valid and roles_distinct and adjudication_ok
                    and row["final_decision"] in {"include", "exclude"}
                    and (row["final_decision"] != "exclude" or bool(row["final_reason"])))
        expected_status = "complete_candidate_requires_validation" if complete else "in_progress_fulltext_review" if started else "awaiting_fulltext_access_and_double_review"
        if row["status"] != expected_status:
            errors.append(f"full-text progress mismatch: {row['fulltext_queue_id']}")
        complete_candidates += int(complete)
    contract = json.loads((ROOT / "research/screening/full_text_queue_contract.json").read_text(encoding="utf-8"))
    if not contract.get("all_passed") or len(contract.get("contract_tests", {})) != 7:
        errors.append("full-text queue contract failed")
    result = {"errors": errors, "secondary_eligible_rows": len(expected), "fulltext_queue_rows": len(queue),
              "fulltext_human_reviews": sum(human_started(row) for row in queue),
              "fulltext_complete_candidates": complete_candidates,
              "contract_tests": len(contract.get("contract_tests", {}))}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
