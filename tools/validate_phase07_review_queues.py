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
    blind_human = ("reviewer_id", "clinical_plausibility", "risk_coverage", "missing_information", "comments", "reviewed_at")
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
        if review["output_visible_to_reviewer"] != "false" or any(review[field] for field in blind_human):
            errors.append(f"review {line}: blind/human boundary violated")
    gold_human = [field for field in gold[0] if field not in {"gold_scenario_id", "question_id", "protocol_sha256", "thesis_bundle_sha256", "status"}] if gold else []
    if any(any(row[field] for field in gold_human) for row in gold):
        errors.append("independent gold authoring fields were prefilled")
    if any(row["status"] != "pending_independent_human_authoring" for row in gold):
        errors.append("independent gold status overstated")
    if Counter(row["question_id"] for row in gold) != {"A1": 24, "A2": 24, "B1": 24, "B2": 24, "B3": 24}:
        errors.append("gold authoring queue is not question-balanced")
    result = {"errors": errors, "synthetic_inputs": len(inputs), "blind_review_rows": len(blind), "human_expert_reviews": 0, "gold_authoring_rows": len(gold), "independent_gold_scenarios": 0}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
