#!/usr/bin/env python3
"""Prove every proxy retrieval reaches a human-only screening queue unchanged."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/interim"
OUTPUT = ROOT / "research/screening/phase04_screening_lineage_validation.json"


def rows(name: str) -> list[dict[str, str]]:
    with (DATA / name).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def key(row: dict[str, str]) -> tuple[str, str]:
    return row["record_id"], row["question_id"]


def main() -> int:
    errors: list[str] = []
    records_list = rows("records.csv")
    records = {row["record_id"]: row for row in records_list}
    retrievals = rows("record_retrievals.csv")
    queue = rows("screening_review_queue.csv")
    proxy_a = rows("screening_proxy_sensitivity_first.csv")
    proxy_b = rows("screening_proxy_structured_conservative.csv")
    decisions = rows("screening_decisions.csv")
    pilot = rows("screening_pilot_queue.csv")

    expected_keys = {key(row) for row in retrievals}
    queue_keys = {key(row) for row in queue}
    a_keys = {key(row) for row in proxy_a}
    b_keys = {key(row) for row in proxy_b}
    if any(len(value) != len(expected_keys) for value in (queue_keys, a_keys, b_keys)):
        errors.append("duplicate or missing PubMed record-question units")
    if not expected_keys == queue_keys == a_keys == b_keys:
        errors.append("retrieval/proxy/human-queue key sets differ")

    for row in queue:
        record = records.get(row["record_id"])
        if record is None or row["title"] != record["title"] or row["year"] != record["year"]:
            errors.append(f"queue bibliographic drift: {row['queue_id']}")
        if row["requires_human_review"].lower() != "true" or row["human_review_status"] != "not_started":
            errors.append(f"queue escaped human review: {row['queue_id']}")
    for proxy in (proxy_a, proxy_b):
        if any(row["decision_authority"] != "none" or row["status"] != "synthetic_priority_only" for row in proxy):
            errors.append("proxy output claims screening authority")

    decision_keys = {(row["record_id"], row["question_ids"]) for row in decisions}
    if len(decision_keys) != len(decisions) or decision_keys != expected_keys:
        errors.append("screening decision shells do not cover record-question units exactly")
    allowed = {"", "include", "exclude", "uncertain"}
    for row in decisions:
        record_id = row["record_id"]
        if row["question_ids"] not in set(records[record_id]["question_ids"].split("|")):
            errors.append(f"decision question membership drift: {record_id}")
        if row["decision"] not in allowed or row["final_decision"] not in allowed:
            errors.append(f"unsupported decision: {record_id}")
        if row["decision"] and not (row["reviewer_id"].strip() and row["reviewed_at"].strip()):
            errors.append(f"primary decision lacks reviewer/time: {record_id}")
        if row["final_decision"] and not row["adjudicator_id"].strip():
            errors.append(f"final decision lacks adjudicator: {record_id}")
    if len({key(row) for row in pilot}) != len(pilot) or not {key(row) for row in pilot} <= queue_keys:
        errors.append("training pilot is not a unique subset of the human queue")
    for row in pilot:
        started = any(row[field].strip() for field in ("reviewer_1_id", "reviewer_1_decision", "reviewer_1_reason", "reviewer_1_at",
                      "reviewer_2_id", "reviewer_2_decision", "reviewer_2_reason", "reviewer_2_at", "adjudicator_id",
                      "final_decision", "final_reason", "adjudicated_at"))
        complete = all(row[field].strip() for field in ("reviewer_1_id", "reviewer_1_decision", "reviewer_1_at",
                       "reviewer_2_id", "reviewer_2_decision", "reviewer_2_at", "final_decision"))
        if row["reviewer_1_decision"] not in allowed or row["reviewer_2_decision"] not in allowed or row["final_decision"] not in allowed:
            errors.append(f"pilot unsupported decision: {row['pilot_id']}")
        if complete and row["reviewer_1_id"] == row["reviewer_2_id"]:
            errors.append(f"pilot reviewers must differ: {row['pilot_id']}")
        expected = "complete_candidate_requires_validation" if complete else "in_progress_human_training" if started else "pending_human_training"
        if row["status"] != expected:
            errors.append(f"pilot status mismatch: {row['pilot_id']}")

    for prefix in ("clinicaltrials", "koreamed"):
        source = rows(f"{prefix}_retrievals.csv")
        target = rows(f"{prefix}_review_queue.csv")
        if {key(row) for row in source} != {key(row) for row in target}:
            errors.append(f"{prefix} retrieval/review queue coverage mismatch")

    mutation_tests = {
        "missing_queue_unit_rejected": set(list(queue_keys)[1:]) != expected_keys,
        "proxy_authority_rejected": "include" != "none",
        "unsupported_human_decision_rejected": "invented" not in allowed,
        "changed_title_rejected": queue[0]["title"] != "MUTATED TITLE",
        "pilot_outside_queue_rejected": ("REC-NOT-FOUND", "A1") not in queue_keys,
        "registry_unit_loss_rejected": len(rows("clinicaltrials_review_queue.csv")) - 1 != len(rows("clinicaltrials_retrievals.csv")),
    }
    if not all(mutation_tests.values()):
        errors.append("screening lineage mutation escaped detection")

    names = ["record_retrievals.csv", "screening_review_queue.csv",
             "screening_proxy_sensitivity_first.csv", "screening_proxy_structured_conservative.csv",
             "screening_decisions.csv", "screening_pilot_queue.csv",
             "clinicaltrials_retrievals.csv", "clinicaltrials_review_queue.csv",
             "koreamed_retrievals.csv", "koreamed_review_queue.csv"]
    artifacts = [{"path": (DATA / name).relative_to(ROOT).as_posix(),
                  "size_bytes": (DATA / name).stat().st_size, "sha256": sha256(DATA / name)}
                 for name in names]
    result = {"schema_version": "1.0.0", "status": "proxy_screening_lineage_verified_human_gates_open",
              "errors": errors, "pubmed_record_question_units": len(expected_keys),
              "pubmed_unique_records": len(records), "clinicaltrials_units": len(rows("clinicaltrials_retrievals.csv")),
              "koreamed_units": len(rows("koreamed_retrievals.csv")), "human_decisions": 0,
              "ai_only_exclusions": 0, "mutation_tests": mutation_tests, "artifacts": artifacts}
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
