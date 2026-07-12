#!/usr/bin/env python3
"""Prove Korean PRESS regeneration preserves human bytes and rejects drift."""

import csv
import tempfile
from pathlib import Path

from build_korean_db_press_queue import FIELDS, write_or_preserve


def main() -> int:
    base = {field: "" for field in FIELDS}
    base.update({"review_id": "P1", "platform": "RISS", "question_id": "A1", "query": "q",
                 "reviewer_id": "human", "reviewed_at": "2026-07-12", "decision": "approve_for_final_rerun",
                 "status": "complete_candidate_requires_validation"})
    tests = {}
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "queue.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
            writer.writeheader(); writer.writerow(base)
        before = path.read_bytes()
        generated = [dict(base, reviewer_id="", reviewed_at="", decision="", status="pending_external_human_review")]
        tests["human_bytes_preserved"] = write_or_preserve(path, generated) == "preserved_existing_human_data" and path.read_bytes() == before
        try:
            write_or_preserve(path, [dict(generated[0], query="changed")])
            tests["source_drift_rejected"] = False
        except ValueError:
            tests["source_drift_rejected"] = path.read_bytes() == before
    errors = [] if all(tests.values()) else ["Korean PRESS preservation contract failed"]
    print({"errors": errors, "tests": tests})
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
