#!/usr/bin/env python3
"""Exercise source→extraction→claim→rule contract with synthetic data only."""

from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator

REPO = Path(__file__).resolve().parents[1]
SCHEMA = REPO / "research/design/20260710/05_SYNTHESIS/evidence_to_rule_schema.json"
OUT = REPO / "research/synthesis/claim_rule_contract_results.json"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def semantic_errors(bundle: dict) -> list[str]:
    errors: list[str] = []
    certainty = {item["certainty_assessment_id"]: item for item in bundle.get("certainty_assessments", [])}
    claims = {claim["claim_id"]: claim for claim in bundle.get("claims", [])}
    for claim in claims.values():
        assessment = certainty.get(claim.get("certainty_assessment_id"))
        if assessment is None:
            errors.append("missing certainty")
        elif (assessment.get("question_id") != claim.get("question_id")
              or assessment.get("certainty") != claim.get("certainty")
              or assessment.get("verification_status") != "validated"):
            errors.append("certainty mismatch")
        for support in claim.get("support", []):
            if "legacy_unverified" in support.get("source_path", ""):
                errors.append("legacy source")
            if support.get("supporting_quote_sha256") != sha(support.get("supporting_quote", "")):
                errors.append("quote hash")
    for rule in bundle.get("rules", []):
        linked = [claims.get(claim_id) for claim_id in rule.get("claim_ids", [])]
        if any(claim is None for claim in linked):
            errors.append("missing claim")
            continue
        if any(claim["question_id"] != rule["question_id"] for claim in linked):
            errors.append("question mismatch")
        if rule["scope_status"] == "validated_thesis_scope":
            if rule["validation_status"] != "validated":
                errors.append("rule status")
            if any(claim["verification_status"] != "validated" for claim in linked):
                errors.append("draft claim")
            evidence = set(rule.get("validation_evidence", []))
            if not any(item.startswith("expert_review:") for item in evidence):
                errors.append("expert review")
            if not any(item.startswith("independent_scenario:") for item in evidence):
                errors.append("independent scenario")
    return errors


def main() -> int:
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    quote = "Synthetic contract statement; not research evidence."
    valid = {
        "bundle_version": "synthetic-contract-1",
        "contract_mode": "synthetic_contract_fixture",
        "certainty_assessments": [{
            "certainty_assessment_id": "GRADE-SYNTH-001",
            "question_id": "A1",
            "certainty": "low",
            "verification_status": "validated",
            "verified_by": ["SYNTH-REVIEWER-1"],
        }],
        "claims": [{
            "claim_id": "CLM-SYNTH-001",
            "question_id": "A1",
            "claim_text": "Synthetic validated claim used only to exercise provenance contracts.",
            "scope_status": "validated_thesis_scope",
            "population": {"synthetic": True},
            "exposure": {"synthetic": True},
            "outcome": {"synthetic": True},
            "evidence_layer": "primary_synthesis",
            "certainty": "low",
            "certainty_assessment_id": "GRADE-SYNTH-001",
            "support": [{
                "source_id": "SRC-SYNTH-001",
                "report_id": "RPT-SYNTH-001",
                "extraction_id": "EXT-SYNTH-001",
                "source_path": "synthetic_fixture/source.xml",
                "source_file_sha256": "1" * 64,
                "study_id": "STD-SYNTH-001",
                "locator": "article/body/sec[1]/p[1]",
                "locator_text_sha256": sha(quote),
                "supporting_quote": quote,
                "supporting_quote_sha256": sha(quote),
                "human_verified_by": ["SYNTH-REVIEWER-1"],
            }],
            "verification_status": "validated",
            "verified_by": ["SYNTH-REVIEWER-1"],
            "version": "1",
        }],
        "rules": [{
            "rule_id": "RUL-SYNTH-001",
            "question_id": "A1",
            "scope_status": "validated_thesis_scope",
            "conditions": {"synthetic": True},
            "action_class": "information_only",
            "message_template": "Synthetic contract message only.",
            "claim_ids": ["CLM-SYNTH-001"],
            "validation_status": "validated",
            "validation_evidence": ["expert_review:SYNTH", "independent_scenario:SYNTH"],
            "version": "1",
        }],
    }

    def accepted(bundle: dict) -> bool:
        return not list(validator.iter_errors(bundle)) and not semantic_errors(bundle)

    mutations: dict[str, dict] = {}
    for name in (
        "legacy_source", "wrong_quote_hash", "missing_claim", "draft_claim",
        "question_mismatch", "unvalidated_rule", "missing_expert_review", "missing_scenario_validation",
        "missing_certainty", "certainty_mismatch",
    ):
        mutations[name] = copy.deepcopy(valid)
    mutations["legacy_source"]["claims"][0]["support"][0]["source_path"] = "data/legacy_unverified/source.xml"
    mutations["wrong_quote_hash"]["claims"][0]["support"][0]["supporting_quote_sha256"] = "f" * 64
    mutations["missing_claim"]["rules"][0]["claim_ids"] = ["CLM-MISSING"]
    mutations["draft_claim"]["claims"][0]["verification_status"] = "draft"
    mutations["question_mismatch"]["rules"][0]["question_id"] = "B1"
    mutations["unvalidated_rule"]["rules"][0]["validation_status"] = "draft"
    mutations["missing_expert_review"]["rules"][0]["validation_evidence"] = ["independent_scenario:SYNTH", "other:SYNTH"]
    mutations["missing_scenario_validation"]["rules"][0]["validation_evidence"] = ["expert_review:SYNTH", "other:SYNTH"]
    mutations["missing_certainty"]["certainty_assessments"] = []
    mutations["certainty_mismatch"]["certainty_assessments"][0]["certainty"] = "moderate"
    tests = {"valid_synthetic_contract_accepted": accepted(valid)}
    tests.update({f"{name}_rejected": not accepted(bundle) for name, bundle in mutations.items()})
    result = {
        "status": "synthetic_contract_test_not_research_evidence",
        "schema_draft": "2020-12",
        "tests": tests,
        "all_passed": all(tests.values()),
        "production_claims_created": 0,
        "production_rules_created": 0,
        "legacy_promotions": 0,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["all_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
