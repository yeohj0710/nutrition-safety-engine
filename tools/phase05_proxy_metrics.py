#!/usr/bin/env python3
"""Exercise extraction invariants and metrics on synthetic fixtures only."""

from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]


def sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def wilson(successes: int, total: int, z: float = 1.959963984540054) -> list[float | None]:
    if total == 0:
        return [None, None]
    p = successes / total
    denominator = 1 + z * z / total
    center = (p + z * z / (2 * total)) / denominator
    margin = z * math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator
    return [center - margin, center + margin]


def valid_candidate(candidate: dict) -> bool:
    required = {"run_id", "report_id", "question_id", "model", "fields", "warnings"}
    if not required <= candidate.keys() or candidate["question_id"] not in {"A1", "A2", "B1", "B2", "B3"}:
        return False
    for field in candidate["fields"]:
        if field.get("status") == "extracted":
            locator = field.get("locator") or {}
            if not field.get("supporting_quote") or not any(
                locator.get(key) not in (None, "") for key in ("page", "section", "table_or_figure")
            ):
                return False
    return True


def main() -> int:
    extraction_dir = REPO / "research" / "extraction"
    extraction_dir.mkdir(parents=True, exist_ok=True)
    interim = REPO / "data" / "interim"
    with (interim / "extractions_human.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        csv.writer(handle).writerow(
            [
                "extraction_id", "study_id", "report_id", "question_id", "field_name", "value_reported",
                "normalized_value", "unit", "supporting_quote", "page_number", "section_heading",
                "table_or_figure", "source_file_sha256", "extracted_by", "verified_by", "verification_status",
            ]
        )
    with (interim / "risk_of_bias.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        csv.writer(handle).writerow(
            [
                "rob_id", "study_id", "report_id", "question_id", "design_family", "tool_name", "tool_version",
                "domain", "signalling_answers_json", "support_for_judgment", "domain_judgment", "reviewer_id",
                "reviewed_at", "consensus_judgment", "adjudicator_id", "notes",
            ]
        )

    base_field = {
        "field_name": "synthetic_event_count",
        "value": 4,
        "normalized_value": 4,
        "unit": "events",
        "status": "extracted",
        "supporting_quote": "Synthetic fixture: four events.",
        "locator": {"page": 7, "section": "Synthetic results", "table_or_figure": "Table S1"},
        "confidence": 1.0,
        "reasoning_note": "Synthetic fixture only.",
    }
    candidate = {
        "run_id": "SYNTH-EXTRACT-001",
        "report_id": "SYNTH-REPORT-001",
        "question_id": "A1",
        "model": {
            "name": "synthetic_fixture_generator",
            "version_or_access_date": "2026-07-10",
            "temperature": None,
            "prompt_sha256": "0" * 64,
        },
        "fields": [base_field],
        "warnings": ["not a research document or AI performance run"],
    }
    invalid = json.loads(json.dumps(candidate))
    invalid["run_id"] = "SYNTH-INVALID-NO-LOCATOR"
    invalid["fields"][0]["supporting_quote"] = None
    invalid["fields"][0]["locator"] = {"page": None, "section": None, "table_or_figure": None}

    fixtures = [
        {"name": "valid", "candidate": candidate, "expected_valid": True},
        {"name": "invalid_missing_locator", "candidate": invalid, "expected_valid": False},
    ]
    fixture_path = extraction_dir / "synthetic_extraction_fixtures.json"
    fixture_path.write_text(json.dumps(fixtures, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    gold = [
        {"field": "event_count", "value": "4", "unit": "events", "locator": True},
        {"field": "denominator", "value": "40", "unit": "participants", "locator": True},
        {"field": "timepoint", "value": "12", "unit": "weeks", "locator": True},
        {"field": "not_reported_field", "value": None, "unit": None, "locator": False},
    ]
    prediction = [
        {"field": "event_count", "value": "4", "unit": "events", "locator": True},
        {"field": "denominator", "value": "44", "unit": "participants", "locator": True},
        {"field": "timepoint", "value": "12", "unit": "months", "locator": False},
        {"field": "unsupported_field", "value": "yes", "unit": None, "locator": False},
    ]
    gold_by = {row["field"]: row for row in gold}
    pred_by = {row["field"]: row for row in prediction}
    shared = set(gold_by) & set(pred_by)
    exact = sum(gold_by[key]["value"] == pred_by[key]["value"] for key in shared)
    units = sum(gold_by[key]["unit"] == pred_by[key]["unit"] for key in shared)
    locators = sum(gold_by[key]["locator"] == pred_by[key]["locator"] for key in shared)
    unsupported = len(set(pred_by) - set(gold_by))
    metrics = {
        "status": "synthetic_metric_fixture_not_ai_performance",
        "shared_fields": len(shared),
        "exact_value": {"n": exact, "N": len(shared), "rate": exact / len(shared), "wilson95": wilson(exact, len(shared))},
        "unit": {"n": units, "N": len(shared), "rate": units / len(shared), "wilson95": wilson(units, len(shared))},
        "locator": {"n": locators, "N": len(shared), "rate": locators / len(shared), "wilson95": wilson(locators, len(shared))},
        "unsupported_claims": {"n": unsupported, "N": len(pred_by), "rate": unsupported / len(pred_by)},
        "valid_fixture_accepted": valid_candidate(candidate),
        "missing_locator_rejected": not valid_candidate(invalid),
        "human_extraction_rows": 0,
        "risk_of_bias_rows": 0,
        "ai_runs": 0,
        "fixture_sha256": sha(fixture_path.read_bytes()),
    }
    (extraction_dir / "synthetic_metric_results.json").write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(metrics, ensure_ascii=False))
    return 0 if metrics["valid_fixture_accepted"] and metrics["missing_locator_rejected"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
