#!/usr/bin/env python3
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "data/interim/clinicaltrials_retrievals.csv"
target = ROOT / "data/interim/clinicaltrials_review_queue.csv"

with source.open(encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))

fields = [
    "retrieval_id", "record_id", "question_id", "provider_id", "source_status",
    "known_query_risk", "reviewer_1_id", "reviewer_1_decision", "reviewer_1_reason",
    "reviewer_2_id", "reviewer_2_decision", "reviewer_2_reason", "adjudicator_id",
    "final_decision", "final_reason", "full_text_status", "notes",
]
with target.open("w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    for row in rows:
        writer.writerow({
            "retrieval_id": row["retrieval_id"],
            "record_id": row["record_id"],
            "question_id": row["question_id"],
            "provider_id": row["provider_id"],
            "source_status": row["status"],
            "known_query_risk": "vitamin K antagonist lexical false positive" if row["question_id"] == "A1" else "",
        })

print(f"wrote {len(rows)} undecided rows to {target.relative_to(ROOT)}")
