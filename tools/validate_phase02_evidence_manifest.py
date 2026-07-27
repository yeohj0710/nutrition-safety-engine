#!/usr/bin/env python3
"""Validate Phase 02 evidence bytes without closing external human gates."""

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from phase02_evidence_bytes import canonical_sha256, canonical_size
MANIFEST = ROOT / "research/protocol/phase_02_evidence_manifest.json"


def rows(relative: str) -> list[dict[str, str]]:
    with (ROOT / relative).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    errors: list[str] = []
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    expected = {"status": "local_evidence_verified_external_gates_open",
                "final_search_allowed": False, "protocol_execution_approved": True,
                "protocol_approver_identity_captured": False,
                "independent_press_complete": False, "registered": False}
    if manifest.get("hash_method") != "sha256_over_canonical_bytes":
        errors.append("manifest hash_method is not sha256_over_canonical_bytes")
    for key, value in expected.items():
        if manifest.get(key) != value:
            errors.append(f"manifest {key}: expected {value!r}, got {manifest.get(key)!r}")
    artifacts = manifest.get("artifacts", [])
    if manifest.get("artifact_count") != len(artifacts) or len(artifacts) != 23:
        errors.append("Phase 02 evidence artifact count mismatch")
    if len({entry.get("path") for entry in artifacts}) != len(artifacts):
        errors.append("duplicate artifact paths")
    for entry in artifacts:
        path = ROOT / entry["path"]
        if not path.is_file():
            errors.append(f"missing artifact: {entry['path']}")
        elif (
            canonical_size(path) != entry["size_bytes"]
            or canonical_sha256(path) != entry["sha256"]
        ):
            errors.append(f"artifact hash/size mismatch: {entry['path']}")
    main_press = rows("research/review_queue/PRESS_review.csv")
    korean_press = rows("research/review_queue/korean_db_PRESS_review.csv")
    allowed_statuses = {"pending_external_human_review", "in_progress_external_human_review",
                        "complete_candidate_requires_validation", "blocked_external"}
    if any(row.get("status") not in allowed_statuses for row in main_press + korean_press):
        errors.append("PRESS row has unsupported review status")
    result = {"errors": errors, "artifact_count": len(artifacts),
              "main_press_rows": len(main_press), "korean_press_rows": len(korean_press),
              "phase_complete": False}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
