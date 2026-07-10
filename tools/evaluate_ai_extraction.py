#!/usr/bin/env python3
"""Evaluate frozen human gold against preserved AI runs; emit no metrics when inputs are absent."""

from __future__ import annotations

import csv
import hashlib
import json
import math
import tempfile
from collections import defaultdict
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
GOLD = ROOT / "data/curated/ai_extraction_gold.csv"
RUNS = ROOT / "data/interim/ai_extraction_runs.jsonl"
RUN_MANIFEST = ROOT / "data/interim/ai_extraction_run_manifest.csv"
REVIEW = ROOT / "data/curated/ai_extraction_human_review.csv"
OUTPUT = ROOT / "research/extraction/ai_extraction_evaluation.json"
SCHEMA = ROOT / "research/design/20260710/04_EXTRACTION/llm_extraction_schema.json"
GOLD_FIELDS = ["gold_id", "report_id", "question_id", "field_name", "value_json", "unit", "locator_valid",
               "critical", "gold_status", "consensus_by", "frozen_at", "gold_row_sha256"]
REVIEW_FIELDS = ["run_id", "field_name", "quote_entails", "locator_correct", "wrong_arm", "wrong_timepoint",
                 "study_report_mixing", "critical_numeric_error", "reviewer_id", "reviewed_at", "review_row_sha256"]
MANIFEST_FIELDS = ["run_id", "input_path", "input_sha256", "prompt_path", "prompt_sha256", "raw_output_path",
                   "raw_output_sha256", "model_name", "model_version_or_access_date", "temperature", "api_or_app",
                   "attempt_count", "executed_at", "manifest_row_sha256"]


def sha_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def wilson(n: int, total: int, z: float = 1.959963984540054) -> list[float | None]:
    if total == 0:
        return [None, None]
    p = n / total
    d = 1 + z * z / total
    c = (p + z * z / (2 * total)) / d
    m = z * math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / d
    return [c - m, c + m]


def proportion(n: int, total: int) -> dict:
    return {"n": n, "N": total, "rate": n / total if total else None, "wilson95": wilson(n, total)}


def canonical(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def expected_gold_hash(row: dict) -> str:
    values = [row[field] for field in GOLD_FIELDS if field != "gold_row_sha256"]
    return sha_text("\x1f".join(values))


def validate_run_manifests(runs: list[dict], manifests: list[dict], root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    run_by_id = {run.get("run_id"): run for run in runs}
    manifest_by_id = {row["run_id"]: row for row in manifests}
    if len(manifest_by_id) != len(manifests):
        errors.append("duplicate AI run manifest run_id")
    if set(run_by_id) != set(manifest_by_id):
        errors.append("AI parsed runs and raw-run manifests must map one-to-one")
    for row_no, row in enumerate(manifests, 2):
        expected = sha_text("\x1f".join(row[field] for field in MANIFEST_FIELDS if field != "manifest_row_sha256"))
        if row["manifest_row_sha256"] != expected:
            errors.append(f"AI run manifest row {row_no}: hash mismatch")
        if not row["api_or_app"] or not row["executed_at"] or not row["attempt_count"].isdigit() or int(row["attempt_count"]) < 1:
            errors.append(f"AI run manifest row {row_no}: incomplete execution provenance")
        for path_field, hash_field in (("input_path", "input_sha256"), ("prompt_path", "prompt_sha256"),
                                       ("raw_output_path", "raw_output_sha256")):
            relative = Path(row[path_field])
            path = (root / relative).resolve()
            if relative.is_absolute() or "legacy_unverified" in relative.parts or not path.is_relative_to(root) or not path.is_file():
                errors.append(f"AI run manifest row {row_no}: invalid {path_field}")
            elif sha_file(path) != row[hash_field]:
                errors.append(f"AI run manifest row {row_no}: {hash_field} mismatch")
        run = run_by_id.get(row["run_id"])
        if run:
            model = run.get("model", {})
            if model.get("name") != row["model_name"] or model.get("version_or_access_date") != row["model_version_or_access_date"]:
                errors.append(f"AI run manifest row {row_no}: model identity mismatch")
            if canonical(model.get("temperature")) != row["temperature"]:
                errors.append(f"AI run manifest row {row_no}: temperature mismatch")
            if model.get("prompt_sha256") != row["prompt_sha256"] or run.get("input_sha256") != row["input_sha256"] or run.get("output_sha256") != row["raw_output_sha256"]:
                errors.append(f"AI run manifest row {row_no}: parsed/raw hash linkage mismatch")
    return errors


def load_inputs() -> tuple[list[dict], list[dict], list[dict], list[dict], list[str]]:
    errors: list[str] = []
    with GOLD.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != GOLD_FIELDS:
            errors.append("gold header mismatch")
        gold = list(reader)
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    runs = []
    for line_no, line in enumerate(RUNS.read_text(encoding="utf-8-sig").splitlines(), 1):
        if not line.strip():
            continue
        try:
            run = json.loads(line)
        except json.JSONDecodeError as exc:
            errors.append(f"run line {line_no}: invalid JSON: {exc.msg}")
            continue
        for error in validator.iter_errors(run):
            errors.append(f"run line {line_no}: schema: {error.message}")
        runs.append(run)
    with REVIEW.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != REVIEW_FIELDS:
            errors.append("human review header mismatch")
        reviews = list(reader)
    with RUN_MANIFEST.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != MANIFEST_FIELDS:
            errors.append("AI run manifest header mismatch")
        manifests = list(reader)
    for row_no, row in enumerate(gold, 2):
        if row["gold_status"] != "frozen_consensus":
            errors.append(f"gold row {row_no}: not frozen_consensus")
        if not row["consensus_by"] or not row["frozen_at"]:
            errors.append(f"gold row {row_no}: missing consensus provenance")
        if row["gold_row_sha256"] != expected_gold_hash(row):
            errors.append(f"gold row {row_no}: hash mismatch")
        try:
            json.loads(row["value_json"])
        except json.JSONDecodeError:
            errors.append(f"gold row {row_no}: invalid value_json")
    for row_no, row in enumerate(reviews, 2):
        expected = sha_text("\x1f".join(row[field] for field in REVIEW_FIELDS if field != "review_row_sha256"))
        if row["review_row_sha256"] != expected:
            errors.append(f"human review row {row_no}: hash mismatch")
        if not row["reviewer_id"] or not row["reviewed_at"]:
            errors.append(f"human review row {row_no}: missing reviewer provenance")
        for field in REVIEW_FIELDS[2:8]:
            if row[field].lower() not in {"true", "false"}:
                errors.append(f"human review row {row_no}: {field} must be true/false")
    errors.extend(validate_run_manifests(runs, manifests))
    return gold, runs, reviews, manifests, errors


def evaluate(gold: list[dict], runs: list[dict], reviews: list[dict] | None = None) -> dict:
    gold_by = {(r["report_id"], r["question_id"], r["field_name"]): r for r in gold}
    if len(gold_by) != len(gold):
        raise ValueError("duplicate gold key")
    predictions = []
    run_ids = set()
    for run in runs:
        if run["run_id"] in run_ids:
            raise ValueError("duplicate run_id")
        run_ids.add(run["run_id"])
        for field in run["fields"]:
            predictions.append((run, field))
    pred_keys = {(run["report_id"], run["question_id"], f["field_name"]) for run, f in predictions
                 if f["status"] == "extracted"}
    gold_keys = set(gold_by)
    tp_keys = pred_keys & gold_keys
    exact = unit = locator = numeric = numeric_N = 0
    critical_fn = []
    for key in tp_keys:
        gold_row = gold_by[key]
        matching = [(run, f) for run, f in predictions if (run["report_id"], run["question_id"], f["field_name"]) == key and f["status"] == "extracted"]
        # Primary accuracy uses every preserved repeat, while detection uses unique fields.
        for _, field in matching:
            expected = json.loads(gold_row["value_json"])
            exact += canonical(field.get("value")) == canonical(expected)
            unit += (field.get("unit") or "") == gold_row["unit"]
            loc = field.get("locator") or {}
            locator += bool(field.get("supporting_quote")) and bool(loc.get("page") is not None or loc.get("xml_locator"))
            if isinstance(expected, (int, float)) and not isinstance(expected, bool):
                numeric_N += 1
                numeric += isinstance(field.get("value"), (int, float)) and not isinstance(field.get("value"), bool) and field["value"] == expected
    for key in gold_keys - pred_keys:
        if gold_by[key]["critical"].lower() == "true":
            critical_fn.append("|".join(key))
    comparisons = sum(1 for run, field in predictions if field["status"] == "extracted" and
                      (run["report_id"], run["question_id"], field["field_name"]) in gold_by)
    tp, fp, fn = len(tp_keys), len(pred_keys - gold_keys), len(gold_keys - pred_keys)
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    f1 = 2 * precision * recall / (precision + recall) if precision is not None and recall is not None and precision + recall else None
    repeat_values: dict[tuple, set[str]] = defaultdict(set)
    repeat_counts: dict[tuple, int] = defaultdict(int)
    for run, field in predictions:
        key = (run["model"]["name"], run["model"]["version_or_access_date"], run["report_id"], run["question_id"], field["field_name"])
        repeat_values[key].add(canonical([field["status"], field.get("value"), field.get("unit")]))
        repeat_counts[key] += 1
    eligible_repeats = [key for key, count in repeat_counts.items() if count >= 3]
    stable = sum(len(repeat_values[key]) == 1 for key in eligible_repeats)
    result = {
        "status": "complete_human_gold_ai_runs_evaluated",
        "human_gold_fields": len(gold), "ai_runs": len(runs), "predicted_fields": len(pred_keys),
        "detection": {"tp": tp, "fp": fp, "fn": fn, "precision": precision, "recall": recall, "f1": f1},
        "exact_value": proportion(exact, comparisons), "numeric_value": proportion(numeric, numeric_N),
        "unit": proportion(unit, comparisons), "locator_present_contract": proportion(locator, comparisons),
        "unsupported_claims": proportion(fp, len(pred_keys)),
        "critical_false_negative_count": len(critical_fn), "critical_false_negative_keys": critical_fn,
        "repeat_stability": proportion(stable, len(eligible_repeats)),
    }
    if reviews is not None:
        review_by = {(r["run_id"], r["field_name"]): r for r in reviews}
        expected_review_keys = {(run["run_id"], field["field_name"]) for run, field in predictions}
        if len(review_by) != len(reviews) or set(review_by) != expected_review_keys:
            raise ValueError("human review rows must map one-to-one to every AI output field")
        total = len(reviews)
        truth = lambda field: sum(row[field].lower() == "true" for row in reviews)
        result["human_field_review"] = {
            "quote_entailment_accuracy": proportion(truth("quote_entails"), total),
            "locator_accuracy": proportion(truth("locator_correct"), total),
            "wrong_arm_rate": proportion(truth("wrong_arm"), total),
            "wrong_timepoint_rate": proportion(truth("wrong_timepoint"), total),
            "study_report_mixing_rate": proportion(truth("study_report_mixing"), total),
            "critical_numeric_error_count": truth("critical_numeric_error"),
        }
    return result


def contract_tests() -> dict:
    gold = [{"report_id": "R1", "question_id": "A1", "field_name": "events", "value_json": "4", "unit": "events", "critical": "true"}]
    model = {"name": "fixture", "version_or_access_date": "test"}
    run = {"run_id": "T1", "report_id": "R1", "question_id": "A1", "model": model,
           "fields": [{"field_name": "events", "status": "extracted", "value": 4, "unit": "events", "supporting_quote": "four", "locator": {"page": 1}}]}
    good = evaluate(gold, [run])
    missed = evaluate(gold, [dict(run, run_id="T2", fields=[])])
    unsupported = evaluate(gold, [dict(run, run_id="T3", fields=[dict(run["fields"][0], field_name="invented")])])
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        for name, value in (("input.txt", b"input"), ("prompt.txt", b"prompt"), ("output.txt", b"output")):
            (root / name).write_bytes(value)
        hashes = {name: sha_file(root / name) for name in ("input.txt", "prompt.txt", "output.txt")}
        raw_run = {"run_id": "RAW1", "input_sha256": hashes["input.txt"], "output_sha256": hashes["output.txt"],
                   "model": {"name": "fixture", "version_or_access_date": "test", "temperature": None,
                             "prompt_sha256": hashes["prompt.txt"]}}
        manifest = {"run_id": "RAW1", "input_path": "input.txt", "input_sha256": hashes["input.txt"],
                    "prompt_path": "prompt.txt", "prompt_sha256": hashes["prompt.txt"], "raw_output_path": "output.txt",
                    "raw_output_sha256": hashes["output.txt"], "model_name": "fixture", "model_version_or_access_date": "test",
                    "temperature": "null", "api_or_app": "fixture", "attempt_count": "1", "executed_at": "2026-07-10T00:00:00Z"}
        manifest["manifest_row_sha256"] = sha_text("\x1f".join(manifest[field] for field in MANIFEST_FIELDS if field != "manifest_row_sha256"))
        valid_manifest = not validate_run_manifests([raw_run], [manifest], root)
        bad_hash = dict(manifest, input_sha256="f" * 64)
        bad_hash["manifest_row_sha256"] = sha_text("\x1f".join(bad_hash[field] for field in MANIFEST_FIELDS if field != "manifest_row_sha256"))
        wrong_hash_rejected = bool(validate_run_manifests([raw_run], [bad_hash], root))
    return {"exact_match": good["exact_value"]["rate"] == 1, "critical_fn": missed["critical_false_negative_count"] == 1,
            "unsupported": unsupported["unsupported_claims"]["n"] == 1, "raw_manifest_valid": valid_manifest,
            "raw_manifest_wrong_hash_rejected": wrong_hash_rejected}


def main() -> int:
    gold, runs, reviews, manifests, errors = load_inputs()
    tests = contract_tests()
    if not all(tests.values()):
        errors.append("internal contract test failure")
    if errors:
        result = {"status": "invalid_inputs_no_performance_metrics", "errors": errors, "contract_tests": tests}
    elif not gold or not runs:
        result = {"status": "blocked_external_no_performance_metrics", "errors": [], "human_gold_fields": len(gold),
                  "ai_runs": len(runs), "raw_run_manifests": len(manifests), "human_review_rows": len(reviews), "metrics": None, "contract_tests": tests}
    elif not reviews:
        result = {"status": "blocked_external_missing_human_ai_field_review_no_performance_metrics", "errors": [],
                  "human_gold_fields": len(gold), "ai_runs": len(runs), "human_review_rows": 0,
                  "metrics": None, "contract_tests": tests}
    else:
        try:
            result = {"errors": [], "contract_tests": tests, **evaluate(gold, runs, reviews)}
        except ValueError as exc:
            result = {"status": "invalid_inputs_no_performance_metrics", "errors": [str(exc)], "contract_tests": tests}
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 1 if result["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
