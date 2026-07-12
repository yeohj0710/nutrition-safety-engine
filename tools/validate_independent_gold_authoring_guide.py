#!/usr/bin/env python3
"""Validate independent-gold queue shape and actionable human guidance."""

import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "research/validation/independent_gold_scenario_authoring_queue.csv"
GUIDE = ROOT / "research/validation/INDEPENDENT_GOLD_AUTHORING_GUIDE.md"


def main() -> int:
    errors = []
    with QUEUE.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle); rows, fields = list(reader), reader.fieldnames or []
    expected_fields = ["gold_scenario_id", "question_id", "protocol_sha256", "thesis_bundle_sha256",
                       "author_1_id", "author_1_input_json", "author_1_expected_actions_json",
                       "author_2_id", "author_2_input_json", "author_2_expected_actions_json",
                       "adjudicator_id", "adjudicated_input_json", "adjudicated_expected_actions_json",
                       "critical_failure_labels_json", "authored_at", "adjudicated_at", "gold_row_sha256", "status"]
    if fields != expected_fields or len(rows) != 120:
        errors.append("independent gold queue schema or row count mismatch")
    counts = Counter(row["question_id"] for row in rows)
    if counts != Counter({question: 24 for question in ("A1", "A2", "B1", "B2", "B3")}):
        errors.append("gold queue must contain 24 rows per question")
    guide = GUIDE.read_text(encoding="utf-8")
    required = ("저자 1", "저자 2", "합의자", "엔진 구현자", "U+001F", "gold_row_sha256",
                "critical_failure_labels_json", "120개 모두", "synthetic safe-empty")
    if any(term not in guide for term in required) or "�" in guide:
        errors.append("gold authoring guide omits required role/hash/safety instructions")
    result = {"errors": errors, "queue_rows": len(rows), "per_question": dict(sorted(counts.items())),
              "human_authored_rows": sum(bool(row["author_1_id"] or row["author_2_id"]) for row in rows),
              "status": "valid" if not errors else "invalid"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
