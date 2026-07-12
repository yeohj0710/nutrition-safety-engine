#!/usr/bin/env python3
"""Validate registry/KoreaMed screening context and no-decision boundary."""

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
    trials, korea = read("clinicaltrials_screening_context.csv"), read("koreamed_screening_context.csv")
    manifest = json.loads((ROOT / "research/screening/nonpubmed_screening_context_manifest.json").read_text(encoding="utf-8"))
    if len(trials) != 207 or manifest.get("clinicaltrials_rows") != 207:
        errors.append("expected 207 registry retrieval contexts")
    if len(korea) != 62 or manifest.get("koreamed_rows") != 62:
        errors.append("expected 62 KoreaMed retrieval contexts")
    if any(row["decision_authority"] != "none" or "context_only" not in row["status"] for row in trials + korea):
        errors.append("non-PubMed context contains decision authority")
    if sum(int(row["pubmed_candidate_count"]) for row in korea) != 35:
        errors.append("expected 35 KoreaMed–PubMed candidates")
    for row in korea:
        for raw in filter(None, row["candidate_pubmed_raw_files"].split("|")):
            if not (ROOT / raw).is_file():
                errors.append(f"missing PubMed raw file: {raw}")
    inputs = ("clinicaltrials_records.csv", "clinicaltrials_review_queue.csv", "koreamed_records.csv",
              "koreamed_review_queue.csv", "koreamed_pubmed_link_candidates.csv", "records.csv")
    outputs = ("clinicaltrials_screening_context.csv", "koreamed_screening_context.csv")
    if manifest.get("inputs") != {name: sha(name) for name in inputs} or manifest.get("outputs") != {name: sha(name) for name in outputs}:
        errors.append("non-PubMed context provenance mismatch")
    result = {"errors": errors, "clinicaltrials_rows": len(trials), "koreamed_rows": len(korea),
              "koreamed_pubmed_candidates": sum(int(row["pubmed_candidate_count"]) for row in korea),
              "status": "valid" if not errors else "invalid"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
