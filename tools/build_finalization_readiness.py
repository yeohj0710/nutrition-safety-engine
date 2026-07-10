#!/usr/bin/env python3
"""Build evidence-derived A-K finalization readiness without permanent false constants."""

import csv
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
    "research/audit/deployment_baseline.json", "research/thesis/checkpoints/methods_checkpoint_qa.json",
    "research/validation/local_production_smoke.json", "research/review_queue/human_handoff_manifest.json",
    "research/extraction/ai_extraction_evaluation.json", "research/validation/independent_gold_performance.json",
    "research/validation/release_readiness.json", "research/thesis/results_freeze_review.csv",
]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def csv_count(path: str) -> int:
    with (ROOT / path).open(encoding="utf-8-sig", newline="") as handle:
        return len(list(csv.DictReader(handle)))


def csv_count_where(path: str, field: str, value: str | None = None) -> int:
    with (ROOT / path).open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return sum(bool(row.get(field)) if value is None else row.get(field) == value for row in rows)


def main() -> int:
    handoff = json.loads((ROOT / "research/review_queue/human_handoff_manifest.json").read_text(encoding="utf-8"))
    ai = json.loads((ROOT / "research/extraction/ai_extraction_evaluation.json").read_text(encoding="utf-8"))
    gold = json.loads((ROOT / "research/validation/independent_gold_performance.json").read_text(encoding="utf-8"))
    release = json.loads((ROOT / "research/validation/release_readiness.json").read_text(encoding="utf-8"))
    bundle = json.loads((ROOT / "src/generated/thesis-bundle.json").read_text(encoding="utf-8"))
    with (ROOT / "research/thesis/results_freeze_review.csv").open(encoding="utf-8-sig", newline="") as handle:
        freeze_rows = list(csv.DictReader(handle))
    freeze = len(freeze_rows) == 1 and freeze_rows[0].get("status") == "frozen_validated"
    human = handoff.get("human_work_complete") is True
    independent = gold.get("gold_scenarios") == 120 and gold.get("metrics") is not None
    expert = release.get("predeploy_gates", {}).get("expert_reviews_120") is True
    engine = independent and gold.get("metrics", {}).get("determinism", {}).get("rate") == 1
    released = release.get("release_ready") is True and release.get("deployment_verified") is True
    ai_complete = ai.get("status") == "complete_human_gold_ai_runs_evaluated"
    gates = [
        {"id": "A_protocol", "status": "complete_verified" if human else "blocked_external", "reason": "human handoff aggregate including protocol/PRESS"},
        {"id": "B_search", "status": "complete_verified" if human else "blocked_external", "reason": "human handoff aggregate including final searches"},
        {"id": "C_screening", "status": "complete_verified" if human else "blocked_external", "reason": "human handoff aggregate including dedup/screening"},
        {"id": "D_extraction_rob", "status": "complete_verified" if human else "blocked_external", "reason": "human handoff aggregate including extraction/RoB"},
        {"id": "E_synthesis_grade", "status": "complete_verified" if human else "blocked_external", "reason": "human handoff aggregate including GRADE"},
        {"id": "F_ai_evaluation", "status": "complete_verified" if ai_complete else "blocked_external", "reason": "production AI evaluation status"},
        {"id": "G_claim_rule", "status": "complete_verified" if bundle["meta"]["claimCount"] > 0 and bundle["meta"]["ruleCount"] > 0 else "blocked_external", "reason": "validated thesis bundle counts"},
        {"id": "H_engine", "status": "complete_verified" if engine else "blocked_external", "reason": "120-scenario independent metrics and determinism"},
        {"id": "I_independent_validation", "status": "complete_verified" if independent and expert else "blocked_external", "reason": "independent gold plus expert review"},
        {"id": "J_thesis", "status": "complete_verified" if freeze else "blocked_external", "reason": "results/analysis freeze and department format approval"},
        {"id": "K_release_reproducibility", "status": "complete_verified" if released else "blocked_external", "reason": "validated deployment and release readiness"},
    ]
    open_count = sum(gate["status"] != "complete_verified" for gate in gates)
    ready = open_count == 0
    evidence = [{"path": name, "size_bytes": (ROOT / name).stat().st_size, "sha256": sha(ROOT / name)} for name in EVIDENCE]
    payload = {"schema_version": "1.1.0", "status": "ready_for_final_document_build" if ready else "not_ready_external_human_gates",
        "finalization_ready": ready, "project_complete": False, "results_frozen": freeze,
        "final_results_writing_allowed": ready, "final_thesis_artifacts_allowed": ready,
        "validated_deployment": released, "validated_claims": bundle["meta"]["claimCount"], "validated_rules": bundle["meta"]["ruleCount"],
        "human_screening_decisions": csv_count_where("data/interim/screening_decisions.csv", "decision"),
        "human_extractions": csv_count("data/interim/extractions_human.csv"), "rob_consensus_rows": csv_count("data/interim/risk_of_bias.csv"),
        "independent_gold_scenarios": gold.get("gold_scenarios", 0),
        "expert_reviews": csv_count_where("research/validation/synthetic_scenario_blind_expert_review.csv", "status", "complete_external_human_review_synthetic_not_gold"),
        "phase_statuses": {"01": "complete_verified", **{str(i).zfill(2): "complete_candidate" if ready else "blocked_external" for i in range(2, 9)}},
        "acceptance_gates": gates, "open_gate_count": open_count,
        "final_docx": None, "final_pdf": None, "submission_manifest": None,
        "nonfinal_methods_checkpoint": "research/thesis/checkpoints/methods_checkpoint_nonfinal.docx", "evidence": evidence}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": payload["status"], "open_gate_count": open_count, "finalization_ready": ready}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
