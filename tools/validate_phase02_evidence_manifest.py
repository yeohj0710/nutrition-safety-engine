#!/usr/bin/env python3
"""Validate Phase 02 evidence bytes without closing external human gates."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "research/protocol/phase_02_evidence_manifest.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def rows(relative: str) -> list[dict[str, str]]:
    with (ROOT / relative).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    errors: list[str] = []
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    expected = {"status": "local_evidence_verified_external_gates_open",
                "final_search_allowed": False, "protocol_human_approved": False,
                "independent_press_complete": False, "registered": False}
    for key, value in expected.items():
        if manifest.get(key) != value:
            errors.append(f"manifest {key}: expected {value!r}, got {manifest.get(key)!r}")
    artifacts = manifest.get("artifacts", [])
    if manifest.get("artifact_count") != len(artifacts) or len(artifacts) != 21:
        errors.append("Phase 02 evidence artifact count mismatch")
    if len({entry.get("path") for entry in artifacts}) != len(artifacts):
        errors.append("duplicate artifact paths")
    for entry in artifacts:
        path = ROOT / entry["path"]
        if not path.is_file():
            errors.append(f"missing artifact: {entry['path']}")
        elif path.stat().st_size != entry["size_bytes"] or sha256(path) != entry["sha256"]:
            errors.append(f"artifact hash/size mismatch: {entry['path']}")
    main_press = rows("research/review_queue/PRESS_review.csv")
    korean_press = rows("research/review_queue/korean_db_PRESS_review.csv")
    if any(row.get("status") not in {"pending_external_human_review", "blocked_external"} for row in main_press):
        errors.append("main PRESS row falsely closed")
    human_fields = ("reviewer", "reviewer_id", "decision", "review_date", "reviewed_at")
    if any(any(row.get(field, "").strip() for field in human_fields) for row in korean_press):
        errors.append("Korean PRESS queue contains unverified human decisions")
    result = {"errors": errors, "artifact_count": len(artifacts),
              "main_press_rows": len(main_press), "korean_press_rows": len(korean_press),
              "phase_complete": False}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
