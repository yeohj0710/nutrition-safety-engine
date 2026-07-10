#!/usr/bin/env python3
"""Validate blinded second-review selection and empty human fields."""

import csv
import json
from pathlib import Path

from build_secondary_screening_queue import row_digest, select_primary

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/interim"


def rows(name: str) -> list[dict[str, str]]:
    with (DATA / name).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    errors: list[str] = []
    primary = rows("screening_decisions.csv")
    completed = [row for row in primary if all(row[field].strip() for field in ("reviewer_id", "decision", "reviewed_at"))]
    expected = select_primary(completed)
    queue, audit = rows("secondary_screening_review_queue.csv"), rows("secondary_screening_selection_audit.csv")
    if len(queue) != len(expected) or len(audit) != len(expected):
        errors.append("secondary queue/audit selection count mismatch")
    expected_keys = {(row["record_id"], row["question_ids"]) for row, _ in expected}
    if {(row["record_id"], row["question_id"]) for row in queue} != expected_keys:
        errors.append("secondary queue key set mismatch")
    if any(row["source_primary_row_sha256"] != row_digest(source) for row in queue
           for source in completed if source["record_id"] == row["record_id"] and source["question_ids"] == row["question_id"]):
        errors.append("secondary source-row hash mismatch")
    human = ("reviewer_2_id", "reviewer_2_decision", "reviewer_2_reason", "reviewed_at", "final_decision", "adjudicator_id")
    if any(any(row[field] for field in human) or row["adjudication_status"] != "not_started" for row in queue):
        errors.append("secondary queue contains unverified human values")
    if queue and any(field in queue[0] for field in ("primary_decision", "primary_reason_code", "selection_basis")):
        errors.append("primary decisions leaked into blinded reviewer queue")
    report = json.loads((ROOT / "research/screening/secondary_screening_contract.json").read_text(encoding="utf-8"))
    if not report.get("all_passed") or not all(report.get("contract_tests", {}).values()):
        errors.append("secondary screening contract tests failed")
    result = {"errors": errors, "primary_completed_rows": len(completed), "secondary_queue_rows": len(queue),
              "secondary_human_reviews": 0, "contract_tests": len(report.get("contract_tests", {}))}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
