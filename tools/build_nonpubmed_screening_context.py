#!/usr/bin/env python3
"""Build source context for registry and KoreaMed human screening queues."""

import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/interim"
MANIFEST = ROOT / "research/screening/nonpubmed_screening_context_manifest.json"


def read(name: str) -> list[dict[str, str]]:
    with (DATA / name).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write(name: str, fields: list[str], rows: list[dict[str, str]]) -> Path:
    path = DATA / name
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n"); writer.writeheader(); writer.writerows(rows)
    return path


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    trial_records = {row["record_id"]: row for row in read("clinicaltrials_records.csv")}
    trial_rows = []
    trial_fields = ["retrieval_id", "record_id", "question_id", "nct_id", "brief_title", "official_title",
                    "overall_status", "study_type", "phases", "enrollment", "conditions", "interventions",
                    "lead_sponsor", "start_date", "completion_date", "has_results", "registry_url",
                    "known_query_risk", "decision_authority", "status"]
    for item in read("clinicaltrials_review_queue.csv"):
        record = trial_records[item["record_id"]]
        row = {"retrieval_id": item["retrieval_id"], "record_id": item["record_id"],
               "question_id": item["question_id"], "nct_id": record["nct_id"], "registry_url": record["url"],
               "known_query_risk": item["known_query_risk"], "decision_authority": "none",
               "status": "context_only_not_a_screening_decision"}
        for field in ("brief_title", "official_title", "overall_status", "study_type", "phases", "enrollment",
                      "conditions", "interventions", "lead_sponsor", "start_date", "completion_date", "has_results"):
            row[field] = record[field]
        trial_rows.append(row)
    trial_path = write("clinicaltrials_screening_context.csv", trial_fields, trial_rows)

    pubmed = {row["record_id"]: row for row in read("records.csv")}
    links: dict[str, list[dict[str, str]]] = defaultdict(list)
    for link in read("koreamed_pubmed_link_candidates.csv"):
        links[link["koreamed_record_id"]].append(link)
    korea_records = {row["record_id"]: row for row in read("koreamed_records.csv")}
    korea_rows = []
    korea_fields = ["record_id", "kmid", "question_id", "title", "koreamed_url", "pubmed_candidate_count",
                    "candidate_pmids", "candidate_pubmed_titles", "candidate_pubmed_raw_files",
                    "native_export_status", "decision_authority", "status"]
    for item in read("koreamed_review_queue.csv"):
        record = korea_records[item["record_id"]]
        candidates = sorted(links[item["record_id"]], key=lambda row: int(row["pmid"]))
        articles = [pubmed[link["pubmed_record_id"]] for link in candidates]
        korea_rows.append({"record_id": item["record_id"], "kmid": item["kmid"], "question_id": item["question_id"],
                           "title": record["title"], "koreamed_url": record["url"],
                           "pubmed_candidate_count": str(len(candidates)),
                           "candidate_pmids": "|".join(link["pmid"] for link in candidates),
                           "candidate_pubmed_titles": " || ".join(article["title"] for article in articles),
                           "candidate_pubmed_raw_files": "|".join(article["raw_file"] for article in articles),
                           "native_export_status": item["source_status"], "decision_authority": "none",
                           "status": "context_only_not_a_screening_or_linkage_decision"})
    korea_path = write("koreamed_screening_context.csv", korea_fields, korea_rows)

    inputs = ("clinicaltrials_records.csv", "clinicaltrials_review_queue.csv", "koreamed_records.csv",
              "koreamed_review_queue.csv", "koreamed_pubmed_link_candidates.csv", "records.csv")
    payload = {"schema_version": "1.0.0", "status": "synthetic_proxy_context_no_decision_authority",
               "clinicaltrials_rows": len(trial_rows), "koreamed_rows": len(korea_rows),
               "koreamed_pubmed_candidates": sum(int(row["pubmed_candidate_count"]) for row in korea_rows),
               "inputs": {name: sha(DATA / name) for name in inputs},
               "outputs": {trial_path.name: sha(trial_path), korea_path.name: sha(korea_path)}}
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
