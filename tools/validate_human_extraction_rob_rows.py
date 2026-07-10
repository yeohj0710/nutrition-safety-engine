#!/usr/bin/env python3
"""Validate future human extraction and RoB rows against routed tasks."""

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/interim"
SHA = re.compile(r"^[0-9a-f]{64}$")


def rows(name: str) -> list[dict[str, str]]:
    with (DATA / name).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def number(value: str) -> float | None:
    try: return float(value) if value.strip() else None
    except ValueError: return None


def extraction_errors(row: dict[str, str], tasks: dict[tuple[str, str], dict[str, str]]) -> list[str]:
    errors = []
    required = ("extraction_id", "study_id", "report_id", "source_id", "question_id", "design_family",
                "outcome_canonical", "supporting_quote", "source_file_sha256", "extracted_by", "verified_by", "verification_status")
    if not all(row.get(field, "").strip() for field in required): errors.append("missing required extraction field")
    if not any(row.get(field, "").strip() for field in ("page", "section", "table_figure")): errors.append("missing source locator")
    if not SHA.fullmatch(row.get("source_file_sha256", "")): errors.append("invalid source SHA")
    task = tasks.get((row.get("report_id", ""), row.get("question_id", "")))
    if not task or any(row.get(field) != task.get(field) for field in ("study_id", "design_family", "source_file_sha256")): errors.append("extraction task lineage mismatch")
    if row.get("verification_status") != "verified" or row.get("extracted_by") == row.get("verified_by"): errors.append("independent verification missing")
    for events, total in (("events_exposed", "n_exposed_outcome"), ("events_comparator", "n_comparator_outcome")):
        e, n = number(row.get(events, "")), number(row.get(total, ""))
        if e is not None and (n is None or e < 0 or e > n): errors.append(f"invalid {events}/{total}")
    estimate, low, high = number(row.get("effect_estimate", "")), number(row.get("ci_lower", "")), number(row.get("ci_upper", ""))
    if any(value is not None for value in (low, high)) and (None in (estimate, low, high) or not low <= estimate <= high): errors.append("invalid effect CI")
    return errors


def rob_errors(row: dict[str, str], tasks: dict[tuple[str, str], dict[str, str]]) -> list[str]:
    errors = []
    required = ("rob_id", "study_id", "report_id", "question_id", "design_family", "tool_name", "tool_version",
                "domain", "signalling_answers_json", "support_for_judgment", "domain_judgment", "reviewer_id", "reviewed_at", "consensus_judgment")
    if not all(row.get(field, "").strip() for field in required): errors.append("missing required RoB field")
    task = tasks.get((row.get("report_id", ""), row.get("question_id", "")))
    if not task or any(row.get(field) != task.get(field) for field in ("study_id", "design_family", "tool_name")): errors.append("RoB task lineage mismatch")
    try:
        if not isinstance(json.loads(row.get("signalling_answers_json", "")), dict): errors.append("RoB signalling answers not object")
    except json.JSONDecodeError: errors.append("invalid RoB signalling JSON")
    return errors


def main() -> int:
    extraction_tasks = {(row["report_id"], row["question_id"]): row for row in rows("extraction_work_queue.csv")}
    rob_tasks = {(row["report_id"], row["question_id"]): row for row in rows("rob_work_queue.csv")}
    extraction, rob = rows("extractions_human.csv"), rows("risk_of_bias.csv")
    errors = [f"extraction {i}: {error}" for i, row in enumerate(extraction, 1) for error in extraction_errors(row, extraction_tasks)]
    errors += [f"RoB {i}: {error}" for i, row in enumerate(rob, 1) for error in rob_errors(row, rob_tasks)]
    tests = {"missing_locator_rejected": "missing source locator" in extraction_errors({}, {}),
             "unknown_task_rejected": "extraction task lineage mismatch" in extraction_errors({}, {}),
             "invalid_rob_json_rejected": "invalid RoB signalling JSON" in rob_errors({}, {})}
    if not all(tests.values()): errors.append("human row semantic contracts failed")
    result = {"errors": errors, "human_extraction_rows": len(extraction), "human_rob_rows": len(rob),
              "semantic_contract_tests": tests}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
