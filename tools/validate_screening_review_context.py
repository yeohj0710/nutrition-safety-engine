#!/usr/bin/env python3
"""Validate screening context coverage, source fidelity, and no-decision boundary."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/interim"


def read(name: str) -> list[dict[str, str]]:
    with (DATA / name).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sha(name: str) -> str:
    return hashlib.sha256((DATA / name).read_bytes()).hexdigest()


def main() -> int:
    errors = []
    context, queue = read("screening_review_context.csv"), read("screening_review_queue.csv")
    records = {row["record_id"]: row for row in read("records.csv")}
    manifest = json.loads((ROOT / "research/screening/screening_review_context_manifest.json").read_text(encoding="utf-8"))
    if [row["queue_id"] for row in context] != [row["queue_id"] for row in queue]:
        errors.append("screening queue coverage/order mismatch")
    if len(context) != 19961 or manifest.get("row_count") != 19961:
        errors.append("expected 19,961 retrieval contexts")
    if any(row["decision_authority"] != "none" or row["status"] != "context_only_not_a_screening_decision" for row in context):
        errors.append("screening context contains decision authority")
    for row in context:
        source = records.get(row["record_id"])
        if source is None or any(row[target] != source[source_field] for target, source_field in
                                 (("title", "title"), ("abstract", "abstract"), ("pmid", "pmid"),
                                  ("doi", "doi"), ("raw_file", "raw_file"))):
            errors.append(f"{row['queue_id']}: record context mismatch")
            break
        if not (ROOT / row["raw_file"]).is_file():
            errors.append(f"{row['queue_id']}: raw XML missing")
            break
    input_names = ("records.csv", "screening_review_queue.csv", "screening_proxy_sensitivity_first.csv",
                   "screening_proxy_structured_conservative.csv")
    if manifest.get("inputs") != {name: sha(name) for name in input_names} or manifest.get("output", {}).get("sha256") != sha("screening_review_context.csv"):
        errors.append("screening context provenance mismatch")
    result = {"errors": errors, "rows": len(context), "abstract_present": sum(bool(row["abstract"].strip()) for row in context),
              "status": "valid" if not errors else "invalid"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
