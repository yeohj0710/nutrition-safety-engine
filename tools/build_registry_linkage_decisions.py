#!/usr/bin/env python3
"""Build or preserve the human registry–PubMed linkage decision queue."""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/interim/registry_report_link_candidates.csv"
OUTPUT = ROOT / "data/interim/registry_linkage_decisions.csv"
FIELDS = ["link_candidate_id", "registry_record_id", "nct_id", "pubmed_record_id", "pmid", "reference_type",
          "decision", "study_id", "report_id", "reason", "verified_by", "verified_at", "status"]
HUMAN = ("decision", "study_id", "report_id", "reason", "verified_by", "verified_at")
STATIC = tuple(FIELDS[:6])


def read(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_or_preserve(generated: list[dict[str, str]]) -> str:
    if OUTPUT.is_file():
        with OUTPUT.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle); existing, fields = list(reader), reader.fieldnames or []
        if fields != FIELDS and any(any(row.get(field, "").strip() for field in HUMAN) for row in existing):
            raise ValueError("registry linkage queue header changed; refusing overwrite")
        if fields == FIELDS and any(any(row.get(field, "").strip() for field in HUMAN) for row in existing):
            old = {row["link_candidate_id"]: row for row in existing}; new = {row["link_candidate_id"]: row for row in generated}
            if set(old) != set(new) or any(any(old[key][field] != new[key][field] for field in STATIC) for key in old):
                raise ValueError("registry linkage source changed; refusing overwrite")
            return "preserved_existing_human_data"
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n"); writer.writeheader(); writer.writerows(generated)
    return "generated_no_human_data"


def main() -> int:
    rows = []
    for source in read(SOURCE):
        rows.append({field: source.get(field, "") for field in STATIC} | {
            "decision": "", "study_id": "", "report_id": "", "reason": "", "verified_by": "", "verified_at": "",
            "status": "pending_external_human_review"})
    status = write_or_preserve(rows)
    print(json.dumps({"rows": len(rows), "write_status": status, "human_decisions": 0}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
