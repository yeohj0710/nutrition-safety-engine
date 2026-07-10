#!/usr/bin/env python3
"""Promote only fully adjudicated, hash-valid independent scenarios to curated JSONL."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "research/validation/independent_gold_scenario_authoring_queue.csv"
OUTPUT = ROOT / "data/curated/independent_gold_scenarios.jsonl"
BUNDLE = ROOT / "src/generated/thesis-bundle.json"


def sha_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def main() -> int:
    errors = []
    with QUEUE.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        rows, fields = list(reader), reader.fieldnames or []
    bundle_sha = sha_bytes(BUNDLE.read_bytes())
    curated = []
    for line, row in enumerate(rows, 2):
        if row["status"] != "adjudicated_independent_gold_candidate":
            continue
        expected_hash = sha_bytes("\x1f".join(row[field] for field in fields if field != "gold_row_sha256").encode("utf-8"))
        if row["gold_row_sha256"] != expected_hash:
            errors.append(f"row {line}: gold hash mismatch")
            continue
        if len({row["author_1_id"], row["author_2_id"], row["adjudicator_id"]}) != 3:
            errors.append(f"row {line}: independent roles required")
            continue
        if row["thesis_bundle_sha256"] != bundle_sha:
            errors.append(f"row {line}: gold authored against different thesis bundle")
            continue
        try:
            input_value = json.loads(row["adjudicated_input_json"])
            expected = json.loads(row["adjudicated_expected_actions_json"])
            critical = json.loads(row["critical_failure_labels_json"])
        except json.JSONDecodeError as exc:
            errors.append(f"row {line}: invalid adjudicated JSON: {exc.msg}")
            continue
        if not isinstance(input_value, dict) or not isinstance(expected, list) or not isinstance(critical, list):
            errors.append(f"row {line}: input object and expected/critical arrays required")
            continue
        if any(not isinstance(item, dict) or not isinstance(item.get("rule_id"), str) or not isinstance(item.get("action_class"), str) for item in expected):
            errors.append(f"row {line}: expected actions require rule_id/action_class")
            continue
        rule_ids = {item["rule_id"] for item in expected}
        if any(not isinstance(item, str) or item not in rule_ids for item in critical):
            errors.append(f"row {line}: critical labels must be expected rule IDs")
            continue
        curated.append({"gold_scenario_id": row["gold_scenario_id"], "question_id": row["question_id"],
                        "thesis_bundle_sha256": row["thesis_bundle_sha256"], "input": input_value,
                        "expected_actions": expected, "critical_rule_ids": critical,
                        "author_ids": [row["author_1_id"], row["author_2_id"]], "adjudicator_id": row["adjudicator_id"],
                        "authored_at": row["authored_at"], "adjudicated_at": row["adjudicated_at"],
                        "gold_row_sha256": row["gold_row_sha256"]})
    if len({row["gold_scenario_id"] for row in curated}) != len(curated):
        errors.append("duplicate curated gold_scenario_id")
    if errors:
        print(json.dumps({"errors": errors, "curated": 0}, ensure_ascii=False, indent=2))
        return 1
    OUTPUT.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in curated), encoding="utf-8")
    print(json.dumps({"errors": [], "queue_rows": len(rows), "curated_gold_candidates": len(curated),
                      "performance_allowed": len(curated) == 120}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
