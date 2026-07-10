#!/usr/bin/env python3
"""Validate Phase 05 synthetic harness without treating it as research evidence."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
INTERIM = ROOT / "data/interim"
EXTRACTION = ROOT / "research/extraction"
SCHEMA_PATH = ROOT / "research/design/20260710/04_EXTRACTION/llm_extraction_schema.json"


def csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    errors: list[str] = []
    required = [
        INTERIM / "extractions_human.csv",
        INTERIM / "risk_of_bias.csv",
        EXTRACTION / "synthetic_extraction_fixtures.json",
        EXTRACTION / "synthetic_metric_results.json",
        EXTRACTION / "phase_05_exit_criteria.md",
        SCHEMA_PATH,
    ]
    for path in required:
        if not path.is_file():
            errors.append(f"missing: {path.relative_to(ROOT)}")
    if errors:
        print(json.dumps({"errors": errors}, ensure_ascii=False, indent=2))
        return 1

    human = csv_rows(required[0])
    rob = csv_rows(required[1])
    fixtures = json.loads(required[2].read_text(encoding="utf-8"))
    metrics = json.loads(required[3].read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)

    if human:
        errors.append("human extraction table is populated before included reports and verification")
    if rob:
        errors.append("risk-of-bias table is populated before independent human assessment")
    if len(fixtures) != 2:
        errors.append("expected exactly two synthetic extraction fixtures")
    for fixture in fixtures:
        schema_errors = list(validator.iter_errors(fixture["candidate"]))
        if schema_errors:
            errors.append(f"schema-invalid synthetic fixture: {fixture['name']}")

    expected = {
        "status": "synthetic_metric_fixture_not_ai_performance",
        "valid_fixture_accepted": True,
        "missing_locator_rejected": True,
        "human_extraction_rows": 0,
        "risk_of_bias_rows": 0,
        "ai_runs": 0,
    }
    for key, value in expected.items():
        if metrics.get(key) != value:
            errors.append(f"metric field {key}: expected {value!r}, got {metrics.get(key)!r}")
    for metric in ("exact_value", "unit", "locator"):
        item = metrics.get(metric, {})
        interval = item.get("wilson95")
        if item.get("N") != 3 or not isinstance(interval, list) or len(interval) != 2:
            errors.append(f"invalid Wilson fixture structure: {metric}")
        elif not (0 <= interval[0] <= interval[1] <= 1):
            errors.append(f"invalid Wilson interval bounds: {metric}")

    result = {
        "errors": errors,
        "phase_status": "blocked_external",
        "synthetic_harness_status": "complete_verified" if not errors else "failed_quality_gate",
        "human_extraction_rows": len(human),
        "risk_of_bias_rows": len(rob),
        "ai_runs": metrics.get("ai_runs"),
        "fixtures": len(fixtures),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
