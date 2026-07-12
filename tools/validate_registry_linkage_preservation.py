#!/usr/bin/env python3
"""Prove populated registry-linkage decisions survive regeneration."""

import csv
import tempfile
from pathlib import Path

import build_registry_linkage_decisions as target


def main() -> int:
    tests = {}
    base = {field: "" for field in target.FIELDS}
    base.update({"link_candidate_id": "L1", "registry_record_id": "R1", "nct_id": "N1",
                 "pubmed_record_id": "P1", "pmid": "1", "reference_type": "RESULT",
                 "decision": "same_study_report", "study_id": "S1", "report_id": "RP1", "reason": "same trial",
                 "verified_by": "human", "verified_at": "2026-07-12", "status": "complete_candidate_requires_validation"})
    generated = [dict(base, decision="", study_id="", report_id="", reason="", verified_by="", verified_at="", status="pending_external_human_review")]
    with tempfile.TemporaryDirectory() as directory:
        old = target.OUTPUT; target.OUTPUT = Path(directory) / "queue.csv"
        try:
            with target.OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=target.FIELDS, lineterminator="\n"); writer.writeheader(); writer.writerow(base)
            before = target.OUTPUT.read_bytes()
            tests["human_bytes_preserved"] = target.write_or_preserve(generated) == "preserved_existing_human_data" and target.OUTPUT.read_bytes() == before
            try:
                target.write_or_preserve([dict(generated[0], pmid="2")]); tests["source_drift_rejected"] = False
            except ValueError:
                tests["source_drift_rejected"] = target.OUTPUT.read_bytes() == before
        finally:
            target.OUTPUT = old
    errors = [] if all(tests.values()) else ["registry linkage preservation failed"]
    print({"errors": errors, "tests": tests})
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
