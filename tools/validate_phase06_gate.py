#!/usr/bin/env python3
"""Validate Phase 06 without treating legitimate future human data as an error."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUESTIONS = {"A1", "A2", "B1", "B2", "B3"}


def csv_rows(relative: str) -> list[dict]:
    with (ROOT / relative).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def jsonl_rows(relative: str) -> list[dict]:
    rows = []
    for line_no, line in enumerate((ROOT / relative).read_text(encoding="utf-8-sig").splitlines(), 1):
        if not line.strip():
            continue
        value = json.loads(line)
        if not isinstance(value, dict):
            raise ValueError(f"{relative}:{line_no}: object required")
        rows.append(value)
    return rows


def ids(rows: list[dict], field: str, label: str, errors: list[str]) -> set[str]:
    values = [str(row.get(field, "")).strip() for row in rows]
    if any(not value for value in values):
        errors.append(f"{label}: missing {field}")
    if len(values) != len(set(values)):
        errors.append(f"{label}: duplicate {field}")
    return set(values)


def phase_status(counts: dict[str, int], decisions: list[dict]) -> str:
    ready = all(counts[name] > 0 for name in ("human_extractions", "risk_of_bias", "certainty", "claims", "rules"))
    decisions_complete = len(decisions) == 5 and all(
        row.get("status") == "complete_verified" and row.get("decision") != "not_assessed" for row in decisions
    )
    return "complete_candidate_requires_acceptance_review" if ready and decisions_complete else "blocked_external"


def main() -> int:
    errors: list[str] = []
    extraction = csv_rows("data/interim/extractions_human.csv")
    rob = csv_rows("data/interim/risk_of_bias.csv")
    certainty = csv_rows("research/synthesis/certainty_assessments.csv")
    claims = csv_rows("research/synthesis/claim_registry.csv")
    rules = csv_rows("research/synthesis/rule_registry.csv")
    decisions = csv_rows("research/synthesis/meta_analysis_decisions.csv")
    with (ROOT / "research/synthesis/certainty_assessments.csv").open(encoding="utf-8-sig", newline="") as handle:
        certainty_header = next(csv.reader(handle))
    with (ROOT / "research/design/20260710/05_SYNTHESIS/certainty_assessment_template.csv").open(encoding="utf-8-sig", newline="") as handle:
        template_header = next(csv.reader(handle))
    if certainty_header != template_header:
        errors.append("certainty registry header differs from protocol template")
    validated_certainty = [row for row in certainty if all(row.get(field) for field in
        ("certainty_id", "question_id", "outcome_canonical", "final_certainty", "rationale", "reviewer_1", "reviewer_2", "consensus_date"))]
    validated_claims = [row for row in claims if row.get("verification_status") == "validated"]
    validated_rules = [row for row in rules if row.get("validation_status") == "validated" and row.get("scope_status") == "validated_thesis_scope"]
    counts = {"human_extractions": len(extraction), "risk_of_bias": len(rob), "certainty": len(validated_certainty),
              "claims": len(validated_claims), "rules": len(validated_rules)}

    if len(decisions) != 5 or {row.get("question_id") for row in decisions} != QUESTIONS:
        errors.append("meta-analysis decision log must cover all five questions exactly once")
    allowed_decisions = {"not_assessed", "meta_analysis", "structured_narrative_synthesis", "no_eligible_evidence"}
    allowed_statuses = {"blocked_external", "draft", "complete_verified"}
    if any(row.get("decision") not in allowed_decisions or row.get("status") not in allowed_statuses or not row.get("reason") for row in decisions):
        errors.append("meta-analysis decision row has invalid decision/status or empty reason")
    allowed_certainty = {"high", "moderate", "low", "very_low"}
    if any(row.get("final_certainty") and row.get("final_certainty") not in allowed_certainty for row in certainty):
        errors.append("certainty registry has invalid final_certainty")
    if any(row.get("reviewer_1") and row.get("reviewer_1") == row.get("reviewer_2") for row in certainty):
        errors.append("certainty registry requires distinct reviewers")
    if any(row.get("verification_status") not in {"draft", "human_verified", "validated", "retired"} for row in claims):
        errors.append("claim registry has invalid verification_status")
    if any(row.get("validation_status") not in {"draft", "validated", "retired"} for row in rules):
        errors.append("rule registry has invalid validation_status")

    curated_files = {
        "sources": "sources.jsonl", "reports": "reports.jsonl", "studies": "studies.jsonl",
        "extractions": "extractions.jsonl", "risk_of_bias": "risk_of_bias.jsonl",
        "certainty": "certainty_assessments.jsonl", "claims": "claims.jsonl", "rules": "rules.jsonl",
    }
    curated = {name: jsonl_rows(f"data/curated/{filename}") for name, filename in curated_files.items()}
    curated_counts = {f"{name}.jsonl": len(rows) for name, rows in curated.items()}
    registry_links = (
        (validated_certainty, "certainty_id", curated["certainty"], "certainty_assessment_id", "certainty"),
        (validated_claims, "claim_id", curated["claims"], "claim_id", "claims"),
        (validated_rules, "rule_id", curated["rules"], "rule_id", "rules"),
    )
    for registry, registry_id, curated_rows, curated_id, label in registry_links:
        if ids(registry, registry_id, f"{label} registry", errors) != ids(curated_rows, curated_id, f"curated {label}", errors):
            errors.append(f"validated {label} registry IDs do not equal curated IDs")
    serialized = json.dumps(curated, ensure_ascii=False)
    if "legacy_unverified" in serialized or "synthetic_fixture" in serialized:
        errors.append("curated production rows contain forbidden source namespace")

    bundle = json.loads((ROOT / "src/generated/thesis-bundle.json").read_text(encoding="utf-8-sig"))
    bundle_map = {"sources": "sources", "reports": "reports", "studies": "studies", "extractions": "extractions",
                  "risk_of_bias": "riskOfBias", "certainty": "certaintyAssessments", "claims": "claims", "rules": "rules"}
    id_fields = {"sources": "source_id", "reports": "report_id", "studies": "study_id", "extractions": "extraction_id",
                 "risk_of_bias": "rob_id", "certainty": "certainty_assessment_id", "claims": "claim_id", "rules": "rule_id"}
    for name, bundle_name in bundle_map.items():
        if ids(curated[name], id_fields[name], f"curated {name}", errors) != ids(bundle.get(bundle_name, []), id_fields[name], f"bundle {name}", errors):
            errors.append(f"bundle {name} IDs do not equal curated IDs")
    meta = bundle.get("meta", {})
    expected_meta = {"sourceCount": len(curated["sources"]), "reportCount": len(curated["reports"]),
                     "studyCount": len(curated["studies"]), "extractionCount": len(curated["extractions"]),
                     "riskOfBiasCount": len(curated["risk_of_bias"]), "certaintyAssessmentCount": len(curated["certainty"]),
                     "claimCount": len(curated["claims"]), "ruleCount": len(curated["rules"])}
    if any(meta.get(field) != value for field, value in expected_meta.items()):
        errors.append("bundle meta counts do not equal curated rows")
    if (validated_claims or validated_rules) and (not extraction or not rob or not validated_certainty):
        errors.append("validated claim/rule exists before extraction, RoB, and GRADE prerequisites")

    contract = json.loads((ROOT / "research/synthesis/claim_rule_contract_results.json").read_text(encoding="utf-8-sig"))
    expected_contract_tests = {"valid_synthetic_contract_accepted", "legacy_source_rejected", "wrong_quote_hash_rejected",
        "missing_claim_rejected", "draft_claim_rejected", "question_mismatch_rejected", "unvalidated_rule_rejected",
        "missing_expert_review_rejected", "missing_scenario_validation_rejected", "missing_certainty_rejected", "certainty_mismatch_rejected"}
    tests = contract.get("tests", {})
    if contract.get("status") != "synthetic_contract_test_not_research_evidence" or set(tests) != expected_contract_tests or not all(tests.values()):
        errors.append("claim-rule contract tests missing or failed")
    if any(contract.get(field) != 0 for field in ("production_claims_created", "production_rules_created", "legacy_promotions")):
        errors.append("synthetic contract fixture overstated production outputs")

    state_tests = {
        "empty_blocked": phase_status({name: 0 for name in counts}, decisions) == "blocked_external",
        "upstream_only_blocked": phase_status({**counts, "human_extractions": 1, "risk_of_bias": 1}, decisions) == "blocked_external",
        "complete_candidate": phase_status({name: 1 for name in counts}, [dict(row, decision="structured_narrative_synthesis", status="complete_verified") for row in decisions]) == "complete_candidate_requires_acceptance_review",
    }
    if not all(state_tests.values()):
        errors.append("Phase 06 progress-state contracts failed")
    status = phase_status(counts, decisions)
    result = {"errors": errors, "phase_status": status, "counts": counts, "curated_jsonl_counts": curated_counts,
              "meta_analysis_decisions": len(decisions), "claim_rule_contract_tests": len(tests),
              "progress_state_contract_tests": state_tests, "legacy_promotions": 0}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
