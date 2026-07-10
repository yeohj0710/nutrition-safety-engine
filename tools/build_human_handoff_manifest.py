#!/usr/bin/env python3
"""Inventory external-human queues and derive future-safe progress states."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "research/review_queue/human_handoff_manifest.json"


def spec(queue_id: str, path: str, human: list[str], required: list[str]):
    return {"queue_id": queue_id, "path": path, "human": human, "required": required}


SPECS = [
    spec("P2_PRESS_main", "research/review_queue/PRESS_review.csv", [], []),
    spec("P2_PRESS_korean", "research/review_queue/korean_db_PRESS_review.csv", ["reviewer_id", "reviewed_at", "decision", "comments", "required_revision"], ["reviewer_id", "reviewed_at", "decision"]),
    spec("P3_dedup", "data/interim/deduplication_decisions.csv", ["decision", "canonical_record_id", "duplicate_cluster_id", "duplicate_reason", "verified_by", "verified_at"], ["decision", "verified_by", "verified_at"]),
    spec("P4_pubmed_screening", "data/interim/screening_decisions.csv", ["reviewer_id", "decision", "primary_reason_code", "reviewed_at", "final_decision", "final_reason_code", "adjudicator_id"], ["reviewer_id", "decision", "reviewed_at", "final_decision"]),
    spec("P4_registry_screening", "data/interim/clinicaltrials_review_queue.csv", ["reviewer_1_id", "reviewer_1_decision", "reviewer_2_id", "reviewer_2_decision", "adjudicator_id", "final_decision"], ["reviewer_1_id", "reviewer_1_decision", "reviewer_2_id", "reviewer_2_decision", "final_decision"]),
    spec("P4_koreamed_screening", "data/interim/koreamed_review_queue.csv", ["reviewer_1_id", "reviewer_1_decision", "reviewer_2_id", "reviewer_2_decision", "adjudicator_id", "final_decision"], ["reviewer_1_id", "reviewer_1_decision", "reviewer_2_id", "reviewer_2_decision", "final_decision"]),
    spec("P4_non_oa_access", "research/fulltext/pmc_sentinel_fulltext_designpilot_20260710/non_oa_access_queue.csv", ["requester_id", "requested_at", "access_outcome", "obtained_file_sha256"], ["requester_id", "requested_at", "access_outcome"]),
    spec("P5_extraction", "data/interim/extractions_human.csv", ["extracted_by", "verified_by", "verification_status"], ["extracted_by", "verified_by", "verification_status"]),
    spec("P5_risk_of_bias", "data/interim/risk_of_bias.csv", ["reviewer_id", "reviewed_at", "consensus_judgment", "adjudicator_id"], ["reviewer_id", "reviewed_at", "consensus_judgment"]),
    spec("P6_grade", "research/synthesis/certainty_assessments.csv", ["status"], ["status"]),
    spec("P6_claims", "research/synthesis/claim_registry.csv", ["verified_by", "verification_status"], ["verified_by", "verification_status"]),
    spec("P6_rules", "research/synthesis/rule_registry.csv", ["reviewed_by", "validation_status"], ["reviewed_by", "validation_status"]),
    spec("P7_blind_expert", "research/validation/synthetic_scenario_blind_expert_review.csv", ["reviewer_id", "clinical_plausibility", "risk_coverage", "missing_information", "comments", "reviewed_at"], ["reviewer_id", "clinical_plausibility", "risk_coverage", "reviewed_at"]),
    spec("P7_independent_gold", "research/validation/independent_gold_scenario_authoring_queue.csv", ["author_1_id", "author_1_input_json", "author_1_expected_actions_json", "author_2_id", "author_2_input_json", "author_2_expected_actions_json", "adjudicator_id", "adjudicated_input_json", "adjudicated_expected_actions_json", "critical_failure_labels_json", "authored_at", "adjudicated_at", "gold_row_sha256"], ["author_1_id", "author_1_input_json", "author_1_expected_actions_json", "author_2_id", "author_2_input_json", "author_2_expected_actions_json", "adjudicator_id", "adjudicated_input_json", "adjudicated_expected_actions_json", "critical_failure_labels_json", "authored_at", "adjudicated_at", "gold_row_sha256"]),
] + [spec(f"P{phase}_external", f"research/review_queue/phase_{phase:02d}_external_review.csv", [], []) for phase in (1, 2, 3, 5, 6, 7, 8)]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def state(row_count: int, any_count: int, complete_count: int, required: list[str]) -> str:
    if not required:
        return "blocker_instruction"
    if row_count == 0:
        return "awaiting_upstream_rows"
    if any_count == 0:
        return "not_started"
    if complete_count == row_count:
        return "complete_candidate_requires_validation"
    return "in_progress_partial"


def main() -> int:
    queues = []
    for item in SPECS:
        path = ROOT / item["path"]
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            rows, fields = list(reader), reader.fieldnames or []
        human = [field for field in item["human"] if field in fields]
        required = [field for field in item["required"] if field in fields]
        any_count = sum(any(row.get(field, "").strip() for field in human) for row in rows) if human else 0
        complete_count = sum(all(row.get(field, "").strip() for field in required) for row in rows) if required else 0
        queues.append({"queue_id": item["queue_id"], "path": item["path"], "sha256": sha(path),
                       "size_bytes": path.stat().st_size, "row_count": len(rows),
                       "human_entry_fields": human, "minimum_completion_fields": required,
                       "rows_with_any_human_data": any_count, "rows_complete_candidate": complete_count,
                       "progress_state": state(len(rows), any_count, complete_count, required)})
    actionable = [q for q in queues if q["minimum_completion_fields"]]
    payload = {"schema_version": "1.1.0", "status": "ready_for_external_review_not_completed",
               "dependency_order": ["protocol_PRESS", "retrieval_dedup", "screening_fulltext", "extraction_RoB",
                                    "synthesis_GRADE_claim_rule", "independent_validation", "finalization"],
               "queue_count": len(queues), "total_rows": sum(q["row_count"] for q in queues),
               "rows_with_any_human_data": sum(q["rows_with_any_human_data"] for q in queues),
               "rows_complete_candidate": sum(q["rows_complete_candidate"] for q in queues),
               "all_actionable_queues_complete_candidate": bool(actionable) and all(q["progress_state"] == "complete_candidate_requires_validation" for q in actionable),
               "human_work_complete": False, "queues": queues}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"queues": len(queues), "rows": payload["total_rows"],
                      "rows_with_any_human_data": payload["rows_with_any_human_data"],
                      "rows_complete_candidate": payload["rows_complete_candidate"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
