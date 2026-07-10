#!/usr/bin/env python3
"""Prove Phase 06 remains safely empty until evidence inputs are verified."""

import csv
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def count_rows(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return sum(1 for _ in csv.DictReader(handle))


def nonempty_jsonl_rows(path: Path) -> int:
    return sum(1 for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip())


def main() -> int:
    paths = {
        "human_extractions": REPO / "data/interim/extractions_human.csv",
        "risk_of_bias": REPO / "data/interim/risk_of_bias.csv",
        "certainty": REPO / "research/synthesis/certainty_assessments.csv",
        "claims": REPO / "research/synthesis/claim_registry.csv",
        "rules": REPO / "research/synthesis/rule_registry.csv",
    }
    counts = {name: count_rows(path) for name, path in paths.items()}
    curated_names = (
        "sources.jsonl", "reports.jsonl", "studies.jsonl", "extractions.jsonl",
        "risk_of_bias.jsonl", "claims.jsonl", "rules.jsonl",
    )
    curated_counts = {
        name: nonempty_jsonl_rows(REPO / "data/curated" / name) for name in curated_names
    }
    bundle = json.loads((REPO / "src/generated/thesis-bundle.json").read_text(encoding="utf-8-sig"))
    errors = []
    contract_path = REPO / "research/synthesis/claim_rule_contract_results.json"
    contract = json.loads(contract_path.read_text(encoding="utf-8-sig"))
    if any(counts.values()):
        errors.append("unverified Phase 06 registry unexpectedly populated")
    if any(curated_counts.values()):
        errors.append("curated thesis JSONL unexpectedly populated before verified synthesis")
    if bundle.get("claims") or bundle.get("rules"):
        errors.append("thesis bundle contains claims/rules without verified synthesis")
    decision_path = REPO / "research/synthesis/meta_analysis_decisions.csv"
    decisions = count_rows(decision_path)
    with decision_path.open("r", encoding="utf-8-sig", newline="") as handle:
        decision_rows = list(csv.DictReader(handle))
    if decisions != 5 or {row["question_id"] for row in decision_rows} != {"A1", "A2", "B1", "B2", "B3"}:
        errors.append("meta-analysis decision log must cover all five questions")
    if any(row["decision"] != "not_assessed" or row["status"] != "blocked_external" for row in decision_rows):
        errors.append("meta-analysis decision log overstates analysis readiness")
    expected_contract_tests = {
        "valid_synthetic_contract_accepted", "legacy_source_rejected", "wrong_quote_hash_rejected",
        "missing_claim_rejected", "draft_claim_rejected", "question_mismatch_rejected",
        "unvalidated_rule_rejected", "missing_expert_review_rejected", "missing_scenario_validation_rejected",
    }
    tests = contract.get("tests", {})
    if contract.get("status") != "synthetic_contract_test_not_research_evidence" or set(tests) != expected_contract_tests or not all(tests.values()):
        errors.append("claim-rule contract tests missing or failed")
    if contract.get("production_claims_created") != 0 or contract.get("production_rules_created") != 0 or contract.get("legacy_promotions") != 0:
        errors.append("contract fixture overstated production outputs")
    print(json.dumps({"errors": errors, "phase_status": "blocked_external", "counts": counts, "curated_jsonl_counts": curated_counts, "meta_analysis_decisions": decisions, "claim_rule_contract_tests": len(tests), "legacy_promotions": 0}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
