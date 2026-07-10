#!/usr/bin/env python3
"""Create extraction and RoB tasks only from verified included full texts."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/interim"
EXTRACTION_QUEUE = DATA / "extraction_work_queue.csv"
ROB_QUEUE = DATA / "rob_work_queue.csv"
REPORT = ROOT / "research/extraction/extraction_rob_routing_contract.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rob_route(design: str) -> tuple[str, str]:
    if design == "randomized_trial":
        return "RoB 2", "protocol_fixed"
    return "", "pending_human_tool_selection_before_assessment"


def eligible(rows: list[dict[str, str]], verify_files: bool = True) -> list[dict[str, str]]:
    output = []
    required = ("source_file_path", "source_file_sha256", "study_id", "study_link_verified_by",
                "design_family", "design_verified_by", "reviewer_1_id", "reviewer_1_decision", "reviewer_1_at",
                "reviewer_2_id", "reviewer_2_decision", "reviewer_2_at", "final_decision")
    for row in rows:
        final = row["final_decision"].strip()
        if not final:
            continue
        if final not in {"include", "exclude"}:
            raise ValueError(f"full-text final decision must be include/exclude: {row['fulltext_queue_id']}")
        if not all(row[field].strip() for field in required):
            raise ValueError(f"incomplete included/full-text decision row: {row['fulltext_queue_id']}")
        if final == "exclude":
            continue
        source = row["source_file_path"]
        if "legacy_unverified" in source or Path(source).is_absolute():
            raise ValueError(f"forbidden source path: {source}")
        if verify_files:
            path = ROOT / source
            if not path.is_file() or sha(path) != row["source_file_sha256"]:
                raise ValueError(f"source hash mismatch: {source}")
        output.append(row)
    return sorted(output, key=lambda row: (row["question_id"], row["report_id"]))


def write(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)


def write_or_preserve(path: Path, fields: list[str], generated: list[dict[str, str]], key: str,
                      static_fields: tuple[str, ...], human_started) -> str:
    if path.exists():
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle); existing = list(reader)
            if reader.fieldnames != fields:
                if any(human_started(row) for row in existing):
                    raise ValueError(f"work queue header changed after human assignment: {path}")
            elif any(human_started(row) for row in existing):
                old, new = {row[key]: row for row in existing}, {row[key]: row for row in generated}
                if set(old) != set(new) or any(any(old[item][field] != new[item][field] for field in static_fields) for item in old):
                    raise ValueError(f"work queue lineage changed after human assignment: {path}")
                return "preserved_existing_human_data"
    write(path, fields, generated)
    return "generated_no_human_data"


def main() -> int:
    with (DATA / "full_text_review_queue.csv").open(encoding="utf-8-sig", newline="") as handle:
        fulltext = list(csv.DictReader(handle))
    included = eligible(fulltext)
    extraction_rows, rob_rows = [], []
    for row in included:
        route, route_status = rob_route(row["design_family"])
        base = {"study_id": row["study_id"], "report_id": row["report_id"], "record_id": row["record_id"],
                "question_id": row["question_id"], "design_family": row["design_family"],
                "source_file_path": row["source_file_path"], "source_file_sha256": row["source_file_sha256"]}
        extraction_rows.append({"extraction_task_id": f"EXT-TASK-{row['question_id']}-{row['report_id']}", **base,
                                "extractor_id": "", "verifier_id": "", "started_at": "", "completed_at": "",
                                "status": "awaiting_independent_extraction_and_verification"})
        rob_rows.append({"rob_task_id": f"ROB-TASK-{row['question_id']}-{row['report_id']}", **base,
                         "tool_name": route, "tool_route_status": route_status, "tool_version": "",
                         "reviewer_1_id": "", "reviewer_2_id": "", "adjudicator_id": "",
                         "started_at": "", "completed_at": "", "status": "awaiting_independent_rob_assessment"})
    common = ["study_id", "report_id", "record_id", "question_id", "design_family", "source_file_path", "source_file_sha256"]
    extraction_fields = ["extraction_task_id", *common, "extractor_id", "verifier_id", "started_at", "completed_at", "status"]
    rob_fields = ["rob_task_id", *common, "tool_name", "tool_route_status", "tool_version", "reviewer_1_id",
                  "reviewer_2_id", "adjudicator_id", "started_at", "completed_at", "status"]
    static = tuple(common)
    extraction_write_status = write_or_preserve(EXTRACTION_QUEUE, extraction_fields, extraction_rows, "extraction_task_id", static,
        lambda row: any(row.get(field, "") for field in ("extractor_id", "verifier_id", "started_at", "completed_at")))
    rob_write_status = write_or_preserve(ROB_QUEUE, rob_fields, rob_rows, "rob_task_id", static,
        lambda row: any(row.get(field, "") for field in ("tool_version", "reviewer_1_id", "reviewer_2_id", "adjudicator_id", "started_at", "completed_at"))
        or row.get("tool_route_status") == "human_selected_verified")
    with EXTRACTION_QUEUE.open(encoding="utf-8-sig", newline="") as handle: actual_extraction = list(csv.DictReader(handle))
    with ROB_QUEUE.open(encoding="utf-8-sig", newline="") as handle: actual_rob = list(csv.DictReader(handle))
    fixture = {"fulltext_queue_id": "FT-X", "report_id": "RPT-X", "record_id": "REC-X", "question_id": "A1",
               "source_file_path": "synthetic/source.pdf", "source_file_sha256": "1" * 64, "study_id": "STD-X",
               "study_link_verified_by": "H0", "design_family": "randomized_trial", "design_verified_by": "H0",
               "reviewer_1_id": "H1", "reviewer_1_decision": "include", "reviewer_1_at": "d1",
               "reviewer_2_id": "H2", "reviewer_2_decision": "include", "reviewer_2_at": "d2", "final_decision": "include"}
    excluded = dict(fixture, fulltext_queue_id="FT-Y", final_decision="exclude")
    tests = {"included_routed": len(eligible([fixture], verify_files=False)) == 1,
             "excluded_not_routed": len(eligible([excluded], verify_files=False)) == 0,
             "randomized_routes_rob2": rob_route("randomized_trial") == ("RoB 2", "protocol_fixed"),
             "nonrandomized_not_autoselected": rob_route("observational_exposure")[1] == "pending_human_tool_selection_before_assessment",
             "legacy_rejected": False, "missing_source_hash_rejected": False}
    try: eligible([dict(fixture, source_file_path="data/legacy_unverified/x.pdf")], verify_files=False)
    except ValueError: tests["legacy_rejected"] = True
    try: eligible([dict(fixture, source_file_sha256="")], verify_files=False)
    except ValueError: tests["missing_source_hash_rejected"] = True
    contract = {"schema_version": "1.0.0", "status": "awaiting_verified_fulltext_inclusions",
                "included_fulltext_rows": len(included), "extraction_work_rows": len(actual_extraction),
                "rob_work_rows": len(actual_rob),
                "human_extractions": sum(bool(row["extractor_id"]) for row in actual_extraction),
                "human_rob_assessments": sum(bool(row["reviewer_1_id"]) for row in actual_rob),
                "extraction_write_status": extraction_write_status, "rob_write_status": rob_write_status,
                "contract_tests": tests, "all_passed": all(tests.values())}
    REPORT.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(contract, ensure_ascii=False))
    return 0 if contract["all_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
