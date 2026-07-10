#!/usr/bin/env python3
"""Validate checksum-complete PMC locator candidates and zero human decisions."""

import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "research/fulltext/pmc_idconv_designpilot_20260710"
OUTPUT = ROOT / "data/interim/pmc_fulltext_candidates.csv"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors = []
    manifest = json.loads((RAW / "manifest.json").read_text(encoding="utf-8"))
    with OUTPUT.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    with (ROOT / "data/interim/records.csv").open(encoding="utf-8-sig", newline="") as handle:
        normalized_records = list(csv.DictReader(handle))
    with (ROOT / "data/interim/record_retrievals.csv").open(encoding="utf-8-sig", newline="") as handle:
        retrievals = list(csv.DictReader(handle))
    checksum_lines = (RAW / "checksum.sha256").read_text(encoding="utf-8").splitlines()
    for line in checksum_lines:
        expected, name = line.split("  ", 1)
        path = RAW / name
        if not path.is_file() or sha256(path) != expected:
            errors.append(f"checksum mismatch: {name}")
    if manifest.get("status") != "public_locator_proxy_not_human_fulltext_assessment":
        errors.append("locator proxy status overstated")
    if manifest.get("input_pmids") != 19609 or manifest.get("batches") != 99:
        errors.append("input/batch coverage mismatch")
    if manifest.get("raw_files") != 99 or len(checksum_lines) != 99:
        errors.append("raw response coverage mismatch")
    if manifest.get("pmc_identifier_candidates") != len(rows):
        errors.append("candidate row count mismatch")
    if manifest.get("output_sha256") != sha256(OUTPUT):
        errors.append("candidate output checksum mismatch")
    if any(row["human_fulltext_verified"] or row["human_eligibility_decision"] for row in rows):
        errors.append("unverified human full-text/eligibility values present")
    if len({row["pmid"] for row in rows}) != len(rows) or len({row["pmcid"] for row in rows}) != len(rows):
        errors.append("duplicate PMID/PMCID candidates")
    normalized_pmc = {row["pmid"]: row["pmcid"] for row in normalized_records if row["pmcid"]}
    resolved_pmc = {row["pmid"]: row["pmcid"] for row in rows}
    if normalized_pmc != resolved_pmc:
        errors.append("live PMC resolution differs from normalized PMCID set")
    candidate_record_ids = {row["record_id"] for row in rows}
    by_question = dict(sorted(Counter(
        row["question_id"] for row in retrievals if row["record_id"] in candidate_record_ids
    ).items()))
    if by_question != {"A1": 3871, "A2": 205, "B1": 219, "B2": 1215, "B3": 143}:
        errors.append("question-level PMC locator counts mismatch")
    result = {
        "errors": errors,
        "status": "complete_verified" if not errors else "failed_quality_gate",
        "input_pmids": manifest.get("input_pmids"),
        "raw_files": manifest.get("raw_files"),
        "pmc_identifier_candidates": len(rows),
        "human_fulltext_verified": 0,
        "human_eligibility_decisions": 0,
        "normalized_pmcid_exact_match": normalized_pmc == resolved_pmc,
        "question_retrieval_units_with_pmc": by_question,
    }
    (ROOT / "research/fulltext/pmc_locator_validation.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
