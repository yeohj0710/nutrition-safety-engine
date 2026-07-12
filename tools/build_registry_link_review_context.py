#!/usr/bin/env python3
"""Build paired ClinicalTrials.gov–PubMed context without making study-link decisions."""

import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUTS = {
    "links": ROOT / "data/interim/registry_report_link_candidates.csv",
    "registry": ROOT / "data/interim/clinicaltrials_records.csv",
    "retrievals": ROOT / "data/interim/clinicaltrials_retrievals.csv",
    "pubmed": ROOT / "data/interim/records.csv",
}
OUTPUT = ROOT / "data/interim/registry_link_review_context.csv"
MANIFEST = ROOT / "research/searches/registry_link_review_context_manifest.json"
FIELDS = ["link_candidate_id", "review_priority", "reference_type", "nct_id", "registry_record_id",
          "registry_question_ids", "registry_search_run_ids", "brief_title", "official_title", "overall_status",
          "study_type", "phases", "enrollment", "conditions", "interventions", "lead_sponsor", "registry_url",
          "registry_reference_citation", "registry_raw_file",
          "pmid", "pubmed_record_id", "pubmed_title", "pubmed_first_author", "pubmed_year", "pubmed_journal",
          "pubmed_doi", "pubmed_url", "pubmed_raw_file", "pubmed_in_search_corpus", "status"]


def read(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    links = read(INPUTS["links"])
    registry = {row["record_id"]: row for row in read(INPUTS["registry"])}
    pubmed = {row["record_id"]: row for row in read(INPUTS["pubmed"])}
    runs: dict[str, set[str]] = defaultdict(set)
    for row in read(INPUTS["retrievals"]):
        runs[row["record_id"]].add(row["search_run_id"])
    reference_context: dict[tuple[str, str, str], tuple[str, str]] = {}
    for page_path in sorted((ROOT / "research/searches").glob("*/clinicaltrials/ctgov_*_designpilot_20260710/page_*.json")):
        page = json.loads(page_path.read_text(encoding="utf-8"))
        for study in page.get("studies", []):
            protocol = study.get("protocolSection", {})
            nct_id = protocol.get("identificationModule", {}).get("nctId", "")
            for reference in protocol.get("referencesModule", {}).get("references", []):
                key = (nct_id, str(reference.get("pmid", "")).strip(), reference.get("type", ""))
                value = (reference.get("citation", ""), page_path.relative_to(ROOT).as_posix())
                if key[1] and key in reference_context and reference_context[key][0] != value[0]:
                    raise ValueError(f"conflicting registry reference citation: {key}")
                if key[1]:
                    reference_context[key] = min(reference_context.get(key, value), value, key=lambda item: item[1])
    rows = []
    priorities = {"RESULT": "critical_result_reference", "DERIVED": "high_derived_reference",
                  "BACKGROUND": "manual_background_reference"}
    for link in links:
        trial = registry[link["registry_record_id"]]
        article = pubmed.get(link["pubmed_record_id"], {})
        citation, registry_raw = reference_context[(link["nct_id"], link["pmid"], link["reference_type"])]
        row = {"link_candidate_id": link["link_candidate_id"], "review_priority": priorities[link["reference_type"]],
               "reference_type": link["reference_type"], "nct_id": link["nct_id"],
               "registry_record_id": link["registry_record_id"], "registry_question_ids": trial["question_ids"],
               "registry_search_run_ids": "|".join(sorted(runs[trial["record_id"]])),
               "registry_url": trial["url"], "pmid": link["pmid"], "pubmed_record_id": link["pubmed_record_id"],
               "registry_reference_citation": citation, "registry_raw_file": registry_raw,
               "pubmed_title": article.get("title", ""), "pubmed_first_author": article.get("first_author", ""),
               "pubmed_year": article.get("year", ""), "pubmed_journal": article.get("journal", ""),
               "pubmed_doi": article.get("doi", ""),
               "pubmed_url": article.get("url", f"https://pubmed.ncbi.nlm.nih.gov/{link['pmid']}/"),
               "pubmed_raw_file": article.get("raw_file", ""), "pubmed_in_search_corpus": str(bool(article)).lower(),
               "status": "context_only_no_linkage_decision"}
        for field in ("brief_title", "official_title", "overall_status", "study_type", "phases", "enrollment",
                      "conditions", "interventions", "lead_sponsor"):
            row[field] = trial[field]
        rows.append(row)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n"); writer.writeheader(); writer.writerows(rows)
    counts = {value: sum(row["reference_type"] == value for row in rows) for value in ("RESULT", "DERIVED", "BACKGROUND")}
    payload = {"schema_version": "1.0.0", "status": "synthetic_proxy_context_no_linkage_authority",
               "candidate_count": len(links), "output_rows": len(rows), "reference_types": counts,
               "pubmed_in_search_corpus": sum(row["pubmed_in_search_corpus"] == "true" for row in rows),
               "inputs": {path.name: sha(path) for path in INPUTS.values()},
               "output": {"path": OUTPUT.relative_to(ROOT).as_posix(), "sha256": sha(OUTPUT)}}
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
