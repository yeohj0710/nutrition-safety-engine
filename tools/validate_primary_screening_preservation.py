#!/usr/bin/env python3
"""Prove primary-screening and training decisions survive proxy regeneration."""

import csv
import tempfile
from pathlib import Path

from generate_screening_proxy import write_or_preserve


def check(name: str, fields: list[str], key: str, human: tuple[str, ...], static: tuple[str, ...], populated: dict[str, str], generated: dict[str, str]) -> dict[str, bool]:
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / f"{name}.csv"
        with path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n"); writer.writeheader(); writer.writerow(populated)
        before = path.read_bytes()
        preserved = write_or_preserve(path, [generated], fields, key, human, static) == "preserved_existing_human_data" and path.read_bytes() == before
        try:
            changed = dict(generated); changed[static[-1]] = "CHANGED"
            write_or_preserve(path, [changed], fields, key, human, static); drift = False
        except ValueError:
            drift = path.read_bytes() == before
        return {f"{name}_human_bytes_preserved": preserved, f"{name}_lineage_drift_rejected": drift}


def main() -> int:
    decision_fields = ["record_id", "question_ids", "screening_stage", "reviewer_id", "decision", "reviewed_at"]
    decision_human = ("reviewer_id", "decision", "reviewed_at")
    decision = {field: "" for field in decision_fields}; decision.update({"record_id": "R1", "question_ids": "A1", "screening_stage": "title_abstract", "reviewer_id": "H1", "decision": "include", "reviewed_at": "2026-07-12"})
    decision_generated = dict(decision, reviewer_id="", decision="", reviewed_at="")
    tests = check("primary", decision_fields, "record_id", decision_human, ("record_id", "question_ids", "screening_stage"), decision, decision_generated)
    pilot_fields = ["pilot_id", "record_id", "question_id", "reviewer_1_id", "reviewer_1_decision", "status"]
    pilot_human = ("reviewer_1_id", "reviewer_1_decision")
    pilot = {"pilot_id": "P1", "record_id": "R1", "question_id": "A1", "reviewer_1_id": "H1", "reviewer_1_decision": "include", "status": "in_progress_human_training"}
    pilot_generated = dict(pilot, reviewer_1_id="", reviewer_1_decision="", status="pending_human_training")
    tests.update(check("pilot", pilot_fields, "pilot_id", pilot_human, ("pilot_id", "record_id", "question_id"), pilot, pilot_generated))
    errors = [] if all(tests.values()) else ["primary screening preservation contract failed"]
    print({"errors": errors, "tests": tests})
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
