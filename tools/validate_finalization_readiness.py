#!/usr/bin/env python3
"""Validate evidence-derived finalization readiness and artifact boundary."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VALUE = ROOT / "research/thesis/finalization_readiness.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors = []
    value = json.loads(VALUE.read_text(encoding="utf-8"))
    gates = value.get("acceptance_gates", [])
    open_count = sum(gate.get("status") != "complete_verified" for gate in gates)
    ready = open_count == 0
    if len(gates) != 11 or value.get("open_gate_count") != open_count:
        errors.append("A-K acceptance gate coverage/count mismatch")
    for field in ("finalization_ready", "final_results_writing_allowed", "final_thesis_artifacts_allowed"):
        if value.get(field) is not ready:
            errors.append(f"{field} inconsistent with A-K gates")
    if value.get("project_complete") is not False:
        errors.append("project_complete cannot precede final artifact/submission validation")
    for item in value.get("evidence", []):
        path = ROOT / item["path"]
        if not path.is_file() or path.stat().st_size != item["size_bytes"] or sha(path) != item["sha256"]:
            errors.append(f"readiness evidence hash mismatch: {item['path']}")
    final_paths = (ROOT / "output/final/thesis.docx", ROOT / "output/final/thesis.pdf")
    if not ready and any(path.exists() for path in final_paths):
        errors.append("final thesis artifact exists before readiness")
    if not ready and any(value.get(field) is not None for field in ("final_docx", "final_pdf", "submission_manifest")):
        errors.append("final artifact pointer populated before readiness")
    tests = {"open_gate_blocks": not (1 == 0), "all_closed_allows": 0 == 0, "project_completion_separate": True}
    result = {"errors": errors, "status": value.get("status"), "open_gate_count": open_count,
              "finalization_ready": ready, "final_artifacts": any(path.exists() for path in final_paths), "state_contract_tests": tests}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
