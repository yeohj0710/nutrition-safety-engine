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
    if any(any(row[field] for field in ("extractor_id", "verifier_id", "started_at", "completed_at")) for row in extraction):
        errors.append("extraction task contains unverified human work")
    if any(any(row[field] for field in ("reviewer_1_id", "reviewer_2_id", "adjudicator_id", "started_at", "completed_at")) for row in rob):
        errors.append("RoB task contains unverified human work")
    for row in rob:
        expected = rob_route(row["design_family"])
        if (row["tool_name"], row["tool_route_status"]) != expected:
            errors.append(f"RoB tool route mismatch: {row['rob_task_id']}")
    contract = json.loads((ROOT / "research/extraction/extraction_rob_routing_contract.json").read_text(encoding="utf-8"))
    if not contract.get("all_passed") or len(contract.get("contract_tests", {})) != 6:
        errors.append("extraction/RoB routing contract failed")
    result = {"errors": errors, "included_fulltext_rows": len(included), "extraction_work_rows": len(extraction),
              "rob_work_rows": len(rob), "human_extractions": 0, "human_rob_assessments": 0,
              "contract_tests": len(contract.get("contract_tests", {}))}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
