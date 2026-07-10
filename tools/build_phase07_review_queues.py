#!/usr/bin/env python3
"""Build blind synthetic review and blank independent-gold authoring queues."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
VALIDATION = REPO / "research/validation"
REPORT = VALIDATION / "safe_empty_proxy_report.json"
INPUTS = VALIDATION / "synthetic_scenario_inputs.jsonl"
BLIND = VALIDATION / "synthetic_scenario_blind_expert_review.csv"
GOLD = VALIDATION / "independent_gold_scenario_authoring_queue.csv"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    inputs = [json.loads(line) for line in INPUTS.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(inputs) != 120:
        raise SystemExit(f"expected 120 synthetic inputs, got {len(inputs)}")
    report_rows = {row["scenario_id"]: row for row in report["scenarios"]}
    source_hashes = report["source_hashes"]
    blind_fields = [
        "scenario_id", "question_id", "input_file", "input_line", "input_sha256",
        "runner_sha256", "engine_sha256", "thesis_bundle_sha256", "output_visible_to_reviewer",
        "reviewer_id", "clinical_plausibility", "risk_coverage", "missing_information", "comments",
        "reviewed_at", "status",
    ]
    blind_rows = []
    for line_number, item in enumerate(inputs, start=1):
        report_row = report_rows[item["scenario_id"]]
        if item["input_sha256"] != report_row["input_sha256"]:
            raise SystemExit(f"input/report hash mismatch: {item['scenario_id']}")
        blind_rows.append({
            "scenario_id": item["scenario_id"],
            "question_id": item["question_id"],
            "input_file": "research/validation/synthetic_scenario_inputs.jsonl",
            "input_line": line_number,
            "input_sha256": item["input_sha256"],
            "runner_sha256": source_hashes["runner"],
            "engine_sha256": source_hashes["engine"],
            "thesis_bundle_sha256": source_hashes["thesis_bundle"],
            "output_visible_to_reviewer": "false",
            "reviewer_id": "",
            "clinical_plausibility": "",
            "risk_coverage": "",
            "missing_information": "",
            "comments": "",
            "reviewed_at": "",
            "status": "pending_external_human_review_synthetic_not_gold",
        })
    with BLIND.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=blind_fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(blind_rows)

    gold_fields = [
        "gold_scenario_id", "question_id", "protocol_sha256", "thesis_bundle_sha256",
        "author_1_id", "author_1_input_json", "author_1_expected_actions_json",
        "author_2_id", "author_2_input_json", "author_2_expected_actions_json",
        "adjudicator_id", "adjudicated_input_json", "adjudicated_expected_actions_json",
        "critical_failure_labels_json", "authored_at", "adjudicated_at", "gold_row_sha256", "status",
    ]
    protocol_sha = sha(REPO / "research/protocol/protocol-v1.0.md")
    questions = ["A1", "A2", "B1", "B2", "B3"]
    gold_rows = []
    for index in range(120):
        gold_rows.append({
            "gold_scenario_id": f"GOLD-DRAFT-{index + 1:03d}",
            "question_id": questions[index % len(questions)],
            "protocol_sha256": protocol_sha,
            "thesis_bundle_sha256": source_hashes["thesis_bundle"],
            "author_1_id": "", "author_1_input_json": "", "author_1_expected_actions_json": "",
            "author_2_id": "", "author_2_input_json": "", "author_2_expected_actions_json": "",
            "adjudicator_id": "", "adjudicated_input_json": "", "adjudicated_expected_actions_json": "",
            "critical_failure_labels_json": "", "authored_at": "", "adjudicated_at": "",
            "gold_row_sha256": "", "status": "pending_independent_human_authoring",
        })
    with GOLD.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=gold_fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(gold_rows)
    print(json.dumps({"blind_review_rows": len(blind_rows), "gold_authoring_rows": len(gold_rows), "human_reviews": 0, "independent_gold": 0}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
