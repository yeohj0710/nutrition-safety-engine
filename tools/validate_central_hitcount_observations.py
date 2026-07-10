#!/usr/bin/env python3
"""Validate CENTRAL public hit counts while enforcing the export blocker."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {"A1": 1664, "A2": 111, "B1": 111, "B2": 333, "B3": 45}
STATUS = "design_pilot_hit_count_only_export_blocked_authentication"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors = []
    with (ROOT / "research/searches/central_hitcount_log.csv").open(encoding="utf-8-sig", newline="") as handle:
        log = list(csv.DictReader(handle))
    if len(log) != 5 or {row["question_id"] for row in log} != set(EXPECTED):
        errors.append("CENTRAL log must contain five unique question runs")
    for row in log:
        question = row["question_id"]
        query_path = ROOT / row["query_file"]
        run_dir = query_path.parent
        metadata_path = run_dir / "response_metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if int(row["hits_observed"]) != EXPECTED[question]:
            errors.append(f"hit count mismatch: {question}")
        if int(row["records_exported"]) != 0 or metadata.get("records_exported") != 0:
            errors.append(f"unverified CENTRAL export claimed: {question}")
        if metadata.get("full_export_complete") is not False or metadata.get("final_search_claim_allowed") is not False:
            errors.append(f"CENTRAL status overstated: {question}")
        if row["status"] != STATUS or metadata.get("status") != STATUS:
            errors.append(f"CENTRAL blocker status mismatch: {question}")
        if row["query_sha256"] != sha256(query_path) or metadata.get("query_sha256") != sha256(query_path):
            errors.append(f"CENTRAL query hash mismatch: {question}")
        checksums = (run_dir / "checksum.sha256").read_text(encoding="utf-8").splitlines()
        for line in checksums:
            expected, name = line.split("  ", 1)
            if sha256(run_dir / name) != expected:
                errors.append(f"CENTRAL checksum mismatch: {question}/{name}")
    result = {
        "errors": errors,
        "status": "hitcount_proxy_verified_export_blocked" if not errors else "failed_quality_gate",
        "runs": len(log),
        "hits_observed": sum(int(row["hits_observed"]) for row in log),
        "records_exported": sum(int(row["records_exported"]) for row in log),
        "final_search_claim_allowed": False,
    }
    (ROOT / "research/searches/central_hitcount_validation.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
