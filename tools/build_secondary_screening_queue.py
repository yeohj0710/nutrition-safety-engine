#!/usr/bin/env python3
"""Build a blinded second-review queue from completed primary screening only."""

import csv
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/interim"
QUEUE = DATA / "secondary_screening_review_queue.csv"
AUDIT = DATA / "secondary_screening_selection_audit.csv"
REPORT = ROOT / "research/screening/secondary_screening_contract.json"
SEED = "secondary-screening-v1"


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def row_digest(row: dict[str, str]) -> str:
    return digest(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def select_primary(rows: list[dict[str, str]]) -> list[tuple[dict[str, str], str]]:
    selected: list[tuple[dict[str, str], str]] = []
    excluded: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        decision = row["decision"].strip()
        if decision in {"include", "uncertain"}:
            selected.append((row, f"all_{decision}"))
        elif decision == "exclude":
            excluded[(row["question_ids"], row["primary_reason_code"] or "UNSPECIFIED")].append(row)
        else:
            raise ValueError(f"unsupported primary decision: {decision}")
    for (question, reason), group in sorted(excluded.items()):
        ordered = sorted(group, key=lambda row: digest(f"{SEED}|{row['record_id']}|{question}|{reason}"))
        take = max(1, math.ceil(len(ordered) * 0.20))
        selected.extend((row, f"stratified_exclude_20pct:{question}:{reason}") for row in ordered[:take])
    return sorted(selected, key=lambda item: (item[0]["question_ids"], item[0]["record_id"]))


def write(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)


def write_or_preserve_queue(path: Path, fields: list[str], generated: list[dict[str, str]],
                            human_fields: tuple[str, ...], static_fields: tuple[str, ...]) -> str:
    if path.exists():
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle); existing = list(reader)
            if reader.fieldnames != fields:
                if any(any(row.get(field, "") for field in human_fields) for row in existing):
                    raise ValueError("secondary queue header changed after human review")
            elif any(any(row[field] for field in human_fields) for row in existing):
                old = {row["secondary_id"]: row for row in existing}; new = {row["secondary_id"]: row for row in generated}
                if set(old) != set(new) or any(any(old[key][field] != new[key][field] for field in static_fields) for key in old):
                    raise ValueError("secondary selection lineage changed after human review")
                return "preserved_existing_human_data"
    write(path, fields, generated)
    return "generated_no_human_data"


def main() -> int:
    with (DATA / "screening_decisions.csv").open(encoding="utf-8-sig", newline="") as handle:
        decisions = list(csv.DictReader(handle))
    with (DATA / "records.csv").open(encoding="utf-8-sig", newline="") as handle:
        records = {row["record_id"]: row for row in csv.DictReader(handle)}
    partial = [row["record_id"] for row in decisions if any(row[field].strip() for field in ("reviewer_id", "decision", "reviewed_at"))
               and not all(row[field].strip() for field in ("reviewer_id", "decision", "reviewed_at"))]
    if partial:
        raise ValueError(f"partial primary screening rows: {len(partial)}")
    completed = [row for row in decisions if all(row[field].strip() for field in ("reviewer_id", "decision", "reviewed_at"))]
    selected = select_primary(completed)
    queue_rows, audit_rows = [], []
    for row, basis in selected:
        record = records[row["record_id"]]
        source_sha = row_digest(row)
        selection_sha = digest(f"{SEED}|{row['record_id']}|{row['question_ids']}|{basis}|{source_sha}")
        queue_rows.append({"secondary_id": f"SCR2-{row['question_ids']}-{row['record_id'].removeprefix('REC-PUBMED-')}",
                           "record_id": row["record_id"], "question_id": row["question_ids"],
                           "title": record["title"], "year": record["year"], "selection_sha256": selection_sha,
                           "source_primary_row_sha256": source_sha, "reviewer_2_id": "", "reviewer_2_decision": "",
                           "reviewer_2_reason": "", "reviewed_at": "", "adjudication_status": "not_started",
                           "final_decision": "", "adjudicator_id": ""})
        audit_rows.append({"record_id": row["record_id"], "question_id": row["question_ids"],
                           "primary_decision": row["decision"], "primary_reason_code": row["primary_reason_code"],
                           "selection_basis": basis, "selection_sha256": selection_sha,
                           "source_primary_row_sha256": source_sha})
    queue_fields = ["secondary_id", "record_id", "question_id", "title", "year", "selection_sha256",
                    "source_primary_row_sha256", "reviewer_2_id", "reviewer_2_decision", "reviewer_2_reason",
                    "reviewed_at", "adjudication_status", "final_decision", "adjudicator_id"]
    queue_write_status = write_or_preserve_queue(QUEUE, queue_fields, queue_rows,
        ("reviewer_2_id", "reviewer_2_decision", "reviewer_2_reason", "reviewed_at", "final_decision", "adjudicator_id"),
        ("record_id", "question_id", "title", "year", "selection_sha256", "source_primary_row_sha256"))
    with QUEUE.open(encoding="utf-8-sig", newline="") as handle:
        actual_queue = list(csv.DictReader(handle))
    write(AUDIT, ["record_id", "question_id", "primary_decision", "primary_reason_code", "selection_basis",
                  "selection_sha256", "source_primary_row_sha256"], audit_rows)
    synthetic = [{"record_id": f"R{i}", "question_ids": "A1", "decision": "exclude",
                  "primary_reason_code": "E1"} for i in range(5)] + [
                    {"record_id": "RI", "question_ids": "A1", "decision": "include", "primary_reason_code": ""},
                    {"record_id": "RU", "question_ids": "A1", "decision": "uncertain", "primary_reason_code": ""}]
    first, second = select_primary(synthetic), select_primary(synthetic)
    tests = {"include_all": sum(b == "all_include" for _, b in first) == 1,
             "uncertain_all": sum(b == "all_uncertain" for _, b in first) == 1,
             "exclude_20pct_ceiling": sum(b.startswith("stratified_exclude") for _, b in first) == 1,
             "deterministic": [(r["record_id"], b) for r, b in first] == [(r["record_id"], b) for r, b in second],
             "primary_decision_blinded": "primary_decision" not in (queue_rows[0] if queue_rows else {"secondary_id": ""})}
    report = {"schema_version": "1.0.0", "status": "awaiting_completed_primary_screening",
              "primary_completed_rows": len(completed), "secondary_queue_rows": len(actual_queue),
              "secondary_human_reviews": sum(bool(row["reviewer_2_id"]) for row in actual_queue),
              "selection_audit_rows": len(audit_rows), "queue_write_status": queue_write_status,
              "contract_tests": tests, "all_passed": all(tests.values())}
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report["all_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
