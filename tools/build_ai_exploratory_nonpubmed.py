#!/usr/bin/env python3
"""Integrate registry and KoreaMed records into protocol-v2 exploratory mapping."""

import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "clinicaltrials": ROOT / "data/interim/clinicaltrials_screening_context.csv",
    "koreamed": ROOT / "data/interim/koreamed_screening_context.csv",
}
OUTPUT = ROOT / "data/curated_v2/ai_nonpubmed_classifications.csv"
MANIFEST = ROOT / "research/screening/ai_exploratory_nonpubmed_manifest.json"


def read(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as handle: return list(csv.DictReader(handle))


def sha(path: Path): return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    rows = []
    for source, path in SOURCES.items():
        for item in read(path):
            risk = item.get("known_query_risk", "")
            limitation = item.get("native_export_status", "")
            rows.append({
                "source": source, "record_id": item["record_id"], "question_id": item["question_id"],
                "provider_id": item.get("nct_id") or item.get("kmid"),
                "title": item.get("brief_title") or item.get("title"),
                "classification": "ai_unranked_source_candidate",
                "reason": "retrieved_by_preserved_source_query; no dual-profile classifier available",
                "known_query_risk": risk, "source_limitation": limitation,
                "source_url": item.get("registry_url") or item.get("koreamed_url"),
                "decision_authority": "ai_exploratory_only", "human_screening_claim": "false",
                "systematic_review_inclusion_claim": "false", "status": "protocol_v2_ai_exploratory_unranked",
            })
    rows.sort(key=lambda row: (row["source"], row["question_id"], row["record_id"]))
    OUTPUT.parent.mkdir(exist_ok=True)
    fields = list(rows[0])
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows(rows)
    counts = Counter(row["source"] for row in rows)
    payload = {"schema_version": "1.0.0", "protocol_version": "2.0-ai-exploratory",
               "status": "complete_unranked_nonpubmed_exploratory_mapping", "row_count": len(rows),
               "source_counts": dict(sorted(counts.items())), "input_sha256": {k: sha(v) for k, v in SOURCES.items()},
               "output_path": OUTPUT.relative_to(ROOT).as_posix(), "output_sha256": sha(OUTPUT),
               "classification": "ai_unranked_source_candidate", "human_decisions": 0, "prisma_allowed": False}
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"rows": len(rows), "sources": payload["source_counts"]}, ensure_ascii=False)); return 0


if __name__ == "__main__": raise SystemExit(main())
