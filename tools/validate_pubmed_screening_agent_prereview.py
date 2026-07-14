#!/usr/bin/env python3
"""Validate PubMed agent prereview lineage, safeguards, and review samples."""

from __future__ import annotations

import csv
import hashlib
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREREVIEW = ROOT / "research/review_queue/pubmed_screening_agent_prereview.csv"
SUMMARY = ROOT / "research/review_queue/pubmed_screening_agent_prereview_summary.json"
REPORT = ROOT / "research/screening/pubmed_screening_agent_prereview_validation.json"
ALLOWED = {"advance_to_human_screening", "likely_exclude_needs_validation", "uncertain_manual_review"}
EXPECTED = {"A1": 12234, "A2": 820, "B1": 1355, "B2": 4882, "B3": 680}


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sample(rows: list[dict[str, str]], seed: int, count: int) -> list[dict[str, str]]:
    rng = random.Random(seed)
    chosen = rng.sample(rows, min(count, len(rows)))
    return [{"record_id": row["record_id"], "pmid": row["pmid"], "question_id": row["question_id"], "agent_recommendation": row["agent_recommendation"], "uncertainty_flags": row["uncertainty_flags"]} for row in chosen]


def main() -> int:
    errors: list[str] = []
    rows = read_csv(PREREVIEW)
    records = read_csv(ROOT / "data/interim/records.csv")
    retrievals = read_csv(ROOT / "data/interim/record_retrievals.csv")
    sentinels = read_csv(ROOT / "research/searches/sentinel_set.csv")
    summary = json.loads(SUMMARY.read_text(encoding="utf-8"))

    keys = [(row["record_id"], row["question_id"]) for row in rows]
    source_keys = [(row["record_id"], row["question_id"]) for row in retrievals]
    if len(rows) != 19971 or len(set(keys)) != 19971:
        errors.append("prereview must contain 19,971 unique record-question units")
    if set(keys) != set(source_keys):
        errors.append("prereview keys do not match retrieval lineage")
    if len(records) != 19619 or len({row["record_id"] for row in rows}) != 19619:
        errors.append("prereview must cover 19,619 unique records")
    counts = Counter(row["question_id"] for row in rows)
    if dict(counts) != EXPECTED:
        errors.append(f"question counts differ: {dict(counts)}")

    required = {"record_id", "pmid", "question_id", "title", "abstract_available", "agent_recommendation", "recommendation_reason", "matched_exposure_terms", "matched_outcome_terms", "uncertainty_flags", "source_record_sha256"}
    if rows and not required.issubset(rows[0]):
        errors.append("required fields missing")
    if any(row["agent_recommendation"] not in ALLOWED for row in rows):
        errors.append("unknown recommendation present")
    if any(row["decision_authority"] != "agent_prereview_only" or row["human_decision"] for row in rows):
        errors.append("agent prereview crossed human decision boundary")
    missing_abstract = [row for row in rows if row["abstract_available"] == "false"]
    if any(row["agent_recommendation"] != "uncertain_manual_review" for row in missing_abstract):
        errors.append("record without abstract was not routed to manual review")
    if any("abstract_missing" not in row["uncertainty_flags"].split("|") for row in missing_abstract):
        errors.append("missing abstract flag absent")

    row_map = {(row["question_id"], row["pmid"]): row for row in rows}
    sentinel_rows = []
    for sentinel in sentinels:
        row = row_map.get((sentinel["question_id"], sentinel["pmid"]))
        if not row:
            errors.append(f"sentinel missing: {sentinel['question_id']}:{sentinel['pmid']}")
            continue
        sentinel_rows.append(row)
        if row["agent_recommendation"] == "likely_exclude_needs_validation":
            errors.append(f"sentinel routed to likely exclude: {sentinel['question_id']}:{sentinel['pmid']}")

    if summary.get("output_sha256") != sha(PREREVIEW):
        errors.append("summary output hash mismatch")
    if summary.get("human_screening_decisions") != 0 or summary.get("independent_reviewers_completed") != 0 or summary.get("prisma_final_counts_allowed") is not False:
        errors.append("summary overstates human review or PRISMA readiness")

    strata: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        strata[f"{row['question_id']}:{row['agent_recommendation']}"] .append(row)
    random_samples = {name: sample(group, 20260714 + index, 5) for index, (name, group) in enumerate(sorted(strata.items()))}
    boundary = {
        "missing_abstract": sample(missing_abstract, 20260714, 20),
        "possible_animal_only": sample([row for row in rows if "possible_animal_only" in row["uncertainty_flags"]], 20260715, 20),
        "non_primary_publication_type": sample([row for row in rows if "non_primary_publication_type" in row["uncertainty_flags"]], 20260716, 20),
    }
    report = {
        "schema_version": "1.0.0", "status": "pass" if not errors else "fail",
        "unique_records_verified": len({row["record_id"] for row in rows}), "record_question_units_verified": len(rows),
        "question_counts": dict(counts), "recommendation_counts": dict(Counter(row["agent_recommendation"] for row in rows)),
        "missing_abstract_manual_review_verified": len(missing_abstract),
        "sentinels_verified": [{"question_id": row["question_id"], "pmid": row["pmid"], "recommendation": row["agent_recommendation"]} for row in sentinel_rows],
        "random_stratified_samples": random_samples, "boundary_case_samples": boundary,
        "human_screening_claim_allowed": False, "prisma_final_counts_allowed": False, "errors": errors,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("status", "unique_records_verified", "record_question_units_verified", "question_counts", "recommendation_counts", "missing_abstract_manual_review_verified", "errors")}, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
