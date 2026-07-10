#!/usr/bin/env python3
"""Reject any finalization claim before every upstream evidence gate closes."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "research/thesis/finalization_readiness.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors: list[str] = []
    value = json.loads(MANIFEST.read_text(encoding="utf-8"))
    false_fields = ("finalization_ready", "project_complete", "results_frozen",
                    "final_results_writing_allowed", "final_thesis_artifacts_allowed", "validated_deployment")
    for field in false_fields:
        if value.get(field) is not False:
            errors.append(f"{field} must remain false")
    zero_fields = ("validated_claims", "validated_rules", "human_screening_decisions",
                   "human_extractions", "rob_consensus_rows", "independent_gold_scenarios", "expert_reviews")
    for field in zero_fields:
        if value.get(field) != 0:
            errors.append(f"{field} must remain zero")
    phases = value.get("phase_statuses", {})
    if phases.get("01") != "complete_verified" or any(phases.get(str(i).zfill(2)) != "blocked_external" for i in range(2, 9)):
        errors.append("phase status map is overstated or incomplete")
    gates = value.get("acceptance_gates", [])
    if len(gates) != 11 or value.get("open_gate_count") != 11:
        errors.append("A-K acceptance gate coverage mismatch")
    if any(gate.get("status") == "complete_verified" for gate in gates):
        errors.append("an acceptance gate was falsely marked complete")
    for item in value.get("evidence", []):
        path = ROOT / item["path"]
        if not path.is_file() or path.stat().st_size != item["size_bytes"] or sha256(path) != item["sha256"]:
            errors.append(f"readiness evidence hash mismatch: {item['path']}")
    if any((ROOT / path).exists() for path in ("output/final/thesis.docx", "output/final/thesis.pdf")):
        errors.append("final thesis artifact exists before readiness")
    if any(value.get(field) is not None for field in ("final_docx", "final_pdf", "submission_manifest")):
        errors.append("final artifact pointer populated before readiness")
    result = {"errors": errors, "status": value.get("status"), "open_gate_count": value.get("open_gate_count"),
              "finalization_ready": value.get("finalization_ready"), "final_artifacts": False}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
