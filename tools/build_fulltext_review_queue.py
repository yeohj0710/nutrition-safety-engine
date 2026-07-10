#!/usr/bin/env python3
"""Route completed secondary include/uncertain decisions to double full-text review."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/interim"
QUEUE = DATA / "full_text_review_queue.csv"
REPORT = ROOT / "research/screening/full_text_queue_contract.json"


def selected(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    output = []
    for row in rows:
        final = row["final_decision"].strip()
        if not final:
            continue
        if final not in {"include", "exclude", "uncertain"}:
            raise ValueError(f"unsupported secondary final decision: {final}")
        if not all(row[field].strip() for field in ("reviewer_2_id", "reviewer_2_decision", "reviewed_at")):
            raise ValueError(f"final decision without completed reviewer 2: {row['secondary_id']}")
        if final in {"include", "uncertain"}:
            output.append(row)
    return sorted(output, key=lambda row: (row["question_id"], row["record_id"]))


def write(fields: list[str], rows: list[dict[str, str]]) -> None:
    with QUEUE.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)


def human_started(row: dict[str, str]) -> bool:
    fields = ("source_file_path", "source_file_sha256", "study_id", "study_link_verified_by", "design_family",
              "design_verified_by", "reviewer_1_id", "reviewer_1_decision", "reviewer_1_reason", "reviewer_1_at",
              "reviewer_2_id", "reviewer_2_decision", "reviewer_2_reason", "reviewer_2_at", "adjudicator_id",
              "final_decision", "final_reason")
    return row.get("fulltext_access_status") != "not_started" or any(row.get(field, "") for field in fields)


def write_or_preserve(fields: list[str], generated: list[dict[str, str]]) -> str:
    if QUEUE.exists():
        with QUEUE.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle); existing = list(reader)
            if reader.fieldnames != fields:
                if any(human_started(row) for row in existing):
                    raise ValueError("full-text queue header changed after human review")
            elif any(human_started(row) for row in existing):
                old = {row["fulltext_queue_id"]: row for row in existing}; new = {row["fulltext_queue_id"]: row for row in generated}
                static = ("report_id", "record_id", "question_id", "title", "pmid", "lineage_sha256")
                if set(old) != set(new) or any(any(old[key][field] != new[key][field] for field in static) for key in old):
                    raise ValueError("full-text routing lineage changed after human review")
                return "preserved_existing_human_data"
    write(fields, generated)
    return "generated_no_human_data"


def main() -> int:
    with (DATA / "secondary_screening_review_queue.csv").open(encoding="utf-8-sig", newline="") as handle:
        secondary = list(csv.DictReader(handle))
    with (DATA / "records.csv").open(encoding="utf-8-sig", newline="") as handle:
        records = {row["record_id"]: row for row in csv.DictReader(handle)}
    with (DATA / "report_candidates.csv").open(encoding="utf-8-sig", newline="") as handle:
        reports = {row["record_id"]: row for row in csv.DictReader(handle)}
    queue_rows = []
    for row in selected(secondary):
        record, report = records[row["record_id"]], reports[row["record_id"]]
        lineage = hashlib.sha256(f"{row['source_primary_row_sha256']}|{row['selection_sha256']}|{report['report_id']}".encode()).hexdigest()
        queue_rows.append({"fulltext_queue_id": f"FT-{row['question_id']}-{record['pmid']}",
                           "report_id": report["report_id"], "record_id": row["record_id"],
                           "question_id": row["question_id"], "title": record["title"], "pmid": record["pmid"],
                           "lineage_sha256": lineage, "fulltext_access_status": "not_started",
                           "source_file_path": "", "source_file_sha256": "",
                           "study_id": "", "study_link_verified_by": "", "design_family": "", "design_verified_by": "",
                           "reviewer_1_id": "", "reviewer_1_decision": "", "reviewer_1_reason": "", "reviewer_1_at": "",
                           "reviewer_2_id": "", "reviewer_2_decision": "", "reviewer_2_reason": "", "reviewer_2_at": "",
                           "adjudicator_id": "", "final_decision": "", "final_reason": "", "status": "awaiting_fulltext_access_and_double_review"})
    fields = ["fulltext_queue_id", "report_id", "record_id", "question_id", "title", "pmid", "lineage_sha256",
              "fulltext_access_status", "source_file_path", "source_file_sha256", "study_id", "study_link_verified_by",
              "design_family", "design_verified_by", "reviewer_1_id", "reviewer_1_decision",
              "reviewer_1_reason", "reviewer_1_at", "reviewer_2_id", "reviewer_2_decision", "reviewer_2_reason",
              "reviewer_2_at", "adjudicator_id", "final_decision", "final_reason", "status"]
    queue_write_status = write_or_preserve(fields, queue_rows)
    with QUEUE.open(encoding="utf-8-sig", newline="") as handle:
        actual_queue = list(csv.DictReader(handle))
    fixtures = [{"secondary_id": "S1", "record_id": "R1", "question_id": "A1", "final_decision": "include",
                 "reviewer_2_id": "H2", "reviewer_2_decision": "include", "reviewed_at": "2026-07-10"},
                {"secondary_id": "S2", "record_id": "R2", "question_id": "A1", "final_decision": "uncertain",
                 "reviewer_2_id": "H2", "reviewer_2_decision": "uncertain", "reviewed_at": "2026-07-10"},
                {"secondary_id": "S3", "record_id": "R3", "question_id": "A1", "final_decision": "exclude",
                 "reviewer_2_id": "H2", "reviewer_2_decision": "exclude", "reviewed_at": "2026-07-10"}]
    picked = selected(fixtures)
    tests = {"include_routed": any(row["record_id"] == "R1" for row in picked),
             "uncertain_routed": any(row["record_id"] == "R2" for row in picked),
             "exclude_not_routed": all(row["record_id"] != "R3" for row in picked),
             "deterministic": [row["record_id"] for row in picked] == [row["record_id"] for row in selected(fixtures)],
             "proxy_fields_absent": all("proxy" not in field for field in fields),
             "double_review_fields_present": all(field in fields for field in ("reviewer_1_id", "reviewer_1_decision", "reviewer_2_id", "reviewer_2_decision", "final_decision")),
             "study_design_gate_present": all(field in fields for field in ("study_id", "study_link_verified_by", "design_family", "design_verified_by"))}
    contract = {"schema_version": "1.0.0", "status": "awaiting_secondary_screening_completion",
                "secondary_final_rows": sum(bool(row["final_decision"].strip()) for row in secondary),
                "fulltext_queue_rows": len(actual_queue), "fulltext_human_reviews": sum(human_started(row) for row in actual_queue),
                "queue_write_status": queue_write_status,
                "contract_tests": tests, "all_passed": all(tests.values())}
    REPORT.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(contract, ensure_ascii=False))
    return 0 if contract["all_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
