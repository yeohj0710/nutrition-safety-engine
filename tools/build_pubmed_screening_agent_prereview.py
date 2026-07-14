#!/usr/bin/env python3
"""Build conservative, non-decisional PubMed title/abstract agent prereview."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECORDS = ROOT / "data/interim/records.csv"
RETRIEVALS = ROOT / "data/interim/record_retrievals.csv"
RULES_APPROVAL = ROOT / "research/approvals/screening_rules_approval.json"
SENTINELS = ROOT / "research/searches/sentinel_set.csv"
DEDUP_REVIEW = ROOT / "research/review_queue/dedup_agent_prereview.json"
DEDUP_DECISIONS = ROOT / "data/interim/deduplication_decisions.csv"
OUTPUT = ROOT / "research/review_queue/pubmed_screening_agent_prereview.csv"
SUMMARY = ROOT / "research/review_queue/pubmed_screening_agent_prereview_summary.json"

QUESTION_RULES = {
    "A1": {
        "population": ["warfarin", "vitamin k antagonist", "vka", "acenocoumarol", "phenprocoumon"],
        "exposure": ["vitamin k", "phylloquinone", "menaquinone", "mk-7", "menadione"],
        "outcome": ["inr", "international normalized ratio", "therapeutic range", "bleeding", "hemorrhage", "haemorrhage", "thrombosis", "coagulation"],
    },
    "A2": {
        "population": ["anticoagulant", "warfarin", "vka", "doac", "apixaban", "rivaroxaban", "edoxaban", "dabigatran", "aspirin"],
        "exposure": ["omega-3", "omega 3", "n-3", "fish oil", "epa", "dha", "eicosapentaenoic", "docosahexaenoic", "icosapent"],
        "outcome": ["bleeding", "hemorrhage", "haemorrhage", "adverse", "safety", "inr", "thrombosis", "coagulation"],
    },
    "B1": {
        "population": ["kidney stone", "renal stone", "urinary stone", "nephrolithiasis", "urolithiasis", "urinary calculi", "urinary tract stone", "hypercalciuria", "calcium oxalate"],
        "exposure": ["calcium supplement", "supplemental calcium", "calcium supplementation", "calcium carbonate", "calcium citrate"],
        "outcome": ["stone", "calculi", "calculus", "urinary calcium", "hypercalciuria", "hypercalcemia", "adverse"],
    },
    "B2": {
        "population": ["kidney stone", "renal stone", "urinary stone", "nephrolithiasis", "urolithiasis", "urinary calculi", "hypercalciuria", "hypercalcemia", "calcium oxalate"],
        "exposure": ["vitamin d", "cholecalciferol", "ergocalciferol", "calcifediol"],
        "outcome": ["stone", "calculi", "calculus", "urinary calcium", "hypercalciuria", "hypercalcemia", "adverse"],
    },
    "B3": {
        "population": ["kidney stone", "renal stone", "urinary stone", "nephrolithiasis", "urolithiasis", "hyperoxaluria", "oxalate"],
        "exposure": ["vitamin c", "ascorbic acid", "ascorbate"],
        "outcome": ["stone", "calculi", "calculus", "urinary oxalate", "hyperoxaluria", "renal", "kidney", "adverse"],
    },
}
ANIMAL_TERMS = ["mice", "mouse", "rat", "rats", "murine", "in vitro", "cell line", "bovine", "porcine"]
HUMAN_TERMS = ["patient", "patients", "participant", "participants", "adult", "adults", "randomized", "randomised", "cohort", "case-control", "clinical trial", "men", "women"]
NON_PRIMARY_TYPES = ["Editorial", "Letter", "Comment", "News"]


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def matched(terms: list[str], text: str) -> list[str]:
    normalized_text = normalize(text)
    padded = f" {normalized_text} "
    tokens = set(normalized_text.split())
    found = []
    for term in terms:
        normalized_term = normalize(term)
        if " " not in normalized_term:
            present = normalized_term in tokens or f"{normalized_term}s" in tokens
        else:
            present = f" {normalized_term} " in padded
        if present:
            found.append(term)
    return found


def record_sha(row: dict[str, str]) -> str:
    fields = [row.get(key, "") for key in ("record_id", "pmid", "title", "abstract", "publication_types", "raw_file", "question_ids")]
    return hashlib.sha256("\x1f".join(fields).encode("utf-8")).hexdigest()


def duplicate_clusters() -> dict[str, set[str]]:
    review = json.loads(DEDUP_REVIEW.read_text(encoding="utf-8"))
    candidates = {row["candidate_id"]: row for row in review["candidates"]}
    clusters: dict[str, set[str]] = defaultdict(set)
    with DEDUP_DECISIONS.open(encoding="utf-8-sig", newline="") as handle:
        for decision in csv.DictReader(handle):
            cluster_id = decision["duplicate_cluster_id"].strip()
            if decision["decision"] != "duplicate" or not cluster_id:
                continue
            candidate = candidates[decision["candidate_id"]]
            clusters[candidate["record_id_a"]].add(cluster_id)
            clusters[candidate["record_id_b"]].add(cluster_id)
    return clusters


def classify(record: dict[str, str], question_id: str, is_sentinel: bool) -> dict[str, str]:
    abstract = record["abstract"].strip()
    text = f"{record['title']} {abstract}"
    rules = QUESTION_RULES[question_id]
    exposure = matched(rules["exposure"], text)
    outcome = matched(rules["outcome"], text)
    population = matched(rules["population"], text)
    animal = matched(ANIMAL_TERMS, text)
    human = matched(HUMAN_TERMS, text) or "Humans" in record["publication_types"].split("|")
    non_primary = [kind for kind in NON_PRIMARY_TYPES if kind in record["publication_types"].split("|")]
    flags: list[str] = []
    if not abstract:
        flags.append("abstract_missing")
    if animal and not human:
        flags.append("possible_animal_only")
    if non_primary:
        flags.append("non_primary_publication_type")
    if is_sentinel:
        flags.append("sentinel_record")

    if not abstract:
        recommendation = "uncertain_manual_review"
        reason = "초록이 없어 제목만으로 제외할 수 없습니다. 원문 또는 추가 서지정보를 사람이 확인해야 합니다."
    elif exposure and outcome and (population or question_id.startswith("B")):
        recommendation = "advance_to_human_screening"
        reason = "질문별 노출과 안전성 결과 신호가 함께 확인되어 사람 선별 대상으로 우선 진행합니다."
    elif is_sentinel:
        recommendation = "uncertain_manual_review"
        reason = "사전 지정 sentinel입니다. 자동 제외하지 않고 사람이 직접 확인해야 합니다."
    elif animal and not human:
        recommendation = "likely_exclude_needs_validation"
        reason = "비인간 연구 신호만 확인되지만 사람 검토 전에는 제외로 확정하지 않습니다."
    elif not exposure and not outcome:
        recommendation = "likely_exclude_needs_validation"
        reason = "질문별 노출과 안전성 결과 신호가 모두 없지만 사람 검토 전에는 제외로 확정하지 않습니다."
    else:
        recommendation = "uncertain_manual_review"
        reason = "노출·대상·결과 중 일부만 확인되어 사람이 포함 가능성을 판단해야 합니다."
    return {
        "agent_recommendation": recommendation,
        "recommendation_reason": reason,
        "matched_population_terms": "|".join(population),
        "matched_exposure_terms": "|".join(exposure),
        "matched_outcome_terms": "|".join(outcome),
        "uncertainty_flags": "|".join(flags),
    }


def file_sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    approval = json.loads(RULES_APPROVAL.read_text(encoding="utf-8"))
    if approval.get("decision") != "approve_question_specific_triage_rules":
        raise RuntimeError("approved question-specific screening rules required")
    with RECORDS.open(encoding="utf-8-sig", newline="") as handle:
        records = {row["record_id"]: row for row in csv.DictReader(handle)}
    with RETRIEVALS.open(encoding="utf-8-sig", newline="") as handle:
        retrievals = list(csv.DictReader(handle))
    with SENTINELS.open(encoding="utf-8-sig", newline="") as handle:
        sentinels = {(row["question_id"], row["pmid"]) for row in csv.DictReader(handle)}
    clusters = duplicate_clusters()

    rows = []
    for retrieval in retrievals:
        record = records[retrieval["record_id"]]
        question_id = retrieval["question_id"]
        result = classify(record, question_id, (question_id, record["pmid"]) in sentinels)
        rows.append({
            "record_id": record["record_id"], "pmid": record["pmid"], "question_id": question_id,
            "title": record["title"], "abstract_available": str(bool(record["abstract"].strip())).lower(),
            **result, "publication_types": record["publication_types"],
            "duplicate_cluster_ids": "|".join(sorted(clusters.get(record["record_id"], set()))),
            "source_record_sha256": record_sha(record), "source_raw_file": record["raw_file"],
            "decision_authority": "agent_prereview_only", "human_decision": "",
        })
    rows.sort(key=lambda row: (row["question_id"], int(row["pmid"])))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)

    by_question = {}
    for question_id in QUESTION_RULES:
        question_rows = [row for row in rows if row["question_id"] == question_id]
        by_question[question_id] = {
            "record_question_units": len(question_rows),
            "unique_records": len({row["record_id"] for row in question_rows}),
            "abstract_available": sum(row["abstract_available"] == "true" for row in question_rows),
            "abstract_missing": sum(row["abstract_available"] == "false" for row in question_rows),
            "recommendations": dict(Counter(row["agent_recommendation"] for row in question_rows)),
        }
    summary = {
        "schema_version": "1.0.0", "status": "agent_prereview_complete_human_decisions_open",
        "authority": "agent_prereview_only", "reviewer_identity": "identity_not_captured",
        "unique_records": len(records), "record_question_units": len(rows),
        "human_screening_decisions": 0, "independent_reviewers_completed": 0,
        "prisma_final_counts_allowed": False, "questions": by_question,
        "inputs": {"records_sha256": file_sha(RECORDS), "retrievals_sha256": file_sha(RETRIEVALS), "rules_approval_sha256": file_sha(RULES_APPROVAL)},
        "output_sha256": file_sha(OUTPUT),
    }
    SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT.relative_to(ROOT)), **{k: summary[k] for k in ("unique_records", "record_question_units")}, "questions": by_question}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
