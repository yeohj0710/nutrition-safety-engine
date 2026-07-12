#!/usr/bin/env python3
"""Create deterministic, non-decisional reviewer batches for PubMed screening."""

import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/interim/screening_review_context.csv"
OUTPUT = ROOT / "data/interim/screening_batch_assignments.csv"
MANIFEST = ROOT / "research/screening/screening_batch_manifest.json"
BATCH_SIZE = 500


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    with SOURCE.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if len({(row["record_id"], row["question_id"]) for row in rows}) != len(rows):
        raise RuntimeError("screening context keys are not unique")
    rank = {"high": 0, "medium": 1, "low": 2, "": 3}
    ordered = sorted(rows, key=lambda row: (
        row["question_id"],
        0 if row["proxy_disagreement"].lower() == "true" else 1,
        rank.get(row["proxy_priority_band"], 4),
        row["record_id"],
    ))
    fields = ["batch_id", "batch_sequence", "record_id", "question_id", "queue_id", "proxy_disagreement", "proxy_priority_band", "decision_authority", "status"]
    generated = []
    for index, row in enumerate(ordered):
        batch = index // BATCH_SIZE + 1
        generated.append({
            "batch_id": f"PUBMED-SCREEN-{batch:03d}",
            "batch_sequence": index % BATCH_SIZE + 1,
            "record_id": row["record_id"],
            "question_id": row["question_id"],
            "queue_id": row["queue_id"],
            "proxy_disagreement": row["proxy_disagreement"],
            "proxy_priority_band": row["proxy_priority_band"],
            "decision_authority": "none",
            "status": "awaiting_external_human_screening",
        })
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(generated)
    counts = Counter(row["batch_id"] for row in generated)
    payload = {
        "schema_version": "1.0.0",
        "status": "reviewer_workload_partition_no_decision_authority",
        "batch_size": BATCH_SIZE,
        "batch_count": len(counts),
        "row_count": len(generated),
        "source_path": SOURCE.relative_to(ROOT).as_posix(),
        "source_sha256": sha(SOURCE),
        "output_path": OUTPUT.relative_to(ROOT).as_posix(),
        "output_sha256": sha(OUTPUT),
        "ordering": ["question_id", "proxy_disagreement_first", "proxy_priority_band", "record_id"],
        "batch_counts": dict(sorted(counts.items())),
        "human_decisions": 0,
        "authority_note": "Assignments only; decisions remain in screening_decisions.csv and require people.",
    }
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"rows": len(generated), "batches": len(counts), "largest": max(counts.values())}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
