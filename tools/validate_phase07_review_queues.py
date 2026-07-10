#!/usr/bin/env python3
"""Validate scenario provenance and prove both human queues remain unfilled."""

from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
V = REPO / "research/validation"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def row_sha(row: dict[str, str], fields: list[str]) -> str:
    return hashlib.sha256("\x1f".join(row[field] for field in fields if field != "gold_row_sha256").encode("utf-8")).hexdigest()


def progress_status(any_human: bool, complete_human: bool, kind: str) -> str:
    if kind == "blind":
        return ("complete_external_human_review_synthetic_not_gold" if complete_human else
                "in_progress_external_human_review_synthetic_not_gold" if any_human else
                "pending_external_human_review_synthetic_not_gold")
    return ("adjudicated_independent_gold_candidate" if complete_human else
            "in_progress_independent_human_authoring" if any_human else
            "pending_independent_human_authoring")


def main() -> int:
    errors: list[str] = []
    report = json.loads((V / "safe_empty_proxy_report.json").read_text(encoding="utf-8"))
    inputs = [json.loads(line) for line in (V / "synthetic_scenario_inputs.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    blind = rows(V / "synthetic_scenario_blind_expert_review.csv")
    gold = rows(V / "independent_gold_scenario_authoring_queue.csv")
    report_index = {row["scenario_id"]: row for row in report["scenarios"]}
    if len(inputs) != 120 or len(blind) != 120 or len(gold) != 120:
        errors.append("each scenario/input/review/authoring set must contain 120 rows")
    if report["source_hashes"].get("scenario_inputs") != sha(V / "synthetic_scenario_inputs.jsonl"):
        errors.append("scenario input file hash mismatch")
    blind_required = ("reviewer_id", "clinical_plausibility", "risk_coverage", "reviewed_at")
    blind_human = blind_required + ("missing_information", "comments")
    blind_complete = 0
    for line, (item, review) in enumerate(zip(inputs, blind), start=1):
        input_sha = hashlib.sha256(json.dumps(item["input"], separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()
        if item["status"] != "synthetic_boundary_input_not_independent_gold" or input_sha != item["input_sha256"]:
            errors.append(f"input {line}: status/hash mismatch")
        report_row = report_index.get(item["scenario_id"])
        if report_row is None or report_row["input_sha256"] != input_sha:
            errors.append(f"input {line}: report linkage mismatch")
        if review["input_line"] != str(line) or review["input_sha256"] != input_sha:
            errors.append(f"review {line}: input linkage mismatch")
        if review["runner_sha256"] != report["source_hashes"]["runner"] or review["engine_sha256"] != report["source_hashes"]["engine"] or review["thesis_bundle_sha256"] != report["source_hashes"]["thesis_bundle"]:
            errors.append(f"review {line}: source hash mismatch")
        if review["output_visible_to_reviewer"] != "false":
            errors.append(f"review {line}: blind boundary violated")
        any_human = any(review[field] for field in blind_human)
        complete_human = all(review[field] for field in blind_required)
        expected_status = progress_status(any_human, complete_human, "blind")
        if review["status"] != expected_status:
            errors.append(f"review {line}: progress status mismatch")
        if complete_human:
            blind_complete += 1
            if review["clinical_plausibility"] not in {"acceptable", "revise", "unacceptable"} or review["risk_coverage"] not in {"adequate", "revise", "inadequate"}:
                errors.append(f"review {line}: invalid expert judgment vocabulary")
    gold_fields = list(gold[0]) if gold else []
    gold_human = [field for field in gold_fields if field not in {"gold_scenario_id", "question_id", "protocol_sha256", "thesis_bundle_sha256", "status"}]
    gold_required = [field for field in gold_human if field != "gold_row_sha256"]
    gold_complete = 0
    for line, row in enumerate(gold, 1):
        any_human = any(row[field] for field in gold_human)
        complete_human = all(row[field] for field in gold_required) and bool(row["gold_row_sha256"])
        expected_status = progress_status(any_human, complete_human, "gold")
        if row["status"] != expected_status:
            errors.append(f"gold {line}: progress status mismatch")
        if complete_human:
            gold_complete += 1
            if len({row["author_1_id"], row["author_2_id"], row["adjudicator_id"]}) != 3:
                errors.append(f"gold {line}: authors and adjudicator must be distinct")
            for field in ("author_1_input_json", "author_1_expected_actions_json", "author_2_input_json",
                          "author_2_expected_actions_json", "adjudicated_input_json", "adjudicated_expected_actions_json",
                          "critical_failure_labels_json"):
                try:
                    json.loads(row[field])
                except json.JSONDecodeError:
                    errors.append(f"gold {line}: invalid {field}")
            if row["gold_row_sha256"] != row_sha(row, gold_fields):
                errors.append(f"gold {line}: row hash mismatch")
    if Counter(row["question_id"] for row in gold) != {"A1": 24, "A2": 24, "B1": 24, "B2": 24, "B3": 24}:
        errors.append("gold authoring queue is not question-balanced")
    state_tests = {"blind_pending": progress_status(False, False, "blind").startswith("pending_"),
                   "blind_partial": progress_status(True, False, "blind").startswith("in_progress_"),
                   "blind_complete": progress_status(True, True, "blind").startswith("complete_"),
                   "gold_pending": progress_status(False, False, "gold").startswith("pending_"),
                   "gold_partial": progress_status(True, False, "gold").startswith("in_progress_"),
                   "gold_complete": progress_status(True, True, "gold") == "adjudicated_independent_gold_candidate"}
    if not all(state_tests.values()):
        errors.append("Phase 07 progress-state contracts failed")
    result = {"errors": errors, "synthetic_inputs": len(inputs), "blind_review_rows": len(blind),
              "human_expert_reviews_complete": blind_complete, "gold_authoring_rows": len(gold),
              "independent_gold_candidates": gold_complete, "progress_state_contract_tests": state_tests}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
