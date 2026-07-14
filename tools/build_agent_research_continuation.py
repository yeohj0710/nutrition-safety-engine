#!/usr/bin/env python3
"""Build an agent-only, full-text-oriented continuation package.

This prioritizes research work without converting AI recommendations into human
screening, eligibility, RoB, GRADE, or inclusion decisions.
"""
from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREREVIEW = ROOT / "research/review_queue/pubmed_screening_agent_prereview.csv"
PICOS = ROOT / "research/systematic_review_v3/picos_extraction.csv"
CORE = ROOT / "research/systematic_review_v3/core_evidence.csv"
PMC = ROOT / "data/interim/pmc_fulltext_candidates.csv"
OUT = ROOT / "research/review_queue/agent_fulltext_research_priority.csv"
SUMMARY = ROOT / "research/synthesis/agent_research_continuation_summary.json"


def read(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    prereview, picos, core, pmc = map(read, (PREREVIEW, PICOS, CORE, PMC))
    pre = {(r["record_id"], r["question_id"]): r for r in prereview}
    core_keys = {(r["record_id"], r["question_id"]) for r in core}
    pmc_by_record = {r["record_id"]: r for r in pmc}
    rows: list[dict[str, str]] = []

    for item in picos:
        key = (item["record_id"], item["question_id"])
        screen = pre.get(key)
        if not screen or screen["agent_recommendation"] != "advance_to_human_screening":
            continue
        locator = pmc_by_record.get(item["record_id"], {})
        is_core = key in core_keys
        has_public_fulltext = bool(locator.get("pmc_article_url") or item.get("fulltext_locator"))
        has_dose = bool(item.get("dose_extracted", "").strip())
        design_clear = item.get("automated_eligibility") == "include_candidate"
        if is_core and has_public_fulltext:
            tier, reason = "tier_1_public_fulltext_core", "핵심 직접근거 후보이며 공개 원문 위치가 확인됩니다."
        elif is_core:
            tier, reason = "tier_2_core_locator_needed", "핵심 직접근거 후보이나 공개 원문 위치 확인이 필요합니다."
        elif has_public_fulltext and design_clear:
            tier, reason = "tier_3_public_fulltext_picos", "PICOS 직접성과 연구설계 신호가 있으며 공개 원문 위치가 확인됩니다."
        else:
            tier, reason = "tier_4_picos_bibliographic", "PICOS 직접성 후보이며 서지·초록 기반 추가 검토가 필요합니다."
        rows.append({
            "record_id": item["record_id"], "pmid": item["provider_id"], "question_id": item["question_id"],
            "title": item["title"], "priority_tier": tier, "priority_reason": reason,
            "core_candidate": str(is_core).lower(), "study_design_signal": item["automated_eligibility"],
            "dose_observed": str(has_dose).lower(), "dose_extracted": item.get("dose_extracted", ""),
            "public_fulltext_locator": locator.get("pmc_article_url", "") or item.get("fulltext_locator", ""),
            "evidence_locator": item.get("evidence_locator", ""),
            "duplicate_cluster_ids": screen.get("duplicate_cluster_ids", ""),
            "source_record_sha256": screen["source_record_sha256"],
            "decision_authority": "agent_research_prioritization_only", "human_eligibility_decision": "",
            "rob_completed": "false", "grade_completed": "false", "systematic_review_inclusion_claim": "false",
        })
    rows.sort(key=lambda r: (r["question_id"], r["priority_tier"], r["pmid"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)

    by_question = defaultdict(Counter)
    for row in rows:
        by_question[row["question_id"]][row["priority_tier"]] += 1
    payload = {
        "schema_version": "1.0.0",
        "status": "agent_research_continuation_complete_human_validation_open",
        "input_scope": {"pubmed_unique_records": len({r["record_id"] for r in prereview}), "picos_candidates": len(picos), "core_candidates": len(core)},
        "prioritized_candidates": len(rows),
        "priority_tiers": dict(sorted(Counter(r["priority_tier"] for r in rows).items())),
        "by_question": {q: dict(sorted(by_question[q].items())) for q in sorted(by_question)},
        "public_fulltext_candidates": sum(bool(r["public_fulltext_locator"]) for r in rows),
        "dose_observed_candidates": sum(r["dose_observed"] == "true" for r in rows),
        "core_candidates_retained": sum(r["core_candidate"] == "true" for r in rows),
        "human_title_abstract_decisions": 0, "human_fulltext_decisions": 0,
        "independent_reviewers_completed": 0, "rob_completed": 0, "grade_completed": 0,
        "prisma_final_counts_allowed": False, "clinical_conclusion_allowed": False,
        "inputs": {p.relative_to(ROOT).as_posix(): sha(p) for p in (PREREVIEW, PICOS, CORE, PMC)},
        "output": {"path": OUT.relative_to(ROOT).as_posix(), "sha256": sha(OUT)},
    }
    SUMMARY.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: payload[k] for k in ("prioritized_candidates", "priority_tiers", "by_question", "public_fulltext_candidates")}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
