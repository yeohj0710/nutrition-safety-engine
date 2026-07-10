#!/usr/bin/env python3
"""Inventory external-human work queues without inferring any decisions."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "research/review_queue/human_handoff_manifest.json"
SPECS = [
    ("P2_PRESS_main", "research/review_queue/PRESS_review.csv", []),
    ("P2_PRESS_korean", "research/review_queue/korean_db_PRESS_review.csv", ["reviewer_id", "reviewed_at", "decision", "comments", "required_revision"]),
    ("P3_dedup", "data/interim/deduplication_decisions.csv", ["decision", "canonical_record_id", "duplicate_cluster_id", "duplicate_reason", "verified_by", "verified_at"]),
    ("P4_pubmed_screening", "data/interim/screening_decisions.csv", ["reviewer_id", "decision", "primary_reason_code", "reviewed_at", "final_decision", "final_reason_code", "adjudicator_id"]),
    ("P4_registry_screening", "data/interim/clinicaltrials_review_queue.csv", ["reviewer_1_id", "reviewer_1_decision", "reviewer_2_id", "reviewer_2_decision", "adjudicator_id", "final_decision"]),
    ("P4_koreamed_screening", "data/interim/koreamed_review_queue.csv", ["reviewer_1_id", "reviewer_1_decision", "reviewer_2_id", "reviewer_2_decision", "adjudicator_id", "final_decision"]),
    ("P4_non_oa_access", "research/fulltext/pmc_sentinel_fulltext_designpilot_20260710/non_oa_access_queue.csv", ["requester_id", "requested_at", "access_outcome", "obtained_file_sha256"]),
    ("P5_extraction", "data/interim/extractions_human.csv", ["extracted_by", "verified_by", "verification_status"]),
    ("P5_risk_of_bias", "data/interim/risk_of_bias.csv", ["reviewer_id", "reviewed_at", "consensus_judgment", "adjudicator_id"]),
    ("P6_grade", "research/synthesis/certainty_assessments.csv", ["reviewer_id", "verified_by", "verification_status"]),
    ("P6_claims", "research/synthesis/claim_registry.csv", ["verified_by", "verification_status"]),
    ("P6_rules", "research/synthesis/rule_registry.csv", ["verified_by", "validation_status"]),
    ("P7_blind_expert", "research/validation/synthetic_scenario_blind_expert_review.csv", ["reviewer_id", "clinical_plausibility", "risk_coverage", "missing_information", "comments", "reviewed_at"]),
    ("P7_independent_gold", "research/validation/independent_gold_scenario_authoring_queue.csv", ["author_1_id", "author_1_input_json", "author_1_expected_actions_json", "author_2_id", "author_2_input_json", "author_2_expected_actions_json", "adjudicator_id", "adjudicated_input_json", "adjudicated_expected_actions_json", "critical_failure_labels_json", "authored_at", "adjudicated_at", "gold_row_sha256"]),
] + [(f"P{phase}_external", f"research/review_queue/phase_{phase:02d}_external_review.csv", [])
     for phase in (1, 2, 3, 5, 6, 7, 8)]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    queues = []
    for queue_id, relative, protected in SPECS:
        path = ROOT / relative
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            rows = list(reader)
            fields = reader.fieldnames or []
        applicable = [field for field in protected if field in fields]
        completed = sum(any(row.get(field, "").strip() for field in applicable) for row in rows) if applicable else 0
        queues.append({"queue_id": queue_id, "path": relative, "sha256": sha(path),
                       "size_bytes": path.stat().st_size, "row_count": len(rows),
                       "protected_human_fields": applicable, "rows_with_human_data": completed})
    payload = {"schema_version": "1.0.0", "status": "ready_for_external_review_not_completed",
               "dependency_order": ["protocol_PRESS", "retrieval_dedup", "screening_fulltext",
                                    "extraction_RoB", "synthesis_GRADE_claim_rule",
                                    "independent_validation", "finalization"],
               "queue_count": len(queues), "total_rows": sum(q["row_count"] for q in queues),
               "rows_with_human_data": sum(q["rows_with_human_data"] for q in queues),
               "human_work_complete": False, "queues": queues}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"queues": len(queues), "rows": payload["total_rows"],
                      "rows_with_human_data": payload["rows_with_human_data"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
