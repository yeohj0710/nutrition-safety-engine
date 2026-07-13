#!/usr/bin/env python3
"""Generate conservative agent prereview recommendations for exact duplicate candidates."""

import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))

records = {row["record_id"]: row for row in read_csv(ROOT / "data/interim/records.csv")}
candidates = read_csv(ROOT / "data/interim/duplicate_candidates.csv")
output = []
for row in candidates:
    left, right = records[row["record_id_a"]], records[row["record_id_b"]]
    same_doi = bool(left["doi"] and left["doi"] == right["doi"])
    same_year = left["year"] == right["year"]
    same_journal = left["journal"].casefold() == right["journal"].casefold()
    same_author = left["first_author"].casefold() == right["first_author"].casefold()
    if same_doi:
        decision, confidence, reason = "merge_duplicate_reports", "high", "same DOI"
    elif same_year and same_journal and same_author:
        decision, confidence, reason = "merge_duplicate_reports", "high", "same normalized title, year, journal, and first author"
    else:
        decision, confidence, reason = "retain_separate_reports", "moderate", "same title but bibliographic identity differs; preserve until human study linkage"
    output.append({
        **row,
        "recommended_decision": decision,
        "confidence": confidence,
        "recommendation_reason": reason,
        "record_a": {key: left[key] for key in ("pmid", "doi", "title", "first_author", "year", "journal", "url")},
        "record_b": {key: right[key] for key in ("pmid", "doi", "title", "first_author", "year", "journal", "url")},
    })

payload = {
    "schema_version": "1.0.0",
    "authority": "agent_prereview_only",
    "human_final_decision_required": True,
    "candidate_count": len(output),
    "recommendation_counts": dict(Counter(item["recommended_decision"] for item in output)),
    "method": "Exact DOI merges; otherwise identical title/year/journal/first-author merges; bibliographically different same-title reports remain separate pending study linkage.",
    "candidates": output,
}
path = ROOT / "research/review_queue/dedup_agent_prereview.json"
path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: payload[key] for key in ("candidate_count", "recommendation_counts")}, ensure_ascii=False))
