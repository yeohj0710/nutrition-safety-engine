#!/usr/bin/env python3
"""Validate extraction/RoB task coverage and untouched human fields."""

import csv
import json
from pathlib import Path

from build_extraction_rob_work_queues import eligible, rob_route

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/interim"


def rows(name: str) -> list[dict[str, str]]:
    with (DATA / name).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    errors: list[str] = []
    included = eligible(rows("full_text_review_queue.csv"))
    extraction, rob = rows("extraction_work_queue.csv"), rows("rob_work_queue.csv")
    keys = {(row["report_id"], row["question_id"]) for row in included}
    if {(row["report_id"], row["question_id"]) for row in extraction} != keys or {(row["report_id"], row["question_id"]) for row in rob} != keys:
        errors.append("extraction/RoB task coverage differs from included full texts")
    extraction_complete = 0
    for row in extraction:
        human = any(row[field] for field in ("extractor_id", "verifier_id", "started_at", "completed_at"))
        complete = all(row[field] for field in ("extractor_id", "verifier_id", "started_at", "completed_at")) and row["extractor_id"] != row["verifier_id"]
        expected_status = "complete_candidate_requires_data_validation" if complete else "in_progress" if human else "awaiting_independent_extraction_and_verification"
        if row["status"] != expected_status:
            errors.append(f"extraction task progress mismatch: {row['extraction_task_id']}")
        extraction_complete += int(complete)
    rob_complete = 0
    for row in rob:
        expected = rob_route(row["design_family"])
        human_route = row["design_family"] != "randomized_trial" and row["tool_route_status"] == "human_selected_verified" and bool(row["tool_name"] and row["tool_version"])
        if (row["tool_name"], row["tool_route_status"]) != expected and not human_route:
            errors.append(f"RoB tool route mismatch: {row['rob_task_id']}")
        human = human_route or any(row[field] for field in ("tool_version", "reviewer_1_id", "reviewer_2_id", "adjudicator_id", "started_at", "completed_at"))
        complete = ((expected[0] == "RoB 2" and bool(row["tool_version"]) or human_route)
                    and all(row[field] for field in ("reviewer_1_id", "reviewer_2_id", "started_at", "completed_at"))
                    and row["reviewer_1_id"] != row["reviewer_2_id"])
        expected_status = "complete_candidate_requires_data_validation" if complete else "in_progress" if human else "awaiting_independent_rob_assessment"
        if row["status"] != expected_status:
            errors.append(f"RoB task progress mismatch: {row['rob_task_id']}")
        rob_complete += int(complete)
    contract = json.loads((ROOT / "research/extraction/extraction_rob_routing_contract.json").read_text(encoding="utf-8"))
    if not contract.get("all_passed") or len(contract.get("contract_tests", {})) != 6:
        errors.append("extraction/RoB routing contract failed")
    result = {"errors": errors, "included_fulltext_rows": len(included), "extraction_work_rows": len(extraction),
              "rob_work_rows": len(rob), "human_extractions": sum(bool(row["extractor_id"]) for row in extraction),
              "human_rob_assessments": sum(bool(row["reviewer_1_id"]) for row in rob),
              "extraction_complete_candidates": extraction_complete, "rob_complete_candidates": rob_complete,
              "contract_tests": len(contract.get("contract_tests", {}))}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
