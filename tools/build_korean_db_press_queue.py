#!/usr/bin/env python3
"""Build a blank independent-PRESS queue from checksum-bound Korean DB pilot runs."""

from __future__ import annotations

import csv
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "research/searches/korean_db_split_designpilot_20260710/summary.json"
OUTPUT = REPO / "research/review_queue/korean_db_PRESS_review.csv"
FIELDS = [
    "review_id",
    "platform",
    "question_id",
    "query",
    "observed_hits",
    "response_file",
    "response_sha256",
    "review_focus",
    "allowed_decisions",
    "reviewer_id",
    "reviewed_at",
    "decision",
    "comments",
    "required_revision",
    "status",
]


def main() -> int:
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    runs = source.get("runs", [])
    if len(runs) != 40:
        raise SystemExit(f"expected 40 source runs, got {len(runs)}")
    rows = []
    per_platform = {"KMbase": 0, "RISS": 0}
    for run in runs:
        platform = run["platform"]
        per_platform[platform] += 1
        sequence = per_platform[platform]
        zero_focus = (
            "critical: zero-hit recall; verify platform semantics and known-item retrieval; do not infer absence"
            if platform == "KMbase"
            else "verify concept mapping, implicit operator, phrase behavior, overlap, and known-item retrieval"
        )
        rows.append(
            {
                "review_id": f"PRESS-KR-{platform.upper()}-{sequence:02d}",
                "platform": platform,
                "question_id": run["question_id"],
                "query": run["query"],
                "observed_hits": run["hits"],
                "response_file": f"research/searches/korean_db_split_designpilot_20260710/{run['response_file']}",
                "response_sha256": run["response_sha256"],
                "review_focus": zero_focus,
                "allowed_decisions": "approve_for_final_rerun;return_with_edits;reject_translation;record_platform_unavailable",
                "reviewer_id": "",
                "reviewed_at": "",
                "decision": "",
                "comments": "",
                "required_revision": "",
                "status": "pending_external_human_review",
            }
        )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(json.dumps({"rows": len(rows), "platforms": per_platform}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
