#!/usr/bin/env python3
"""Prove full-text routing never erases access/reviewer work."""

import csv
import json
import tempfile
from pathlib import Path
import build_fulltext_review_queue as target


def main() -> int:
    fields = ["fulltext_queue_id", "report_id", "record_id", "question_id", "title", "pmid", "lineage_sha256",
              "fulltext_access_status", "source_file_path", "source_file_sha256", "study_id", "study_link_verified_by",
              "design_family", "design_verified_by", "reviewer_1_id", "reviewer_1_decision", "reviewer_1_reason",
              "reviewer_1_at", "reviewer_2_id", "reviewer_2_decision", "reviewer_2_reason", "reviewer_2_at",
              "adjudicator_id", "final_decision", "final_reason", "status"]
    base = {field: "" for field in fields}; base.update({"fulltext_queue_id": "FT1", "report_id": "RP1", "record_id": "R1",
        "question_id": "A1", "title": "Title", "pmid": "1", "lineage_sha256": "a" * 64,
        "fulltext_access_status": "not_started", "status": "awaiting_fulltext_access_and_double_review"})
    tests = {}
    with tempfile.TemporaryDirectory() as temp:
        original = target.QUEUE; target.QUEUE = Path(temp) / "queue.csv"
        try:
            tests["missing_initialized"] = target.write_or_preserve(fields, [base]) == "generated_no_human_data"
            human = dict(base, fulltext_access_status="requested", status="in_progress_fulltext_review")
            target.write(fields, [human]); before = target.QUEUE.read_bytes()
            tests["human_bytes_preserved"] = target.write_or_preserve(fields, [base]) == "preserved_existing_human_data" and target.QUEUE.read_bytes() == before
            try:
                target.write_or_preserve(fields, [dict(base, lineage_sha256="b" * 64)])
                rejected = False
            except ValueError:
                rejected = target.QUEUE.read_bytes() == before
            tests["routing_change_rejected_without_write"] = rejected
        finally:
            target.QUEUE = original
    errors = [] if all(tests.values()) else ["full-text preservation failed"]
    print(json.dumps({"errors": errors, "tests": tests}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
