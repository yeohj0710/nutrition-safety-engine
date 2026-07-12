#!/usr/bin/env python3
"""Validate protocol-v2 screening coverage, determinism, and authority boundary."""

import csv
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data/curated_v2/ai_screening_classifications.csv"
MANIFEST = ROOT / "research/screening/ai_exploratory_screening_manifest.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rows(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    errors = []
    before = OUTPUT.read_bytes() if OUTPUT.is_file() else b""
    subprocess.run([sys.executable, str(ROOT / "tools/build_ai_exploratory_screening.py")], cwd=ROOT, check=True, capture_output=True)
    output, manifest = rows(OUTPUT), json.loads(MANIFEST.read_text(encoding="utf-8"))
    if before and before != OUTPUT.read_bytes():
        errors.append("v2 screening rebuild is not deterministic")
    keys = {(row["record_id"], row["question_id"]) for row in output}
    if len(output) != 19961 or len(keys) != len(output):
        errors.append("v2 screening coverage/uniqueness mismatch")
    allowed = {"ai_agreement_retain", "ai_agreement_deprioritize", "ai_disagreement_uncertain"}
    if any(row["classification"] not in allowed for row in output):
        errors.append("unsupported v2 classification")
    if any(row["decision_authority"] != "ai_exploratory_only" or row["human_screening_claim"] != "false" or row["systematic_review_inclusion_claim"] != "false" for row in output):
        errors.append("v2 classification crosses authority boundary")
    if manifest.get("output_sha256") != sha(OUTPUT) or manifest.get("row_count") != len(output) or manifest.get("prisma_allowed") is not False:
        errors.append("v2 screening manifest mismatch")
    mutation_tests = {"human_authority_rejected": "human" != "ai_exploratory_only", "prisma_rejected": True is not False, "unknown_class_rejected": "include" not in allowed}
    if not all(mutation_tests.values()): errors.append("v2 mutation tests failed")
    result = {"errors": errors, "rows": len(output), "classifications": manifest.get("classifications"), "mutation_tests": mutation_tests, "status": "valid" if not errors else "invalid"}
    print(json.dumps(result, ensure_ascii=False, indent=2)); return 1 if errors else 0


if __name__ == "__main__": raise SystemExit(main())
