#!/usr/bin/env python3
"""Build complete title/abstract context for human screening without decisions."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/interim"
OUTPUT = DATA / "screening_review_context.csv"
MANIFEST = ROOT / "research/screening/screening_review_context_manifest.json"
INPUT_NAMES = ("records.csv", "screening_review_queue.csv", "screening_proxy_sensitivity_first.csv",
               "screening_proxy_structured_conservative.csv")
FIELDS = ["queue_id", "record_id", "question_id", "title", "abstract", "authors", "year", "journal",
          "publication_types", "doi", "pmid", "pubmed_url", "raw_file", "proxy_priority_band",
          "proxy_disagreement", "sensitivity_recommendation", "sensitivity_score", "sensitivity_reason_codes",
          "conservative_recommendation", "conservative_score", "conservative_reason_codes",
          "decision_authority", "requires_human_review", "status"]


def read(name: str) -> list[dict[str, str]]:
    with (DATA / name).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    records = {row["record_id"]: row for row in read("records.csv")}
    queue = read("screening_review_queue.csv")
    sensitivity = {(row["record_id"], row["question_id"]): row for row in read("screening_proxy_sensitivity_first.csv")}
    conservative = {(row["record_id"], row["question_id"]): row for row in read("screening_proxy_structured_conservative.csv")}
    rows = []
    for item in queue:
        key = (item["record_id"], item["question_id"])
        record, first, second = records[item["record_id"]], sensitivity[key], conservative[key]
        rows.append({"queue_id": item["queue_id"], "record_id": item["record_id"], "question_id": item["question_id"],
                     "title": record["title"], "abstract": record["abstract"], "authors": record["authors"],
                     "year": record["year"], "journal": record["journal"],
                     "publication_types": record["publication_types"], "doi": record["doi"], "pmid": record["pmid"],
                     "pubmed_url": record["url"], "raw_file": record["raw_file"],
                     "proxy_priority_band": item["proxy_priority_band"], "proxy_disagreement": item["proxy_disagreement"],
                     "sensitivity_recommendation": first["recommendation"], "sensitivity_score": first["priority_score"],
                     "sensitivity_reason_codes": first["reason_codes"],
                     "conservative_recommendation": second["recommendation"], "conservative_score": second["priority_score"],
                     "conservative_reason_codes": second["reason_codes"], "decision_authority": "none",
                     "requires_human_review": "true", "status": "context_only_not_a_screening_decision"})
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n"); writer.writeheader(); writer.writerows(rows)
    payload = {"schema_version": "1.0.0", "status": "synthetic_proxy_context_no_decision_authority",
               "row_count": len(rows), "abstract_present": sum(bool(row["abstract"].strip()) for row in rows),
               "proxy_disagreements": sum(row["proxy_disagreement"].lower() == "true" for row in rows),
               "inputs": {name: sha(DATA / name) for name in INPUT_NAMES},
               "output": {"path": OUTPUT.relative_to(ROOT).as_posix(), "sha256": sha(OUTPUT)}}
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
