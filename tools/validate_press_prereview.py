#!/usr/bin/env python3
"""Validate that the agent PRESS prereview covers every human-review source row."""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "research/review_queue/press_agent_prereview.json"
APPROVAL = ROOT / "research/approvals/press_review_approval.json"


def rows(path: str) -> list[dict[str, str]]:
    with (ROOT / path).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    errors: list[str] = []
    payload = json.loads(PREVIEW.read_text(encoding="utf-8"))
    main_rows = rows("research/review_queue/PRESS_review.csv")
    korean_rows = rows("research/review_queue/korean_db_PRESS_review.csv")
    bundles = payload.get("bundles", [])
    expected_bundles = {
        "PRESS-BUNDLE-A1", "PRESS-BUNDLE-A2", "PRESS-BUNDLE-B1",
        "PRESS-BUNDLE-B2", "PRESS-BUNDLE-B3", "PRESS-BUNDLE-PLATFORM",
    }
    if payload.get("authority") != "agent_prereview_only" or payload.get("human_final_decision_required") is not True:
        errors.append("agent/human authority boundary is missing")
    if payload.get("source_rows") != {"main": 8, "korean_database": 40}:
        errors.append("source row declaration mismatch")
    if len(main_rows) != 8 or len(korean_rows) != 40:
        errors.append("canonical PRESS queue counts changed")
    if {item.get("id") for item in bundles} != expected_bundles:
        errors.append("bundle set mismatch")
    decisions = [row for row in main_rows + korean_rows if row.get("decision", "").strip()]
    if APPROVAL.exists():
        approval = json.loads(APPROVAL.read_text(encoding="utf-8"))
        if approval.get("bundles_approved") != 6 or approval.get("canonical_rows_reviewed") != 48:
            errors.append("PRESS approval scope mismatch")
        if len(decisions) != 48:
            errors.append("approved PRESS package must contain 48 decisions")
        for row in decisions:
            if row["decision"] not in row["allowed_decisions"].split(";"):
                errors.append(f"invalid decision: {row.get('review_id')}")
            if not row.get("reviewer_id", "").strip() or not row.get("reviewed_at", "").strip():
                errors.append(f"decision metadata missing: {row.get('review_id')}")
    elif decisions:
        errors.append("agent prereview must not populate human decision fields without approval evidence")
    result = {"errors": errors, "main_rows": len(main_rows), "korean_rows": len(korean_rows), "bundles": len(bundles), "human_decisions": len(decisions)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
