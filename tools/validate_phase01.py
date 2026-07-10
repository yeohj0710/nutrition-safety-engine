#!/usr/bin/env python3
"""Validate Phase 01 artifacts and write a checksummed artifact manifest."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path
from typing import Any


REPO = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    "docs/superpowers/plans/2026-07-10-phase-01-audit-and-normalization.md",
    "docs/superpowers/plans/2026-07-10-phase-01-mode-isolation.md",
    "research/logs/WORKLOG.md",
    "research/logs/DECISIONS.md",
    "research/logs/RISKS.md",
    "research/logs/BLOCKERS.md",
    "research/audit/repo_inventory.json",
    "research/audit/data_lineage.md",
    "research/audit/deployment_baseline.json",
    "research/audit/hardcoded_counts_report.md",
    "research/audit/rule_scope_report.csv",
    "research/audit/test_gap_report.md",
    "research/audit/legacy_counts_reproduction.csv",
    "research/audit/phase_01_issue_register.csv",
    "research/audit/legacy_move_hashes.json",
    "research/audit/runtime_ai_archive.json",
    "research/review_queue/phase_01_external_review.csv",
    "data/legacy_unverified/manifest.json",
    "data/curated/README.md",
    "data/curated/claims.jsonl",
    "data/curated/rules.jsonl",
    "data/curated/sources.jsonl",
    "data/curated/reports.jsonl",
    "data/curated/studies.jsonl",
    "data/curated/extractions.jsonl",
    "data/curated/risk_of_bias.jsonl",
    "scripts/build-thesis-bundle.ts",
    "src/generated/thesis-bundle.json",
    "__tests__/thesis-bundle-isolation.test.ts",
    "__tests__/thesis-mode-boundary.test.ts",
    "__tests__/legacy-mode-boundary.test.ts",
    "tools/phase01_audit.py",
    "tools/validate_phase01.py",
]

FORBIDDEN_PLACEHOLDER_PATTERNS = (
    "TBD",
    "implement later",
    "fill in details",
    "Add appropriate error handling",
    "Write tests for the above",
    "Similar to Task",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(relative: str) -> Any:
    return json.loads((REPO / relative).read_text(encoding="utf-8-sig"))


def load_csv(relative: str) -> list[dict[str, str]]:
    with (REPO / relative).open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def check(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def build_artifact_manifest() -> dict[str, Any]:
    roots = [
        REPO / "research" / "audit",
        REPO / "research" / "logs",
        REPO / "research" / "review_queue",
        REPO / "data" / "curated",
    ]
    explicit = [
        REPO / "data" / "legacy_unverified" / "manifest.json",
        REPO / "src" / "generated" / "thesis-bundle.json",
        REPO / "scripts" / "build-thesis-bundle.ts",
        REPO / "tools" / "phase01_audit.py",
        REPO / "tools" / "validate_phase01.py",
        REPO / "__tests__" / "thesis-bundle-isolation.test.ts",
        REPO
        / "docs"
        / "superpowers"
        / "plans"
        / "2026-07-10-phase-01-audit-and-normalization.md",
    ]
    files: set[Path] = set()
    for root in roots:
        files.update(path for path in root.rglob("*") if path.is_file())
    files.update(path for path in explicit if path.is_file())
    manifest_path = REPO / "research" / "audit" / "phase_01_artifact_manifest.json"
    files.discard(manifest_path)
    records = []
    for path in sorted(files):
        records.append(
            {
                "path": path.relative_to(REPO).as_posix(),
                "size_bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
        )
    return {
        "schema_version": "1.0.0",
        "phase": "01_audit_and_normalization",
        "manifest_self_excluded": True,
        "file_count": len(records),
        "files": records,
    }


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    for relative in REQUIRED_FILES:
        path = REPO / relative
        check(path.is_file(), f"missing required file: {relative}", errors)
        if path.is_file() and relative not in {
            "data/curated/claims.jsonl",
            "data/curated/rules.jsonl",
            "data/curated/sources.jsonl",
            "data/curated/reports.jsonl",
            "data/curated/studies.jsonl",
            "data/curated/extractions.jsonl",
            "data/curated/risk_of_bias.jsonl",
        }:
            check(path.stat().st_size > 0, f"empty required file: {relative}", errors)

    if errors:
        print(json.dumps({"errors": errors, "warnings": warnings}, ensure_ascii=False, indent=2))
        return 1

    inventory = load_json("research/audit/repo_inventory.json")
    deployment = load_json("research/audit/deployment_baseline.json")
    legacy_manifest = load_json("data/legacy_unverified/manifest.json")
    thesis_bundle = load_json("src/generated/thesis-bundle.json")
    rule_rows = load_csv("research/audit/rule_scope_report.csv")
    count_rows = load_csv("research/audit/legacy_counts_reproduction.csv")
    issue_rows = load_csv("research/audit/phase_01_issue_register.csv")
    review_rows = load_csv("research/review_queue/phase_01_external_review.csv")

    check(inventory["design_package"]["mismatch_count"] == 0, "design package hash mismatch", errors)
    check(inventory["research_input"]["file_count"] == 513, "unexpected research input file count", errors)
    check(
        inventory["repository"]["head"]
        == "33658e3a9ee8dbf6d21ac94a5aa49202b5bf22e5",
        "baseline HEAD changed before Phase 01 commit",
        errors,
    )
    check(
        inventory["repository"]["origin_main"]
        == "33658e3a9ee8dbf6d21ac94a5aa49202b5bf22e5",
        "origin/main differs from audited baseline",
        errors,
    )
    check(deployment["production"]["head_matches_deployment"] is True, "deployment/HEAD mismatch", errors)
    check(deployment["validated_deployment"] is False, "legacy production incorrectly marked validated", errors)
    check(len(rule_rows) == 110, "rule scope report must contain 110 legacy rules", errors)
    check(
        all(row["quarantine_status"] == "legacy_unverified" for row in rule_rows),
        "at least one legacy rule escaped quarantine",
        errors,
    )
    check(
        all(row["thesis_mode_eligible"] == "false" for row in rule_rows),
        "at least one legacy rule was auto-promoted",
        errors,
    )
    check(
        sum(row["currently_exposed_by_study_filter"] == "true" for row in rule_rows)
        == 37,
        "current UI scope count is not reproducible",
        errors,
    )
    check(len(count_rows) == 17, "legacy count reproduction row count changed", errors)
    check(len(issue_rows) >= 10, "critical issues are not fully registered", errors)
    check(len(review_rows) >= 6, "external review queue is incomplete", errors)
    check(legacy_manifest["status"] == "legacy_unverified", "legacy manifest status invalid", errors)
    check(
        legacy_manifest["policy"]["thesis_bundle_default_include"] is False,
        "legacy manifest allows default thesis inclusion",
        errors,
    )
    check(
        legacy_manifest["policy"]["automatic_validation_promotion"] is False,
        "legacy manifest allows automatic validation promotion",
        errors,
    )
    for item in legacy_manifest["files"]:
        path = REPO / item["path"]
        check(path.is_file(), f"legacy manifest path missing: {item['path']}", errors)
        if path.is_file():
            check(sha256(path) == item["sha256"], f"legacy hash mismatch: {item['path']}", errors)
        check(
            item["storage_mode"] == "physical_quarantine",
            f"legacy item is not physically quarantined: {item['path']}",
            errors,
        )
    check(thesis_bundle["meta"]["sourceNamespace"] == "data/curated", "thesis source namespace invalid", errors)
    check(thesis_bundle["meta"]["scope"] == "validated_thesis_scope", "thesis scope invalid", errors)
    check(thesis_bundle["meta"]["claimCount"] == 0, "Phase 01 thesis claims must be zero", errors)
    check(thesis_bundle["meta"]["ruleCount"] == 0, "Phase 01 thesis rules must be zero", errors)
    check(thesis_bundle["claims"] == [], "Phase 01 thesis claim array must be empty", errors)
    check(thesis_bundle["rules"] == [], "Phase 01 thesis rule array must be empty", errors)
    for collection in (
        "sources",
        "reports",
        "studies",
        "extractions",
        "riskOfBias",
    ):
        check(thesis_bundle[collection] == [], f"Phase 01 {collection} must be empty", errors)

    default_page = (REPO / "app" / "page.tsx").read_text(encoding="utf-8")
    default_route = (REPO / "app" / "api" / "rules" / "query" / "route.ts").read_text(
        encoding="utf-8"
    )
    check(
        not (REPO / "app" / "api" / "ai-explain" / "route.ts").exists(),
        "runtime AI route remains exposed",
        errors,
    )
    check(
        not any((REPO / "src" / "lib" / "ai").glob("*.ts")),
        "runtime AI TypeScript module remains exposed",
        errors,
    )
    check("runThesisEngine" in default_route, "default API is not thesis-only", errors)
    check(
        "getStudyKnowledgeIndex" not in default_route,
        "default API still imports legacy knowledge",
        errors,
    )
    check(
        "literature-candidates.json" not in default_page
        and "RuleExplorerClient" not in default_page,
        "default page still imports legacy UI/data",
        errors,
    )
    check(
        (REPO / "app" / "api" / "legacy" / "rules" / "query" / "route.ts").is_file(),
        "explicit legacy API route is missing",
        errors,
    )

    plan_text = (REPO / REQUIRED_FILES[0]).read_text(encoding="utf-8")
    for pattern in FORBIDDEN_PLACEHOLDER_PATTERNS:
        check(pattern not in plan_text, f"plan contains forbidden placeholder pattern: {pattern}", errors)

    if deployment["baseline_status"] == "legacy_unverified_production":
        warnings.append("public production remains legacy_unverified and is not a validated release")
    warnings.append("global QA criteria for later research, validation, thesis, and release phases remain open")

    artifact_manifest = build_artifact_manifest()
    manifest_path = REPO / "research" / "audit" / "phase_01_artifact_manifest.json"
    manifest_path.write_text(
        json.dumps(artifact_manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    result = {
        "errors": errors,
        "warnings": warnings,
        "artifact_manifest_files": artifact_manifest["file_count"],
        "rule_scope_rows": len(rule_rows),
        "legacy_manifest_files": legacy_manifest["file_count"],
        "thesis_claims": thesis_bundle["meta"]["claimCount"],
        "thesis_rules": thesis_bundle["meta"]["ruleCount"],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
