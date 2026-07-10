#!/usr/bin/env python3
"""Validate locally provable Phase 02 outputs without closing human gates."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
QUESTIONS = {"A1", "A2", "B1", "B2", "B3"}
REQUIRED = [
    "research/protocol/protocol-v1.0.md",
    "research/protocol/amendments.csv",
    "research/protocol/access_matrix.csv",
    "research/protocol/outcome_priority.csv",
    "research/protocol/workload_forecast.csv",
    "research/protocol/human_ai_role_matrix.md",
    "research/protocol/registration_status.md",
    "research/protocol/phase_02_exit_criteria.md",
    "research/searches/sentinel_set.csv",
    "research/searches/pubmed_pilot_20260710.json",
    "research/searches/search_strategy_drafts/platform_translation_drafts.md",
    "research/review_queue/PRESS_review.csv",
    "research/review_queue/PRESS_review.md",
    "research/review_queue/korean_db_PRESS_review.csv",
    "research/review_queue/korean_db_PRESS_review.md",
    "research/review_queue/phase_02_external_review.csv",
]


def csv_rows(relative: str) -> list[dict[str, str]]:
    with (REPO / relative).open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    errors: list[str] = []
    for relative in REQUIRED:
        if not (REPO / relative).is_file():
            errors.append(f"missing required artifact: {relative}")

    query_paths = {
        question: REPO / "research" / "searches" / "search_strategy_drafts" / f"{question}_pubmed.txt"
        for question in QUESTIONS
    }
    for question, path in query_paths.items():
        if not path.is_file() or not path.read_text(encoding="utf-8-sig").strip():
            errors.append(f"missing PubMed query: {question}")

    if errors:
        print(json.dumps({"errors": errors}, ensure_ascii=False, indent=2))
        return 1

    protocol = (REPO / REQUIRED[0]).read_text(encoding="utf-8-sig")
    exit_gate = (REPO / "research/protocol/phase_02_exit_criteria.md").read_text(
        encoding="utf-8-sig"
    )
    registration = (REPO / "research/protocol/registration_status.md").read_text(
        encoding="utf-8-sig"
    )
    if "pending_human_approval" not in protocol:
        errors.append("protocol approval status is not explicitly pending")
    if "Phase status: `blocked_external`" not in exit_gate:
        errors.append("Phase 02 must remain blocked_external until human gates close")
    if "not_registered_pending_human_approval" not in registration:
        errors.append("registration status is missing or overstated")

    pilot = json.loads(
        (REPO / "research/searches/pubmed_pilot_20260710.json").read_text(encoding="utf-8-sig")
    )
    if pilot.get("status") != "design_pilot_not_final_search":
        errors.append("PubMed pilot is incorrectly labeled as final")
    runs = pilot.get("runs", [])
    if {run.get("question_id") for run in runs} != QUESTIONS:
        errors.append("PubMed pilot does not contain exactly five questions")
    for run in runs:
        question = run.get("question_id")
        path = query_paths.get(question)
        if path is None:
            continue
        expected_sha = hashlib.sha256(
            (path.read_text(encoding="utf-8-sig").strip() + "\n").encode("utf-8")
        ).hexdigest()
        if run.get("query_sha256") != expected_sha:
            errors.append(f"query hash mismatch: {question}")
        if int(run.get("hit_count_at_access", 0)) <= 0:
            errors.append(f"nonpositive pilot count: {question}")
        if not run.get("sentinel_checks") or not all(
            check.get("retrieved") is True for check in run["sentinel_checks"]
        ):
            errors.append(f"sentinel retrieval failed: {question}")

    outcomes = csv_rows("research/protocol/outcome_priority.csv")
    if {row["question_id"] for row in outcomes} != QUESTIONS:
        errors.append("outcome priority table lacks one or more questions")
    if not any(row["priority"] == "critical" for row in outcomes):
        errors.append("outcome priorities contain no critical outcome")

    access = csv_rows("research/protocol/access_matrix.csv")
    if not any(row["status"] == "external_human_blocker" for row in access):
        errors.append("subscription/full-text blockers are not represented")
    if not any(row["status"] == "verified_public" for row in access):
        errors.append("public-source access is not represented")

    press = csv_rows("research/review_queue/PRESS_review.csv")
    if len(press) < 7 or not all(
        row["status"] in {"pending_external_human_review", "blocked_external"} for row in press
    ):
        errors.append("PRESS queue is incomplete or falsely closed")

    review = csv_rows("research/review_queue/phase_02_external_review.csv")
    if len(review) < 5 or not all(row["status"] == "blocked_external" for row in review):
        errors.append("Phase 02 external review queue is incomplete")

    result = {
        "errors": errors,
        "phase_status": "blocked_external",
        "pubmed_pilot_runs": len(runs),
        "pubmed_pilot_hits": sum(int(run["hit_count_at_access"]) for run in runs),
        "sentinel_checks": sum(len(run["sentinel_checks"]) for run in runs),
        "press_queue_rows": len(press),
        "external_review_rows": len(review),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
