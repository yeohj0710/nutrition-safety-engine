#!/usr/bin/env python3
"""Validate Phase 04 queue plumbing and prove no proxy became a decision."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
INTERIM = REPO / "data" / "interim"


def rows(name: str) -> list[dict[str, str]]:
    with (INTERIM / name).open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    errors: list[str] = []
    required = [
        INTERIM / "screening_proxy_sensitivity_first.csv",
        INTERIM / "screening_proxy_structured_conservative.csv",
        INTERIM / "screening_review_queue.csv",
        INTERIM / "screening_decisions.csv",
        INTERIM / "screening_pilot_queue.csv",
        INTERIM / "clinicaltrials_review_queue.csv",
        INTERIM / "koreamed_review_queue.csv",
        INTERIM / "full_text_log.csv",
        INTERIM / "excluded_full_text.csv",
        REPO / "research/screening/proxy_run_metadata.json",
        REPO / "research/screening/prisma_status.json",
        REPO / "research/screening/proxy_dry_run_report.md",
        REPO / "research/screening/phase_04_exit_criteria.md",
        REPO / "research/fulltext/pmc_sentinel_fulltext_designpilot_20260710/manifest.json",
        REPO / "research/fulltext/pmc_sentinel_fulltext_designpilot_20260710/articles.csv",
        REPO / "research/fulltext/pmc_sentinel_fulltext_designpilot_20260710/section_locators.csv",
    ]
    for path in required:
        if not path.is_file():
            errors.append(f"missing: {path.relative_to(REPO)}")
    if errors:
        print(json.dumps({"errors": errors}, ensure_ascii=False, indent=2))
        return 1

    proxy_a = rows("screening_proxy_sensitivity_first.csv")
    proxy_b = rows("screening_proxy_structured_conservative.csv")
    queue = rows("screening_review_queue.csv")
    decisions = rows("screening_decisions.csv")
    pilot = rows("screening_pilot_queue.csv")
    registry_queue = rows("clinicaltrials_review_queue.csv")
    koreamed_queue = rows("koreamed_review_queue.csv")
    full_text = rows("full_text_log.csv")
    excluded_full_text = rows("excluded_full_text.csv")
    metadata = json.loads(
        (REPO / "research/screening/proxy_run_metadata.json").read_text(encoding="utf-8-sig")
    )
    prisma = json.loads(
        (REPO / "research/screening/prisma_status.json").read_text(encoding="utf-8-sig")
    )
    pmc_manifest = json.loads(required[-3].read_text(encoding="utf-8-sig"))
    with required[-2].open(encoding="utf-8-sig", newline="") as handle:
        pmc_articles = list(csv.DictReader(handle))
    with required[-1].open(encoding="utf-8-sig", newline="") as handle:
        pmc_locators = list(csv.DictReader(handle))

    expected = 19961
    if not all(len(value) == expected for value in (proxy_a, proxy_b, queue, decisions)):
        errors.append("proxy/queue/decision row count mismatch")
    if len(pilot) != 50:
        errors.append("human training pilot queue must contain 50 rows")
    if len(registry_queue) != 207:
        errors.append("ClinicalTrials.gov human review queue must contain 207 rows")
    if len(koreamed_queue) != 62:
        errors.append("KoreaMed human review queue must contain 62 rows")
    allowed_recommendations = {"include_candidate", "uncertain", "low_priority_review"}
    for label, proxy in (("A", proxy_a), ("B", proxy_b)):
        if any(row["recommendation"] not in allowed_recommendations for row in proxy):
            errors.append(f"proxy {label} contains decision-like recommendation")
        if any(row["decision_authority"] != "none" for row in proxy):
            errors.append(f"proxy {label} claims decision authority")
    if any(row["requires_human_review"].lower() != "true" for row in queue):
        errors.append("one or more records escaped human review queue")
    decision_fields = ("reviewer_id", "decision", "final_decision", "adjudicator_id")
    if any(any(row[field] for field in decision_fields) for row in decisions):
        errors.append("screening decisions contain unverified human/final values")
    registry_decision_fields = (
        "reviewer_1_id", "reviewer_1_decision", "reviewer_2_id",
        "reviewer_2_decision", "adjudicator_id", "final_decision",
    )
    if any(any(row[field] for field in registry_decision_fields) for row in registry_queue):
        errors.append("registry queue contains unverified human/final values")
    if sum(bool(row["known_query_risk"]) for row in registry_queue) != 139:
        errors.append("registry A1 lexical-risk flags must cover 139 rows")
    koreamed_decision_fields = (
        "reviewer_1_id", "reviewer_1_decision", "reviewer_2_id",
        "reviewer_2_decision", "adjudicator_id", "final_decision",
    )
    if any(any(row[field] for field in koreamed_decision_fields) for row in koreamed_queue):
        errors.append("KoreaMed queue contains unverified human/final values")
    if full_text or excluded_full_text:
        errors.append("full-text outputs are populated without human review")
    if metadata.get("ai_only_exclusions") != 0 or metadata.get("human_decisions") != 0:
        errors.append("metadata overstates screening decisions")
    if metadata.get("status") != "synthetic_proxy_no_decision_authority":
        errors.append("proxy metadata status is incorrect")
    if metadata.get("sensitivity_first_output_sha256") != sha256(required[0]):
        errors.append("proxy A hash mismatch")
    if metadata.get("structured_conservative_output_sha256") != sha256(required[1]):
        errors.append("proxy B hash mismatch")
    if prisma.get("final_prisma_allowed") is not False or prisma.get("human_screened") != 0:
        errors.append("PRISMA status is overstated")
    if prisma.get("pubmed_record_question_units") != 19961:
        errors.append("PRISMA PubMed proxy-unit count mismatch")
    if prisma.get("clinicaltrials_record_question_units") != 207:
        errors.append("PRISMA registry proxy-unit count mismatch")
    if prisma.get("koreamed_record_question_units") != 62:
        errors.append("PRISMA KoreaMed proxy-unit count mismatch")
    if prisma.get("identified_record_question_units_total") != 20230:
        errors.append("PRISMA total retrieval-unit count mismatch")
    if pmc_manifest.get("open_access_fulltext_xml") != 1 or pmc_manifest.get("metadata_only_non_open_access") != 2:
        errors.append("PMC sentinel access classification mismatch")
    if len(pmc_articles) != 3 or any(row["human_fulltext_verified"] or row["human_eligibility_decision"] for row in pmc_articles):
        errors.append("PMC sentinel pilot article boundary mismatch")
    if len(pmc_locators) != 10 or any(row["human_locator_verified"] for row in pmc_locators):
        errors.append("PMC sentinel locator boundary mismatch")

    print(
        json.dumps(
            {
                "errors": errors,
                "phase_status": "blocked_external",
                "proxy_queue_status": "complete_verified" if not errors else "failed_quality_gate",
                "record_question_units": len(queue),
                "registry_record_question_units": len(registry_queue),
                "koreamed_record_question_units": len(koreamed_queue),
                "proxy_disagreements": metadata.get("proxy_disagreements"),
                "human_decisions": metadata.get("human_decisions"),
                "ai_only_exclusions": metadata.get("ai_only_exclusions"),
                "pmc_sentinel_articles_retrieved": len(pmc_articles),
                "pmc_open_access_fulltext_xml": pmc_manifest.get("open_access_fulltext_xml"),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
