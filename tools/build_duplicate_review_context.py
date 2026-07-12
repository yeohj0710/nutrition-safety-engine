#!/usr/bin/env python3
"""Build source-bound context for human duplicate review without making decisions."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECORDS = ROOT / "data/interim/records.csv"
CANDIDATES = ROOT / "data/interim/duplicate_candidates.csv"
OUTPUT = ROOT / "data/interim/duplicate_review_context.csv"
MANIFEST = ROOT / "research/searches/duplicate_review_context_manifest.json"
FIELDS = [
    "candidate_id", "candidate_reasons", "review_priority",
    "record_id_a", "pmid_a", "doi_a", "title_a", "first_author_a", "year_a", "journal_a", "raw_file_a",
    "record_id_b", "pmid_b", "doi_b", "title_b", "first_author_b", "year_b", "journal_b", "raw_file_b",
    "same_doi", "same_normalized_title", "same_first_author", "same_year", "status",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    records = {row["record_id"]: row for row in read_csv(RECORDS)}
    candidates = read_csv(CANDIDATES)
    rows = []
    for candidate in candidates:
        a = records[candidate["record_id_a"]]
        b = records[candidate["record_id_b"]]
        same_doi = bool(a["doi"] and a["doi"] == b["doi"])
        same_title = bool(a["normalized_title"] and a["normalized_title"] == b["normalized_title"])
        same_author = bool(a["first_author"] and a["first_author"] == b["first_author"])
        same_year = bool(a["year"] and a["year"] == b["year"])
        priority = "critical_exact_doi" if same_doi else (
            "high_title_author_year" if same_title and same_author and same_year else "manual_title_collision_review"
        )
        row = {"candidate_id": candidate["candidate_id"], "candidate_reasons": candidate["candidate_reasons"],
               "review_priority": priority, "same_doi": str(same_doi).lower(),
               "same_normalized_title": str(same_title).lower(), "same_first_author": str(same_author).lower(),
               "same_year": str(same_year).lower(), "status": "context_only_no_decision"}
        for suffix, source in (("a", a), ("b", b)):
            for field in ("record_id", "pmid", "doi", "title", "first_author", "year", "journal", "raw_file"):
                row[f"{field}_{suffix}"] = source[field]
        rows.append(row)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader(); writer.writerows(rows)
    priorities = {name: sum(row["review_priority"] == name for row in rows) for name in
                  ("critical_exact_doi", "high_title_author_year", "manual_title_collision_review")}
    payload = {"schema_version": "1.0.0", "status": "synthetic_proxy_context_no_decision_authority",
               "record_count": len(records), "candidate_count": len(candidates), "output_rows": len(rows),
               "priorities": priorities,
               "inputs": {"records.csv": sha256(RECORDS), "duplicate_candidates.csv": sha256(CANDIDATES)},
               "output": {"path": OUTPUT.relative_to(ROOT).as_posix(), "sha256": sha256(OUTPUT)}}
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
