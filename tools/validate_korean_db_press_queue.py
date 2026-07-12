#!/usr/bin/env python3
"""Ensure the Korean DB PRESS queue is source-bound and human-review consistent."""

from __future__ import annotations

import csv
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "research/searches/korean_db_split_designpilot_20260710/summary.json"
QUEUE = REPO / "research/review_queue/korean_db_PRESS_review.csv"
HUMAN_FIELDS = ("reviewer_id", "reviewed_at", "decision", "comments", "required_revision")


def main() -> int:
    errors: list[str] = []
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    with QUEUE.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    runs = source.get("runs", [])
    run_index = {(run["platform"], run["question_id"], run["query"]): run for run in runs}
    seen: set[tuple[str, str, str]] = set()
    if len(rows) != 40 or len(run_index) != 40:
        errors.append("expected exactly 40 source-bound review rows")
    for index, row in enumerate(rows):
        key = (row.get("platform", ""), row.get("question_id", ""), row.get("query", ""))
        if key in seen:
            errors.append(f"row {index}: duplicate review key")
        seen.add(key)
        run = run_index.get(key)
        if run is None:
            errors.append(f"row {index}: no matching pilot run")
            continue
        expected_file = f"research/searches/korean_db_split_designpilot_20260710/{run['response_file']}"
        if row.get("response_file") != expected_file or row.get("response_sha256") != run.get("response_sha256"):
            errors.append(f"row {index}: response provenance mismatch")
        if row.get("observed_hits") != str(run.get("hits")):
            errors.append(f"row {index}: hit count mismatch")
        populated = [field for field in HUMAN_FIELDS if row.get(field, "").strip()]
        decision = row.get("decision", "").strip()
        allowed = set(row.get("allowed_decisions", "").split(";"))
        if not populated:
            expected_status = "pending_external_human_review"
        elif decision and row.get("reviewer_id", "").strip() and row.get("reviewed_at", "").strip():
            expected_status = "complete_candidate_requires_validation"
            if decision not in allowed:
                errors.append(f"row {index}: decision outside allowed vocabulary")
            if decision == "return_with_edits" and not row.get("required_revision", "").strip():
                errors.append(f"row {index}: return_with_edits requires revision text")
        else:
            expected_status = "in_progress_external_human_review"
        if row.get("status") != expected_status:
            errors.append(f"row {index}: expected status {expected_status}")
        if row.get("platform") == "KMbase" and "do not infer absence" not in row.get("review_focus", ""):
            errors.append(f"row {index}: KMbase zero-hit safeguard missing")
    if seen != set(run_index):
        errors.append("queue/source coverage mismatch")
    result = {
        "errors": errors,
        "rows": len(rows),
        "human_decisions": sum(bool(row.get("decision")) for row in rows),
        "status": "valid" if not errors else "invalid",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
