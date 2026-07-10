#!/usr/bin/env python3
"""Generate reproducible Phase 01 repository and legacy-data audit artifacts."""

from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.metadata
import json
import os
import shutil
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


CURRENT_STUDY_INGREDIENT_IDS = {
    "vitamin_k",
    "omega3_epa_dha",
    "glucosamine_chondroitin",
    "coenzyme_q10",
    "multivitamin_multimineral",
    "milk_thistle_silymarin",
    "vitamin_d",
    "calcium",
    "vitamin_c",
}

SELF_REFERENTIAL_AUDIT_OUTPUTS = {
    "data/legacy_unverified/manifest.json",
    "research/audit/repo_inventory.json",
    "research/audit/phase_01_artifact_manifest.json",
}

PYTHON_REQUIREMENT_DISTRIBUTIONS = {
    "requests": "requests",
    "pandas": "pandas",
    "pydantic": "pydantic",
    "python-dotenv": "python-dotenv",
    "rispy": "rispy",
    "playwright": "playwright",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def command(repo: Path, *args: str, allow_failure: bool = False) -> str:
    executable = shutil.which(args[0]) or args[0]
    argv = [executable, *args[1:]]
    process = subprocess.run(
        argv,
        cwd=repo,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=60,
    )
    output = process.stdout.strip()
    if process.returncode != 0 and not allow_failure:
        raise RuntimeError(
            f"command failed ({process.returncode}): {' '.join(args)}\n{process.stderr.strip()}"
        )
    if process.returncode != 0:
        return f"ERROR[{process.returncode}]: {process.stderr.strip()}"
    return output


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    last_error: Exception | None = None
    for encoding in ("utf-8-sig", "utf-8", "cp949"):
        try:
            with path.open("r", encoding=encoding, newline="") as handle:
                return list(csv.DictReader(handle))
        except UnicodeDecodeError as exc:
            last_error = exc
    raise RuntimeError(f"unable to decode CSV {path}: {last_error}")


def file_record(path: Path, root: Path) -> dict[str, Any]:
    stat = path.stat()
    return {
        "path": path.relative_to(root).as_posix(),
        "size_bytes": stat.st_size,
        "modified_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc)
        .replace(microsecond=0)
        .isoformat(),
        "sha256": sha256(path),
    }


def git_files(repo: Path) -> list[dict[str, Any]]:
    output = command(
        repo,
        "git",
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
    )
    records: list[dict[str, Any]] = []
    for relative in sorted(item for item in output.split("\0") if item):
        if relative.replace("\\", "/") in SELF_REFERENTIAL_AUDIT_OUTPUTS:
            continue
        path = repo / relative
        if path.is_file():
            records.append(file_record(path, repo))
    return records


def research_input_files(root: Path) -> tuple[list[dict[str, Any]], Counter[str]]:
    records: list[dict[str, Any]] = []
    extensions: Counter[str] = Counter()
    for path in sorted(candidate for candidate in root.rglob("*") if candidate.is_file()):
        records.append(file_record(path, root))
        extensions[path.suffix.lower() or "[no suffix]"] += 1
    return records, extensions


def research_input_snapshot(repo: Path) -> tuple[list[dict[str, Any]], Counter[str], dict[str, Any]]:
    """Load the preserved source audit when the mounted research drive is unavailable."""
    report_path = repo / "research" / "audit" / "legacy_source_audit" / "audit_report.json"
    report = read_json(report_path)
    records = list(report.get("files", []))
    extensions: Counter[str] = Counter(
        {str(key): int(value) for key, value in report.get("extension_counts", {}).items()}
    )
    provenance = {
        "verification_mode": "preserved_audit_snapshot",
        "live_reaccessed": False,
        "source_report": report_path.relative_to(repo).as_posix(),
        "source_report_sha256": sha256(report_path),
        "snapshot_root": report.get("root"),
        "limitation": "The G: research drive is not readable in this sandbox session.",
    }
    return records, extensions, provenance


def manifest_check(design_root: Path) -> dict[str, Any]:
    manifest_path = design_root / "manifest.json"
    manifest = read_json(manifest_path)
    mismatches: list[dict[str, str]] = []
    for item in manifest.get("files", []):
        path = design_root / item["path"]
        if not path.is_file():
            mismatches.append({"path": item["path"], "issue": "missing"})
            continue
        actual_size = path.stat().st_size
        actual_sha = sha256(path)
        if actual_size != item["size_bytes"]:
            mismatches.append(
                {
                    "path": item["path"],
                    "issue": f"size expected={item['size_bytes']} actual={actual_size}",
                }
            )
        if actual_sha != item["sha256"]:
            mismatches.append(
                {
                    "path": item["path"],
                    "issue": f"sha256 expected={item['sha256']} actual={actual_sha}",
                }
            )
    actual_files = [path for path in design_root.rglob("*") if path.is_file()]
    return {
        "manifest_path": str(manifest_path),
        "manifest_declared_file_count_excluding_manifest": manifest.get("file_count"),
        "manifest_entry_count": len(manifest.get("files", [])),
        "actual_file_count_including_manifest": len(actual_files),
        "mismatch_count": len(mismatches),
        "mismatches": mismatches,
        "manifest_sha256": sha256(manifest_path),
    }


def python_versions() -> dict[str, str | None]:
    versions: dict[str, str | None] = {}
    for label, distribution in PYTHON_REQUIREMENT_DISTRIBUTIONS.items():
        try:
            versions[label] = importlib.metadata.version(distribution)
        except importlib.metadata.PackageNotFoundError:
            versions[label] = None
    return versions


def duplicates(values: Iterable[str]) -> list[str]:
    counts = Counter(value for value in values if value)
    return sorted(value for value, count in counts.items() if count > 1)


def flatten_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True).lower()


def infer_question(rule: dict[str, Any]) -> str:
    ingredient = rule.get("ingredient_id", "")
    text = flatten_json(rule)
    if ingredient == "vitamin_k" and any(
        token in text for token in ("warfarin", "항응고", "vitamin k antagonist", "vka")
    ):
        return "A1_candidate"
    if ingredient == "omega3_epa_dha" and any(
        token in text for token in ("warfarin", "항응고", "anticoagul", "doac", "bleed", "출혈")
    ):
        return "A2_candidate"
    if ingredient == "calcium" and any(
        token in text for token in ("kidney_stone", "kidney stone", "nephrolith", "hypercalciur", "결석", "고칼슘뇨")
    ):
        return "B1_candidate"
    if ingredient == "vitamin_d" and any(
        token in text
        for token in (
            "kidney_stone",
            "kidney stone",
            "nephrolith",
            "hypercalciur",
            "hypercalcem",
            "결석",
            "고칼슘",
        )
    ):
        return "B2_candidate"
    if ingredient == "vitamin_c" and any(
        token in text for token in ("kidney_stone", "kidney stone", "nephrolith", "hyperoxal", "oxalate", "결석", "옥살")
    ):
        return "B3_candidate"
    return "none"


def locator_type(chunk: dict[str, Any]) -> str:
    nested = chunk.get("locator") or {}
    return str(nested.get("locator_type") or chunk.get("locator_type") or "").strip()


def locator_value(chunk: dict[str, Any]) -> str:
    nested = chunk.get("locator") or {}
    return str(nested.get("locator_value") or chunk.get("locator_value") or "").strip()


def knowledge_profile(repo: Path) -> dict[str, Any]:
    legacy_root = repo / "data" / "legacy_unverified" / "baseline-33658e3"
    pack = read_json(legacy_root / "knowledge_pack.json")
    generated = read_json(repo / "src" / "generated" / "legacy" / "knowledge-index.json")
    sources = pack.get("sources", [])
    ingredients = pack.get("ingredients", [])
    chunks = pack.get("evidence_chunks", [])
    rules = pack.get("safety_rules", [])
    source_ids = {item.get("source_id") for item in sources}
    chunk_ids = {item.get("chunk_id") for item in chunks}
    ingredient_ids = {item.get("ingredient_id") for item in ingredients}
    missing_rule_source_refs = sorted(
        {
            source_id
            for rule in rules
            for source_id in rule.get("source_ids", [])
            if source_id not in source_ids
        }
    )
    missing_rule_chunk_refs = sorted(
        {
            chunk_id
            for rule in rules
            for chunk_id in rule.get("evidence_chunk_ids", [])
            if chunk_id not in chunk_ids
        }
    )
    missing_chunk_source_refs = sorted(
        {
            chunk.get("source_id")
            for chunk in chunks
            if chunk.get("source_id") not in source_ids
        }
    )
    missing_rule_ingredients = sorted(
        {
            rule.get("ingredient_id")
            for rule in rules
            if rule.get("ingredient_id") not in ingredient_ids
        }
    )
    exposed_rules = [
        rule for rule in rules if rule.get("ingredient_id") in CURRENT_STUDY_INGREDIENT_IDS
    ]
    exposed_sources = {
        source_id for rule in exposed_rules for source_id in rule.get("source_ids", [])
    }
    exposed_chunks = {
        chunk_id for rule in exposed_rules for chunk_id in rule.get("evidence_chunk_ids", [])
    }
    return {
        "raw_actual_counts": {
            "sources": len(sources),
            "ingredients": len(ingredients),
            "evidence_chunks": len(chunks),
            "safety_rules": len(rules),
        },
        "raw_declared_counts": pack.get("package_meta", {}).get("counts", {}),
        "generated_meta": generated.get("meta", {}),
        "review_status_counts": dict(
            sorted(Counter(str(rule.get("review_status") or "[blank]") for rule in rules).items())
        ),
        "evidence_verification_status_counts": dict(
            sorted(Counter(str(chunk.get("verification_status") or "[blank]") for chunk in chunks).items())
        ),
        "locator_type_counts": dict(
            sorted(Counter(locator_type(chunk) or "[blank]" for chunk in chunks).items())
        ),
        "extraction_method_counts": dict(
            sorted(Counter(str(chunk.get("extraction_method") or "[blank]") for chunk in chunks).items())
        ),
        "complete_locator_count": sum(
            bool(locator_type(chunk) and locator_value(chunk)) for chunk in chunks
        ),
        "duplicate_ids": {
            "source_ids": duplicates(str(item.get("source_id") or "") for item in sources),
            "ingredient_ids": duplicates(str(item.get("ingredient_id") or "") for item in ingredients),
            "evidence_chunk_ids": duplicates(str(item.get("chunk_id") or "") for item in chunks),
            "rule_ids": duplicates(str(item.get("rule_id") or "") for item in rules),
        },
        "missing_references": {
            "rule_to_source": missing_rule_source_refs,
            "rule_to_evidence_chunk": missing_rule_chunk_refs,
            "evidence_chunk_to_source": missing_chunk_source_refs,
            "rule_to_ingredient": missing_rule_ingredients,
        },
        "current_ui_scope": {
            "ingredient_ids": sorted(CURRENT_STUDY_INGREDIENT_IDS),
            "ingredients": len(CURRENT_STUDY_INGREDIENT_IDS),
            "rules": len(exposed_rules),
            "sources": len(exposed_sources),
            "evidence_chunks": len(exposed_chunks),
        },
    }


def write_rule_scope_report(repo: Path, output: Path) -> None:
    pack = read_json(
        repo / "data" / "legacy_unverified" / "baseline-33658e3" / "knowledge_pack.json"
    )
    sources = {item["source_id"]: item for item in pack.get("sources", [])}
    chunks = {item["chunk_id"]: item for item in pack.get("evidence_chunks", [])}
    fieldnames = [
        "legacy_rule_id",
        "ingredient_id",
        "rule_name_ko",
        "legacy_review_status",
        "quarantine_status",
        "protocol_question_candidate",
        "candidate_scope",
        "currently_exposed_by_study_filter",
        "thesis_mode_eligible",
        "source_ref_count",
        "evidence_ref_count",
        "missing_source_ref_count",
        "missing_evidence_ref_count",
        "missing_locator_count",
        "non_full_text_support_count",
        "evidence_verification_statuses",
        "issue_codes",
    ]
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for rule in pack.get("safety_rules", []):
            question = infer_question(rule)
            ingredient = rule.get("ingredient_id", "")
            exposed = ingredient in CURRENT_STUDY_INGREDIENT_IDS
            if question != "none":
                candidate_scope = "validated_thesis_scope_candidate_only"
            elif exposed:
                candidate_scope = "exploratory_demo"
            else:
                candidate_scope = "future_scope"
            source_refs = rule.get("source_ids", [])
            chunk_refs = rule.get("evidence_chunk_ids", [])
            missing_sources = [value for value in source_refs if value not in sources]
            missing_chunks = [value for value in chunk_refs if value not in chunks]
            linked_chunks = [chunks[value] for value in chunk_refs if value in chunks]
            missing_locators = [
                chunk
                for chunk in linked_chunks
                if not locator_type(chunk) or not locator_value(chunk)
            ]
            non_full_text = [
                chunk
                for chunk in linked_chunks
                if locator_type(chunk) not in {"full_text", "table"}
                or chunk.get("extraction_method")
                not in {"manual_from_pdf_source", "manual_from_pmc"}
            ]
            statuses = sorted(
                {str(chunk.get("verification_status") or "[blank]") for chunk in linked_chunks}
            )
            issues = ["LEGACY_REVIEW_STATUS_UNTRUSTED", "NO_VALIDATED_CLAIM_LINK"]
            if question != "none":
                issues.append("CANDIDATE_REQUIRES_FULL_REVALIDATION")
            if exposed and question == "none":
                issues.append("CURRENT_UI_OUT_OF_PROTOCOL_SCOPE")
            if missing_sources:
                issues.append("MISSING_SOURCE_REFERENCE")
            if missing_chunks:
                issues.append("MISSING_EVIDENCE_REFERENCE")
            if missing_locators:
                issues.append("MISSING_LOCATOR")
            if non_full_text:
                issues.append("NON_FULL_TEXT_OR_WEAK_EXTRACTION_SUPPORT")
            if any(status != "verified_against_source" for status in statuses):
                issues.append("UNVERIFIED_EVIDENCE_STATUS")
            writer.writerow(
                {
                    "legacy_rule_id": rule.get("rule_id", ""),
                    "ingredient_id": ingredient,
                    "rule_name_ko": rule.get("rule_name_ko", ""),
                    "legacy_review_status": rule.get("review_status", ""),
                    "quarantine_status": "legacy_unverified",
                    "protocol_question_candidate": question,
                    "candidate_scope": candidate_scope,
                    "currently_exposed_by_study_filter": str(exposed).lower(),
                    "thesis_mode_eligible": "false",
                    "source_ref_count": len(source_refs),
                    "evidence_ref_count": len(chunk_refs),
                    "missing_source_ref_count": len(missing_sources),
                    "missing_evidence_ref_count": len(missing_chunks),
                    "missing_locator_count": len(missing_locators),
                    "non_full_text_support_count": len(non_full_text),
                    "evidence_verification_statuses": ";".join(statuses),
                    "issue_codes": ";".join(sorted(set(issues))),
                }
            )


def append_metric(
    rows: list[dict[str, Any]],
    metric: str,
    value: Any,
    unit: str,
    stage: str,
    source_path: str,
    derivation: str,
    status: str,
    note: str,
) -> None:
    rows.append(
        {
            "metric": metric,
            "observed_value": value,
            "unit": unit,
            "stage": stage,
            "source_path": source_path,
            "derivation": derivation,
            "status": status,
            "note": note,
        }
    )


def write_count_reconciliation(repo: Path, output: Path) -> None:
    rows: list[dict[str, Any]] = []
    legacy_root = repo / "data" / "legacy_unverified" / "baseline-33658e3"
    pack = read_json(legacy_root / "knowledge_pack.json")
    rules = pack.get("safety_rules", [])
    chunks = pack.get("evidence_chunks", [])
    sources = pack.get("sources", [])
    search_path = legacy_root / "systematic_search" / "search_runs.csv"
    search_rows = read_csv_rows(search_path)
    latest_date = max(row["search_date"] for row in search_rows)
    latest_rows = [row for row in search_rows if row["search_date"] == latest_date]
    retrieved_path = legacy_root / "systematic_search" / "retrieved_records.csv"
    retrieved_rows = read_csv_rows(retrieved_path)
    screening_path = legacy_root / "systematic_search" / "screening_log.csv"
    screening_rows = read_csv_rows(screening_path)
    secondary_path = (
        legacy_root
        / "systematic_search"
        / "secondary_search_runs_20260603.csv"
    )
    secondary_rows = read_csv_rows(secondary_path)
    scenarios_path = (
        legacy_root
        / "systematic_search"
        / "scenario_evaluation_20260603.csv"
    )
    scenario_rows = read_csv_rows(scenarios_path)
    exposed_rules = [
        rule for rule in rules if rule.get("ingredient_id") in CURRENT_STUDY_INGREDIENT_IDS
    ]
    exposed_sources = {
        source_id for rule in exposed_rules for source_id in rule.get("source_ids", [])
    }
    exposed_chunks = {
        chunk_id for rule in exposed_rules for chunk_id in rule.get("evidence_chunk_ids", [])
    }
    append_metric(
        rows,
        "pubmed_hit_all_runs_sum",
        sum(int(row["hit_count"]) for row in search_rows),
        "records",
        "mixed pilot runs",
        "data/legacy_unverified/baseline-33658e3/systematic_search/search_runs.csv",
        "sum(hit_count) across 4 runs",
        "invalid_as_research_result",
        "This is the 12,023 homepage value and mixes May 31 and June 3 runs.",
    )
    append_metric(
        rows,
        "pubmed_hit_latest_date",
        sum(int(row["hit_count"]) for row in latest_rows),
        "records",
        latest_date,
        "data/legacy_unverified/baseline-33658e3/systematic_search/search_runs.csv",
        "sum(hit_count) where search_date is latest",
        "pilot_truncated",
        "The June 3 runs total 8,957 hits but each exported only top 100 by relevance.",
    )
    append_metric(
        rows,
        "pubmed_stored_cumulative",
        len(retrieved_rows),
        "records",
        "retrieved rows",
        "data/legacy_unverified/baseline-33658e3/systematic_search/retrieved_records.csv",
        "CSV row count",
        "legacy_unverified",
        "Cumulative candidates are not full exports or included studies.",
    )
    append_metric(
        rows,
        "secondary_hit_total",
        sum(int(row["hit_count"]) for row in secondary_rows),
        "hits",
        "mixed Europe PMC and Crossref",
        "data/legacy_unverified/baseline-33658e3/systematic_search/secondary_search_runs_20260603.csv",
        "sum(hit_count)",
        "invalid_as_evidence_volume",
        "The 252,502 total mixes bibliographic Crossref and overlapping Europe PMC hits.",
    )
    append_metric(
        rows,
        "secondary_stored_records",
        sum(int(row["stored_records"]) for row in secondary_rows),
        "records",
        "top 20 per query",
        "data/legacy_unverified/baseline-33658e3/systematic_search/secondary_search_runs_20260603.csv",
        "sum(stored_records)",
        "pilot_truncated",
        "Stored 80 records from four capped queries.",
    )
    decisions = Counter(row.get("suggested_decision", "") for row in screening_rows)
    for decision, count in sorted(decisions.items()):
        append_metric(
            rows,
            f"screening_classifier_{decision or 'blank'}",
            count,
            "records",
            "automated title/abstract triage",
            "data/legacy_unverified/baseline-33658e3/systematic_search/screening_log.csv",
            f"count where suggested_decision={decision}",
            "not_human_screening",
            "Must not be reported as final inclusion/exclusion.",
        )
    append_metric(
        rows,
        "legacy_sources",
        len(sources),
        "sources",
        "legacy knowledge pack",
        "data/legacy_unverified/baseline-33658e3/knowledge_pack.json",
        "len(sources)",
        "legacy_unverified",
        "Mixed evidence layers.",
    )
    append_metric(
        rows,
        "legacy_evidence_chunks",
        len(chunks),
        "chunks",
        "legacy knowledge pack",
        "data/legacy_unverified/baseline-33658e3/knowledge_pack.json",
        "len(evidence_chunks)",
        "legacy_unverified",
        "Chunks are not validated evidence claims.",
    )
    append_metric(
        rows,
        "legacy_rules",
        len(rules),
        "rules",
        "legacy knowledge pack",
        "data/legacy_unverified/baseline-33658e3/knowledge_pack.json",
        "len(safety_rules)",
        "legacy_unverified",
        "All carry starter_validated, which is not accepted as thesis validation.",
    )
    append_metric(
        rows,
        "current_ui_rules",
        len(exposed_rules),
        "rules",
        "ingredient-only study filter",
        "src/lib/study-scope.ts + data/legacy_unverified/baseline-33658e3/knowledge_pack.json",
        "rules where ingredient_id is in current studyIngredientIdSet",
        "scope_contaminated",
        "Includes explicitly out-of-protocol ingredients.",
    )
    append_metric(
        rows,
        "current_ui_sources",
        len(exposed_sources),
        "sources",
        "ingredient-only study filter",
        "src/lib/knowledge/index.ts + data/legacy_unverified/baseline-33658e3/knowledge_pack.json",
        "unique source_ids for current UI rules",
        "legacy_unverified",
        "Displayed as evidence sources despite no validated claim layer.",
    )
    append_metric(
        rows,
        "current_ui_evidence_chunks",
        len(exposed_chunks),
        "chunks",
        "ingredient-only study filter",
        "src/lib/knowledge/index.ts + data/legacy_unverified/baseline-33658e3/knowledge_pack.json",
        "unique evidence_chunk_ids for current UI rules",
        "legacy_unverified",
        "Displayed as evidence chunks despite no validated claim layer.",
    )
    append_metric(
        rows,
        "legacy_scenarios",
        len(scenario_rows),
        "scenarios",
        "developer-created baseline",
        "data/legacy_unverified/baseline-33658e3/systematic_search/scenario_evaluation_20260603.csv",
        "CSV row count",
        "not_independent_validation",
        "Five scenarios cannot support performance claims.",
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def write_legacy_manifest(repo: Path, output: Path) -> None:
    legacy_root = repo / "data" / "legacy_unverified" / "baseline-33658e3"
    generated_legacy_root = repo / "src" / "generated" / "legacy"
    legacy_paths = [
        legacy_root / "knowledge_pack.json",
        legacy_root / "manifest.json",
        legacy_root / "package_meta.json",
        legacy_root / "source_registry.json",
        legacy_root / "evidence_chunks.json",
        legacy_root / "ingredients.json",
        legacy_root / "safety_rules.json",
        legacy_root / "sample_user_profile.json",
        legacy_root / "sample_evaluation_input.json",
        legacy_root / "sample_engine_output.json",
        legacy_root / "systematic_search",
        generated_legacy_root / "knowledge-index.json",
        generated_legacy_root / "literature-candidates.json",
    ]
    files: list[Path] = []
    for path in legacy_paths:
        if path.is_file():
            files.append(path)
        elif path.is_dir():
            files.extend(candidate for candidate in path.rglob("*") if candidate.is_file())
    unique_files = sorted(set(files))
    manifest = {
        "schema_version": "1.0.0",
        "generated_at": utc_now(),
        "baseline_commit": command(repo, "git", "rev-parse", "HEAD"),
        "status": "legacy_unverified",
        "physical_quarantine_root": "data/legacy_unverified/baseline-33658e3",
        "policy": {
            "delete_originals": False,
            "automatic_validation_promotion": False,
            "thesis_bundle_default_include": False,
            "allowed_uses": [
                "search-term seed",
                "recall check after new search",
                "regression comparison",
                "historical audit",
            ],
            "prohibited_uses": [
                "final included-study set",
                "validated evidence claim",
                "validated thesis rule",
                "thesis performance result",
            ],
        },
        "file_count": len(unique_files),
        "files": [
            {
                **file_record(path, repo),
                "original_path": (
                    "data/" + path.relative_to(legacy_root).as_posix()
                    if path.is_relative_to(legacy_root)
                    else "src/generated/"
                    + path.relative_to(generated_legacy_root).as_posix()
                ),
                "status": "legacy_unverified",
                "storage_mode": "physical_quarantine",
            }
            for path in unique_files
        ],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--research-input", type=Path, required=True)
    parser.add_argument("--design-root", type=Path, required=True)
    args = parser.parse_args()
    repo = args.repo.resolve()
    research_input = args.research_input.resolve()
    design_root = args.design_root.resolve()
    audit_dir = repo / "research" / "audit"
    audit_dir.mkdir(parents=True, exist_ok=True)

    input_records, input_extensions = research_input_files(research_input)
    input_provenance: dict[str, Any] = {
        "verification_mode": "live_filesystem_hash",
        "live_reaccessed": True,
    }
    if not input_records:
        input_records, input_extensions, input_provenance = research_input_snapshot(repo)
    package_json = read_json(repo / "package.json")
    npm_tree_raw = command(repo, "npm", "ls", "--depth=0", "--json", allow_failure=True)
    try:
        npm_tree: Any = json.loads(npm_tree_raw)
    except json.JSONDecodeError:
        npm_tree = {"raw": npm_tree_raw}
    inventory = {
        "schema_version": "1.0.0",
        "generated_at": utc_now(),
        "repository": {
            "root": str(repo),
            "branch": command(repo, "git", "branch", "--show-current"),
            "head": command(repo, "git", "rev-parse", "HEAD"),
            "origin_main": command(repo, "git", "rev-parse", "origin/main"),
            "status_porcelain": command(repo, "git", "status", "--porcelain=v1"),
            "remotes": command(repo, "git", "remote", "-v").splitlines(),
            "tags": command(
                repo,
                "git",
                "for-each-ref",
                "--format=%(refname:short) %(objectname) %(*objectname) %(subject)",
                "refs/tags",
            ).splitlines(),
            "files": git_files(repo),
        },
        "environment": {
            "os": os.name,
            "python": sys.version.replace("\n", " "),
            "node": command(repo, "node", "--version"),
            "npm": command(repo, "npm", "--version"),
            "package_json": package_json,
            "npm_tree": npm_tree,
            "requirements_txt": (
                repo / "requirements.txt"
            ).read_text(encoding="utf-8-sig").splitlines(),
            "python_requirement_versions": python_versions(),
        },
        "design_package": manifest_check(design_root),
        "research_input": {
            "root": str(research_input),
            "file_count": len(input_records),
            "total_size_bytes": sum(item["size_bytes"] for item in input_records),
            "extension_counts": dict(sorted(input_extensions.items())),
            "files": input_records,
            "provenance": input_provenance,
        },
        "legacy_knowledge": knowledge_profile(repo),
    }
    (audit_dir / "repo_inventory.json").write_text(
        json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    write_rule_scope_report(repo, audit_dir / "rule_scope_report.csv")
    write_count_reconciliation(repo, audit_dir / "legacy_counts_reproduction.csv")
    write_legacy_manifest(repo, repo / "data" / "legacy_unverified" / "manifest.json")
    print(
        json.dumps(
            {
                "repo_files": len(inventory["repository"]["files"]),
                "research_input_files": len(input_records),
                "package_manifest_mismatches": inventory["design_package"]["mismatch_count"],
                "rule_scope_rows": len(
                    read_json(
                        repo
                        / "data"
                        / "legacy_unverified"
                        / "baseline-33658e3"
                        / "knowledge_pack.json"
                    ).get("safety_rules", [])
                ),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
