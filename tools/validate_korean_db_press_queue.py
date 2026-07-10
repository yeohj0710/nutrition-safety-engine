#!/usr/bin/env python3
"""Ensure the Korean DB PRESS queue is complete, source-bound, and human-blank."""

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
        if row.get("status") != "pending_external_human_review":
            errors.append(f"row {index}: human review falsely closed")
        if any(row.get(field, "") for field in HUMAN_FIELDS):
            errors.append(f"row {index}: human-only field was prefilled")
        if row.get("platform") == "KMbase" and "do not infer absence" not in row.get("review_focus", ""):
            errors.append(f"row {index}: KMbase zero-hit safeguard missing")
    if seen != set(run_index):
        errors.append("queue/source coverage mismatch")
    result = {
        "errors": errors,
        "rows": len(rows),
        "human_decisions": sum(bool(row.get("decision")) for row in rows),
        "status": "pending_external_human_review",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
