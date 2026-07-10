#!/usr/bin/env python3
"""Validate Phase 07 safe-empty boundary and prohibit false release claims."""

import hashlib
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors: list[str] = []
    report_path = ROOT / "research/validation/safe_empty_proxy_report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    expected = {
        "status": "synthetic_safe_empty_proxy_not_independent_gold",
        "clinical_performance_claim_allowed": False,
        "scenario_count": 120,
        "repeats_per_scenario": 3,
        "executions": 360,
        "deterministic_scenarios": 120,
        "legacy_leakage_scenarios": 0,
        "nonempty_output_scenarios": 0,
        "validated_claims": 0,
        "validated_rules": 0,
        "independent_gold_scenarios": 0,
        "expert_reviews": 0,
    }
    for key, value in expected.items():
        if report.get(key) != value:
            errors.append(f"report {key}: expected {value!r}, got {report.get(key)!r}")
    source_paths = {
        "runner": ROOT / "scripts/run-phase07-safe-empty-proxy.ts",
        "engine": ROOT / "src/engine/run-thesis-engine.ts",
        "thesis_bundle": ROOT / "src/generated/thesis-bundle.json",
        "scenario_inputs": ROOT / "research/validation/synthetic_scenario_inputs.jsonl",
    }
    for key, path in source_paths.items():
        if report.get("source_hashes", {}).get(key) != sha256(path):
            errors.append(f"stale Phase 07 report source hash: {key}")
    scenarios = report.get("scenarios", [])
    if len(scenarios) != 120 or len({row.get("scenario_id") for row in scenarios}) != 120:
        errors.append("scenario detail must contain 120 unique IDs")
    if any(row.get("deterministic") is not True for row in scenarios):
        errors.append("one or more synthetic scenarios are nondeterministic")
    with (ROOT / "research/validation/synthetic_scenario_blind_expert_review.csv").open(encoding="utf-8-sig", newline="") as handle:
        blind_rows = list(csv.DictReader(handle))
    with (ROOT / "research/validation/independent_gold_scenario_authoring_queue.csv").open(encoding="utf-8-sig", newline="") as handle:
        gold_rows = list(csv.DictReader(handle))
    if len(blind_rows) != 120:
        errors.append("blind expert review queue must contain 120 rows")
    expert_complete = sum(row.get("status") == "complete_external_human_review_synthetic_not_gold" for row in blind_rows)
    gold_human_fields = (
        "author_1_id", "author_1_input_json", "author_1_expected_actions_json",
        "author_2_id", "author_2_input_json", "author_2_expected_actions_json",
        "adjudicator_id", "adjudicated_input_json", "adjudicated_expected_actions_json",
        "critical_failure_labels_json", "authored_at", "adjudicated_at", "gold_row_sha256",
    )
    if len(gold_rows) != 120:
        errors.append("independent gold authoring queue must contain 120 rows")
    gold_complete = sum(row.get("status") == "adjudicated_independent_gold_candidate" for row in gold_rows)
    performance_path = ROOT / "research/validation/independent_gold_performance.json"
    performance = json.loads(performance_path.read_text(encoding="utf-8"))
    performance_sources = {"evaluator": ROOT / "scripts/evaluate-phase07-independent-gold.ts",
                           "engine": ROOT / "src/engine/run-thesis-engine.ts",
                           "gold": ROOT / "data/curated/independent_gold_scenarios.jsonl",
                           "thesis_bundle": ROOT / "src/generated/thesis-bundle.json"}
    if any(performance.get("source_hashes", {}).get(name) != sha256(path) for name, path in performance_sources.items()):
        errors.append("independent gold performance source hash mismatch")
    if gold_complete < 120:
        if performance.get("status") != "blocked_external_incomplete_independent_gold" or performance.get("metrics") is not None:
            errors.append("incomplete gold must not emit clinical performance metrics")
    elif performance.get("gold_scenarios") != 120 or performance.get("metrics") is None:
        errors.append("complete gold requires a 120-scenario performance report")

    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    if "openai" in package.get("dependencies", {}) or "openai" in package.get("devDependencies", {}):
        errors.append("runtime OpenAI dependency reintroduced")
    runtime_ai_files = [
        path
        for root in (ROOT / "app/api/ai-explain", ROOT / "src/lib/ai")
        if root.exists()
        for path in root.rglob("*")
        if path.is_file()
    ]
    if runtime_ai_files:
        errors.append("runtime AI route/module reintroduced")
    baseline = json.loads((ROOT / "research/audit/deployment_baseline.json").read_text(encoding="utf-8"))
    if baseline.get("validated_deployment") is not False or baseline.get("baseline_status") != "legacy_unverified_production":
        errors.append("legacy deployment baseline is overstated")

    result = {
        "errors": errors,
        "phase_status": "blocked_external",
        "safe_empty_boundary": "complete_verified" if not errors else "failed_quality_gate",
        "synthetic_scenarios": len(scenarios),
        "independent_gold_scenarios": gold_complete,
        "validated_deployment": False,
        "blind_expert_review_rows": len(blind_rows),
        "gold_authoring_rows": len(gold_rows),
        "expert_reviews_complete": expert_complete,
        "independent_performance_metrics": performance.get("metrics") is not None,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
