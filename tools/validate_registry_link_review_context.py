#!/usr/bin/env python3
"""Validate registry–PubMed review context coverage and source provenance."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> list[dict[str, str]]:
    with (ROOT / relative).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sha(relative: str) -> str:
    return hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()


def main() -> int:
    errors = []
    links = read("data/interim/registry_report_link_candidates.csv")
    context = read("data/interim/registry_link_review_context.csv")
    manifest = json.loads((ROOT / "research/searches/registry_link_review_context_manifest.json").read_text(encoding="utf-8"))
    if [row["link_candidate_id"] for row in context] != [row["link_candidate_id"] for row in links]:
        errors.append("link candidate coverage/order mismatch")
    if len(context) != 500 or manifest.get("output_rows") != 500:
        errors.append("expected 500 context rows")
    if any(row["status"] != "context_only_no_linkage_decision" for row in context):
        errors.append("context contains linkage authority")
    expected_inputs = {name: sha("data/interim/" + name) for name in
                       ("registry_report_link_candidates.csv", "clinicaltrials_records.csv",
                        "clinicaltrials_retrievals.csv", "records.csv")}
    if manifest.get("inputs") != expected_inputs or manifest.get("output", {}).get("sha256") != sha("data/interim/registry_link_review_context.csv"):
        errors.append("context provenance mismatch")
    if any(not (ROOT / row["registry_raw_file"]).is_file() or not row["registry_reference_citation"].strip() for row in context):
        errors.append("one or more registry references lack raw citation provenance")
    if any(row["pubmed_in_search_corpus"] == "true" and not (ROOT / row["pubmed_raw_file"]).is_file() for row in context):
        errors.append("one or more in-corpus PubMed raw files missing")
    result = {"errors": errors, "rows": len(context), "status": "valid" if not errors else "invalid"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
