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
    if len(fixtures) != 3:
        errors.append("expected two synthetic fixtures plus one real-source contract fixture")
    for fixture in fixtures:
        schema_errors = list(validator.iter_errors(fixture["candidate"]))
        actual_valid = not schema_errors
        if actual_valid is not fixture["expected_valid"]:
            errors.append(f"schema expectation mismatch: {fixture['name']}")

    expected = {
        "status": "synthetic_metric_fixture_not_ai_performance",
        "valid_fixture_accepted": True,
        "missing_locator_rejected": True,
        "real_source_contract_fixture_present": True,
        "human_extraction_rows": 0,
        "risk_of_bias_rows": 0,
        "ai_runs": 0,
    }
    for key, value in expected.items():
        if metrics.get(key) != value:
            errors.append(f"metric field {key}: expected {value!r}, got {metrics.get(key)!r}")
    contract = next((fixture for fixture in fixtures if fixture["name"] == "real_pmc_locator_contract_no_extraction"), None)
    if contract is None:
        errors.append("real PMC locator contract fixture missing")
    else:
        candidate = contract["candidate"]
        field = candidate["fields"][0]
        locator = field["locator"]
        pmc_root = ROOT / "research/fulltext/pmc_sentinel_fulltext_designpilot_20260710"
        pmc_manifest = json.loads((pmc_root / "manifest.json").read_text(encoding="utf-8"))
        with (pmc_root / "paragraph_locators.csv").open(encoding="utf-8-sig", newline="") as handle:
            paragraph_index = {row["xml_locator"]: row for row in csv.DictReader(handle)}
        paragraph = paragraph_index.get(locator["xml_locator"])
        if locator["source_file_sha256"] != pmc_manifest["raw_gzip_sha256"] or candidate.get("input_sha256") != pmc_manifest["raw_gzip_sha256"]:
            errors.append("real contract source hash mismatch")
        expected_source_path = "research/fulltext/pmc_sentinel_fulltext_designpilot_20260710/pmc_sentinel_batch.xml.gz"
        if locator.get("source_path") != expected_source_path or "legacy_unverified" in locator.get("source_path", ""):
            errors.append("real contract source path mismatch")
        if paragraph is None or locator["paragraph_text_sha256"] != paragraph["normalized_text_sha256"]:
            errors.append("real contract paragraph locator/hash mismatch")
        if field["status"] == "extracted" or field["value"] is not None or field["supporting_quote"] is not None:
            errors.append("real contract fixture contains an extraction-like value")
    contract_tests = metrics.get("source_contract_tests", {})
    expected_contract_tests = {
        "valid_reference_accepted": True,
        "wrong_source_hash_rejected": True,
        "wrong_paragraph_hash_rejected": True,
        "wrong_xml_locator_rejected": True,
        "legacy_source_rejected": True,
    }
    if contract_tests != expected_contract_tests:
        errors.append("source contract mutation tests failed or are incomplete")
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
        "real_source_contract_fixture": contract is not None,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
