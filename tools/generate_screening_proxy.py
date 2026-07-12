#!/usr/bin/env python3
"""Create deterministic, non-decisional screening priority proxies and human queues."""

from __future__ import annotations

import csv
import hashlib
import json
import random
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


REPO = Path(__file__).resolve().parents[1]
SEED = 20260710
QUESTIONS = ("A1", "A2", "B1", "B2", "B3")
TERMS = {
    "A1": {
        "population": [r"\bwarfarin\b", r"vitamin k antagonist", r"\bvkas?\b", r"acenocoumarol", r"phenprocoumon"],
        "exposure": [r"vitamin k", r"phylloquinone", r"menaquinone", r"\bmk-?7\b"],
        "outcome": [r"\binr\b", r"international normali[sz]ed ratio", r"therapeutic range", r"bleed", r"hemorrhag", r"haemorrhag", r"thrombo"],
    },
    "A2": {
        "population": [r"anticoag", r"\bwarfarin\b", r"\bvkas?\b", r"\bdoacs?\b", r"apixaban", r"rivaroxaban", r"edoxaban", r"dabigatran"],
        "exposure": [r"omega-?3", r"\bn-3\b", r"fish oil", r"\bepa\b", r"\bdha\b", r"eicosapentaenoic", r"docosahexaenoic", r"icosapent"],
        "outcome": [r"bleed", r"hemorrhag", r"haemorrhag", r"adverse", r"safety", r"\binr\b", r"thrombo"],
    },
    "B1": {
        "population": [r"kidney stone", r"renal stone", r"urinary.*stone", r"nephrolith", r"urolith", r"hypercalciuria", r"calcium oxalate"],
        "exposure": [r"calcium supplement", r"supplemental calcium", r"calcium supplementation", r"calcium carbonate", r"calcium citrate"],
        "outcome": [r"stone", r"calcul", r"urinary calcium", r"hypercalciuria", r"hypercalcemia", r"adverse"],
    },
    "B2": {
        "population": [r"kidney stone", r"renal stone", r"urinary.*stone", r"nephrolith", r"urolith", r"hypercalciuria", r"hypercalcemia", r"calcium oxalate"],
        "exposure": [r"vitamin d", r"cholecalciferol", r"ergocalciferol", r"calcifediol"],
        "outcome": [r"stone", r"calcul", r"urinary calcium", r"hypercalciuria", r"hypercalcemia", r"adverse"],
    },
    "B3": {
        "population": [r"kidney stone", r"renal stone", r"urinary.*stone", r"nephrolith", r"urolith", r"hyperoxaluria", r"oxalate"],
        "exposure": [r"vitamin c", r"ascorbic acid", r"ascorbate"],
        "outcome": [r"stone", r"calcul", r"urinary oxalate", r"hyperoxaluria", r"renal", r"kidney", r"adverse"],
    },
}
ANIMAL_ONLY = [r"\bmice\b", r"\bmouse\b", r"\brats?\b", r"murine", r"in vitro", r"cell line", r"bovine", r"porcine"]
HUMAN_SIGNALS = [r"\bpatients?\b", r"\bparticipants?\b", r"\badults?\b", r"randomi[sz]", r"cohort", r"case-control", r"clinical trial", r"\bmen\b", r"\bwomen\b"]


def matches(patterns: list[str], text: str) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def stable_tie(record_id: str, question_id: str) -> str:
    return hashlib.sha256(f"{SEED}|{question_id}|{record_id}".encode()).hexdigest()


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_or_preserve(path: Path, rows: list[dict[str, Any]], fields: list[str], key: str,
                      human_fields: tuple[str, ...], static_fields: tuple[str, ...]) -> str:
    if path.is_file():
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle); existing, old_fields = list(reader), reader.fieldnames or []
        populated = any(any(row.get(field, "").strip() for field in human_fields) for row in existing)
        if populated and old_fields != fields:
            raise ValueError(f"human queue header mismatch; refusing overwrite: {path}")
        if populated:
            old = {row[key]: row for row in existing}; new = {str(row[key]): row for row in rows}
            if set(old) != set(new) or any(any(old[item][field] != str(new[item][field]) for field in static_fields) for item in old):
                raise ValueError(f"human queue lineage changed; refusing overwrite: {path}")
            return "preserved_existing_human_data"
    write_csv(path, rows, fields)
    return "generated_no_human_data"


def classify(question: str, record: dict[str, str], profile: str) -> dict[str, Any]:
    text = f"{record['title']}\n{record['abstract']}"
    signals = {
        concept: matches(TERMS[question][concept], text)
        for concept in ("population", "exposure", "outcome")
    }
    animal = matches(ANIMAL_ONLY, text)
    human = matches(HUMAN_SIGNALS, text) or "Humans" in record["publication_types"].split("|")
    score = sum(signals.values()) + int(human) - int(animal and not human)
    if profile == "sensitivity_first":
        high = signals["population"] and signals["exposure"]
        medium = signals["population"] or signals["exposure"]
    else:
        high = all(signals.values()) and not (animal and not human)
        medium = sum(signals.values()) >= 2 or (signals["exposure"] and human)
    band = "high" if high else "medium" if medium else "low"
    recommendation = (
        "include_candidate" if band == "high" else "uncertain" if band == "medium" else "low_priority_review"
    )
    reasons = [name for name, present in signals.items() if present]
    if human:
        reasons.append("human_signal")
    if animal:
        reasons.append("animal_term_present")
    return {
        "priority_band": band,
        "recommendation": recommendation,
        "priority_score": score,
        "reason_codes": "|".join(reasons) or "no_structured_signal",
        "population_match": signals["population"],
        "exposure_match": signals["exposure"],
        "outcome_match": signals["outcome"],
        "human_signal": human,
        "animal_term_present": animal,
    }


def main() -> int:
    records_path = REPO / "data/interim/records.csv"
    retrievals_path = REPO / "data/interim/record_retrievals.csv"
    with records_path.open("r", encoding="utf-8-sig", newline="") as handle:
        records = {row["record_id"]: row for row in csv.DictReader(handle)}
    with retrievals_path.open("r", encoding="utf-8-sig", newline="") as handle:
        retrievals = list(csv.DictReader(handle))

    profiles = ("sensitivity_first", "structured_conservative")
    proxy_rows: dict[str, list[dict[str, Any]]] = {profile: [] for profile in profiles}
    combined: dict[tuple[str, str], dict[str, dict[str, Any]]] = defaultdict(dict)
    for retrieval in retrievals:
        record = records[retrieval["record_id"]]
        key = (record["record_id"], retrieval["question_id"])
        for profile in profiles:
            result = classify(retrieval["question_id"], record, profile)
            row = {
                "record_id": record["record_id"],
                "question_id": retrieval["question_id"],
                "proxy_profile": profile,
                **result,
                "decision_authority": "none",
                "status": "synthetic_priority_only",
            }
            proxy_rows[profile].append(row)
            combined[key][profile] = result

    fields = [
        "record_id",
        "question_id",
        "proxy_profile",
        "priority_band",
        "recommendation",
        "priority_score",
        "reason_codes",
        "population_match",
        "exposure_match",
        "outcome_match",
        "human_signal",
        "animal_term_present",
        "decision_authority",
        "status",
    ]
    interim = REPO / "data/interim"
    for profile in profiles:
        write_csv(interim / f"screening_proxy_{profile}.csv", proxy_rows[profile], fields)

    rank = {"high": 0, "medium": 1, "low": 2}
    queue = []
    decisions = []
    for (record_id, question), results in combined.items():
        record = records[record_id]
        a = results["sensitivity_first"]
        b = results["structured_conservative"]
        best_band = min((a["priority_band"], b["priority_band"]), key=rank.get)
        disagreement = a["recommendation"] != b["recommendation"]
        queue.append(
            {
                "queue_id": f"SCR-{question}-{record['pmid']}",
                "record_id": record_id,
                "question_id": question,
                "title": record["title"],
                "year": record["year"],
                "proxy_priority_band": best_band,
                "proxy_disagreement": disagreement,
                "requires_human_review": True,
                "human_review_status": "not_started",
                "tie_break_hash": stable_tie(record_id, question),
            }
        )
        decisions.append(
            {
                "record_id": record_id,
                "report_id": "",
                "question_ids": question,
                "screening_stage": "title_abstract",
                "reviewer_id": "",
                "decision": "",
                "primary_reason_code": "",
                "secondary_reason_notes": "",
                "evidence_layer_candidate": "",
                "ai_priority_score": "",
                "ai_recommendation": "",
                "ai_run_id": "",
                "reviewed_at": "",
                "adjudication_status": "not_started",
                "final_decision": "",
                "final_reason_code": "",
                "adjudicator_id": "",
                "notes": "awaiting independent human primary screening",
            }
        )
    queue.sort(key=lambda row: (rank[row["proxy_priority_band"]], row["tie_break_hash"]))
    write_csv(interim / "screening_review_queue.csv", queue, list(queue[0].keys()))
    decision_fields = list(decisions[0].keys())
    decision_write_status = write_or_preserve(
        interim / "screening_decisions.csv", decisions, decision_fields, "record_id",
        ("reviewer_id", "decision", "primary_reason_code", "secondary_reason_notes", "evidence_layer_candidate",
         "reviewed_at", "adjudication_status", "final_decision", "final_reason_code", "adjudicator_id", "notes"),
        ("record_id", "question_ids", "screening_stage"),
    )

    rng = random.Random(SEED)
    by_question: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in queue:
        by_question[row["question_id"]].append(row)
    pilot = []
    for question in QUESTIONS:
        candidates = by_question[question][:]
        rng.shuffle(candidates)
        for row in candidates[:10]:
            pilot.append(
                {
                    "pilot_id": f"PILOT-{question}-{row['record_id'].removeprefix('REC-PUBMED-')}",
                    "record_id": row["record_id"],
                    "question_id": question,
                    "reviewer_1_id": "", "reviewer_1_decision": "", "reviewer_1_reason": "", "reviewer_1_at": "",
                    "reviewer_2_id": "", "reviewer_2_decision": "", "reviewer_2_reason": "", "reviewer_2_at": "",
                    "adjudicator_id": "", "final_decision": "", "final_reason": "", "adjudicated_at": "",
                    "status": "pending_human_training",
                }
            )
    pilot_fields = list(pilot[0].keys())
    pilot_write_status = write_or_preserve(
        interim / "screening_pilot_queue.csv", pilot, pilot_fields, "pilot_id",
        ("reviewer_1_id", "reviewer_1_decision", "reviewer_1_reason", "reviewer_1_at", "reviewer_2_id",
         "reviewer_2_decision", "reviewer_2_reason", "reviewer_2_at", "adjudicator_id", "final_decision",
         "final_reason", "adjudicated_at"), ("pilot_id", "record_id", "question_id"),
    )

    empty_full_text_fields = [
        "report_id",
        "record_id",
        "question_ids",
        "full_text_status",
        "retrieval_attempts",
        "reviewer_id",
        "decision",
        "primary_reason_code",
        "reviewed_at",
        "status",
    ]
    write_csv(interim / "full_text_log.csv", [], empty_full_text_fields)
    write_csv(
        interim / "excluded_full_text.csv",
        [],
        ["report_id", "question_ids", "primary_reason_code", "reason_detail", "reviewer_agreement", "status"],
    )

    counts = {
        profile: dict(Counter(row["priority_band"] for row in rows))
        for profile, rows in proxy_rows.items()
    }
    question_counts = {
        profile: {
            question: dict(
                Counter(
                    row["priority_band"]
                    for row in rows
                    if row["question_id"] == question
                )
            )
            for question in QUESTIONS
        }
        for profile, rows in proxy_rows.items()
    }
    disagreements = sum(row["proxy_disagreement"] for row in queue)
    disagreements_by_question = {
        question: sum(
            row["proxy_disagreement"] for row in queue if row["question_id"] == question
        )
        for question in QUESTIONS
    }
    run_metadata = {
        "schema_version": "1.0.0",
        "status": "synthetic_proxy_no_decision_authority",
        "seed": SEED,
        "input_records_sha256": sha256(records_path),
        "input_retrievals_sha256": sha256(retrievals_path),
        "script_sha256": sha256(Path(__file__)),
        "record_question_units": len(queue),
        "all_units_require_human_review": True,
        "proxy_counts": counts,
        "proxy_counts_by_question": question_counts,
        "proxy_disagreements": disagreements,
        "proxy_disagreements_by_question": disagreements_by_question,
        "human_decisions": 0,
        "final_decisions": 0,
        "ai_only_exclusions": 0,
        "limitation": "Heuristic proxies test queue plumbing only; they are not AI performance or eligibility decisions.",
        "screening_decision_write_status": decision_write_status,
        "training_pilot_write_status": pilot_write_status,
    }
    for profile in profiles:
        run_metadata[f"{profile}_output_sha256"] = sha256(
            interim / f"screening_proxy_{profile}.csv"
        )
    (REPO / "research/screening").mkdir(parents=True, exist_ok=True)
    (REPO / "research/screening/proxy_run_metadata.json").write_text(
        json.dumps(run_metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    registry_queue_path = interim / "clinicaltrials_review_queue.csv"
    koreamed_queue_path = interim / "koreamed_review_queue.csv"
    registry_units = 0
    if registry_queue_path.exists():
        with registry_queue_path.open("r", encoding="utf-8-sig", newline="") as handle:
            registry_units = sum(1 for _ in csv.DictReader(handle))
    koreamed_units = 0
    if koreamed_queue_path.exists():
        with koreamed_queue_path.open("r", encoding="utf-8-sig", newline="") as handle:
            koreamed_units = sum(1 for _ in csv.DictReader(handle))
    (REPO / "research/screening/prisma_status.json").write_text(
        json.dumps(
            {
                "status": "unavailable_pending_human_screening",
                "pubmed_record_question_units": len(queue),
                "clinicaltrials_record_question_units": registry_units,
                "koreamed_record_question_units": koreamed_units,
                "identified_record_question_units_total": len(queue) + registry_units + koreamed_units,
                "counting_note": "Database-question retrieval units; not deduplicated studies or PRISMA final records.",
                "human_screened": 0,
                "full_text_assessed": 0,
                "included_reports": None,
                "included_studies": None,
                "final_prisma_allowed": False,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps(run_metadata, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
