#!/usr/bin/env python3
"""Build a hash-bound manifest for locally provable Phase 02 evidence."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "research/protocol/phase_02_evidence_manifest.json"
PATHS = [
    "research/approvals/research_progress_approval.json",
    "research/protocol/protocol-v1.0.md", "research/protocol/amendments.csv",
    "research/protocol/access_matrix.csv", "research/protocol/outcome_priority.csv",
    "research/protocol/workload_forecast.csv", "research/protocol/human_ai_role_matrix.md",
    "research/protocol/registration_status.md", "research/searches/sentinel_set.csv",
    "research/searches/pubmed_pilot_20260710.json", "research/searches/central_hitcount_log.csv",
    "research/searches/clinicaltrials_search_log.csv",
    "research/searches/koreamed_designpilot_20260710/summary.json",
    "research/searches/korean_db_split_designpilot_20260710/summary.json",
    "research/review_queue/PRESS_review.csv", "research/review_queue/korean_db_PRESS_review.csv",
    "research/approvals/press_review_approval.json",
    "research/review_queue/phase_02_external_review.csv",
] + [f"research/searches/search_strategy_drafts/{q}_pubmed.txt" for q in ("A1", "A2", "B1", "B2", "B3")]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    entries = []
    for relative in sorted(PATHS):
        path = ROOT / relative
        if not path.is_file():
            raise FileNotFoundError(relative)
        entries.append({"path": relative, "size_bytes": path.stat().st_size, "sha256": sha256(path)})
    payload = {"schema_version": "1.0.0", "phase": "02_protocol_and_search_design",
               "status": "local_evidence_verified_external_gates_open",
               "final_search_allowed": False, "protocol_execution_approved": True,
               "protocol_approver_identity_captured": False,
               "independent_press_complete": False, "registered": False,
               "artifact_count": len(entries), "artifacts": entries}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": OUTPUT.relative_to(ROOT).as_posix(), "artifact_count": len(entries)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
