#!/usr/bin/env python3
"""Validate that the agent PRESS prereview covers every human-review source row."""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "research/review_queue/press_agent_prereview.json"


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
    if any(row.get("decision", "").strip() for row in main_rows + korean_rows):
        errors.append("agent prereview must not populate human decision fields")
    result = {"errors": errors, "main_rows": len(main_rows), "korean_rows": len(korean_rows), "bundles": len(bundles), "human_decisions": 0}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
