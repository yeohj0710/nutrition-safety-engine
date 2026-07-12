#!/usr/bin/env python3
"""Validate duplicate-review context coverage, provenance, and no-decision boundary."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def rows(path: str) -> list[dict[str, str]]:
    with (ROOT / path).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def digest(path: str) -> str:
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def main() -> int:
    errors = []
    candidates = rows("data/interim/duplicate_candidates.csv")
    context = rows("data/interim/duplicate_review_context.csv")
    records = {row["record_id"]: row for row in rows("data/interim/records.csv")}
    manifest = json.loads((ROOT / "research/searches/duplicate_review_context_manifest.json").read_text(encoding="utf-8"))
    if [row["candidate_id"] for row in context] != [row["candidate_id"] for row in candidates]:
        errors.append("candidate coverage/order mismatch")
    if any(row["status"] != "context_only_no_decision" for row in context):
        errors.append("context contains decision authority")
    for row in context:
        for suffix in ("a", "b"):
            source = records.get(row[f"record_id_{suffix}"])
            if source is None or any(row[f"{field}_{suffix}"] != source[field] for field in
                                     ("pmid", "doi", "title", "first_author", "year", "journal", "raw_file")):
                errors.append(f"{row['candidate_id']}: record {suffix} context mismatch")
                continue
            if not (ROOT / source["raw_file"]).is_file():
                errors.append(f"{row['candidate_id']}: raw file missing for record {suffix}")
    if manifest.get("status") != "synthetic_proxy_context_no_decision_authority":
        errors.append("manifest boundary missing")
    expected = {"records.csv": digest("data/interim/records.csv"),
                "duplicate_candidates.csv": digest("data/interim/duplicate_candidates.csv")}
    if manifest.get("inputs") != expected or manifest.get("output", {}).get("sha256") != digest("data/interim/duplicate_review_context.csv"):
        errors.append("context provenance mismatch")
    if manifest.get("output_rows") != len(context) or len(context) != 342:
        errors.append("expected 342 context rows")
    result = {"errors": errors, "rows": len(context), "status": "valid" if not errors else "invalid"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
