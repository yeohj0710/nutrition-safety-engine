#!/usr/bin/env python3
"""Validate non-decisional report-to-study linkage prereview."""

from __future__ import annotations

import csv
import hashlib
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "research/review_queue/report_study_linkage_agent_prereview.csv"
SUMMARY = ROOT / "research/review_queue/report_study_linkage_agent_prereview_summary.json"
REPORT = ROOT / "research/screening/report_study_linkage_agent_prereview_validation.json"


def rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    errors: list[str] = []
    linkage = rows(OUTPUT)
    screening = rows(ROOT / "research/review_queue/pubmed_screening_agent_prereview.csv")
    reports = {row["record_id"]: row for row in rows(ROOT / "data/interim/report_candidates.csv")}
    expected_ids = {row["record_id"] for row in screening if row["agent_recommendation"] == "advance_to_human_screening"}
    observed_ids = {row["record_id"] for row in linkage}
    if observed_ids != expected_ids or len(linkage) != 10385:
        errors.append("linkage prereview does not exactly cover 10,385 advanced unique reports")
    if len(linkage) != len(observed_ids):
        errors.append("duplicate record row in linkage prereview")
    if any(row["report_id"] != reports[row["record_id"]]["report_id"] for row in linkage):
        errors.append("report lineage mismatch")
    if any(row["decision_authority"] != "agent_prereview_only" for row in linkage):
        errors.append("linkage prereview contains non-agent authority")
    human_fields = ("human_link_decision", "human_study_id", "verified_by", "verified_at")
    if any(any(row[field].strip() for field in human_fields) for row in linkage):
        errors.append("human linkage field populated by agent")

    components: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in linkage:
        components[row["agent_provisional_study_id"]].append(row)
    for provisional_id, members in components.items():
        size = len(members)
        if any(int(row["component_report_count"]) != size for row in members):
            errors.append(f"component size mismatch: {provisional_id}")
        recommendations = {row["agent_recommendation"] for row in members}
        expected = "provisional_single_report_study_needs_validation" if size == 1 else "provisional_multi_report_study_needs_validation"
        if recommendations != {expected}:
            errors.append(f"component recommendation mismatch: {provisional_id}")
        if size > 1 and not any(row["trial_registration_ids"] or row["duplicate_cluster_ids"] for row in members):
            errors.append(f"multi-report component lacks explicit evidence: {provisional_id}")

    summary = json.loads(SUMMARY.read_text(encoding="utf-8"))
    if summary["output_sha256"] != sha(OUTPUT):
        errors.append("summary output hash mismatch")
    if summary["human_link_decisions"] != 0 or summary["independent_reviewers_completed"] != 0 or summary["synthesis_allowed"] is not False:
        errors.append("summary overstates linkage or synthesis readiness")
    if summary["screening_basis"] != "advance_to_human_screening_not_human_inclusion":
        errors.append("screening basis does not preserve eligibility boundary")

    rng = random.Random(20260714)
    multi = [row for row in linkage if int(row["component_report_count"]) > 1]
    singleton = [row for row in linkage if int(row["component_report_count"]) == 1]
    sample = lambda population, count: [{key: row[key] for key in ("record_id", "pmid", "question_ids", "agent_provisional_study_id", "linkage_evidence")} for row in rng.sample(population, min(count, len(population)))]
    result = {
        "schema_version": "1.0.0", "status": "pass" if not errors else "fail",
        "unique_reports_verified": len(linkage), "provisional_components_verified": len(components),
        "multi_report_components_verified": sum(len(group) > 1 for group in components.values()),
        "reports_in_multi_report_components": len(multi),
        "component_sizes": dict(Counter(len(group) for group in components.values())),
        "samples": {"multi_report": sample(multi, 25), "singleton": sample(singleton, 25)},
        "human_link_claim_allowed": False, "synthesis_allowed": False, "errors": errors,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("status", "unique_reports_verified", "provisional_components_verified", "multi_report_components_verified", "reports_in_multi_report_components", "errors")}, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
