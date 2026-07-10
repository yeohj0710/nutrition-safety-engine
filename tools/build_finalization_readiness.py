#!/usr/bin/env python3
"""Build an evidence-bound, truthful finalization readiness assessment."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "research/thesis/finalization_readiness.json"
EVIDENCE = [
    "research/audit/phase_01_exit_criteria.md", "research/protocol/phase_02_exit_criteria.md",
    "research/searches/phase_03_exit_criteria.md", "research/screening/phase_04_exit_criteria.md",
    "research/extraction/phase_05_exit_criteria.md", "research/synthesis/phase_06_exit_criteria.md",
    "research/validation/phase_07_exit_criteria.md", "research/thesis/phase_08_exit_criteria.md",
    "research/audit/deployment_baseline.json",
    "research/thesis/checkpoints/methods_checkpoint_qa.json",
    "research/validation/local_production_smoke.json",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    evidence = [{"path": name, "size_bytes": (ROOT / name).stat().st_size, "sha256": sha256(ROOT / name)}
                for name in EVIDENCE]
    gates = [
        {"id": "A_protocol", "status": "blocked_external", "reason": "dated protocol approval and registration absent"},
        {"id": "B_search", "status": "blocked_external", "reason": "PRESS and licensed final searches absent"},
        {"id": "C_screening", "status": "blocked_external", "reason": "human screening and deduplication decisions absent"},
        {"id": "D_extraction_rob", "status": "blocked_external", "reason": "included reports, verified extraction, and RoB absent"},
        {"id": "E_synthesis_grade", "status": "blocked_external", "reason": "verified synthesis and GRADE rows absent"},
        {"id": "F_ai_evaluation", "status": "blocked_external", "reason": "frozen human gold and actual AI runs absent"},
        {"id": "G_claim_rule", "status": "blocked_external", "reason": "production validated claims and rules absent"},
        {"id": "H_engine", "status": "pass_software_only", "reason": "deterministic matcher/build pass; clinical validation absent"},
        {"id": "I_independent_validation", "status": "blocked_external", "reason": "independently authored/adjudicated gold and experts absent"},
        {"id": "J_thesis", "status": "blocked_external", "reason": "results freeze and department format absent; final document prohibited"},
        {"id": "K_release_reproducibility", "status": "blocked_external", "reason": "validated deployment, release tag, and final manifest absent"},
    ]
    payload = {
        "schema_version": "1.0.0", "status": "not_ready_external_human_gates",
        "finalization_ready": False, "project_complete": False, "results_frozen": False,
        "final_results_writing_allowed": False, "final_thesis_artifacts_allowed": False,
        "validated_deployment": False, "validated_claims": 0, "validated_rules": 0,
        "human_screening_decisions": 0, "human_extractions": 0, "rob_consensus_rows": 0,
        "independent_gold_scenarios": 0, "expert_reviews": 0,
        "phase_statuses": {"01": "complete_verified", "02": "blocked_external", "03": "blocked_external",
                           "04": "blocked_external", "05": "blocked_external", "06": "blocked_external",
                           "07": "blocked_external", "08": "blocked_external"},
        "acceptance_gates": gates, "open_gate_count": sum(g["status"] != "complete_verified" for g in gates),
        "final_docx": None, "final_pdf": None, "submission_manifest": None,
        "nonfinal_methods_checkpoint": "research/thesis/checkpoints/methods_checkpoint_nonfinal.docx",
        "evidence": evidence,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": payload["status"], "open_gate_count": payload["open_gate_count"],
                      "finalization_ready": False}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
