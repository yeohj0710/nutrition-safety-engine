#!/usr/bin/env python3
"""Validate KoreaMed complete-display capture and keep human decisions empty."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "research/searches/koreamed_designpilot_20260710"
STATUS = "design_pilot_complete_display_native_export_server_error_not_final_search"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rows(path: str) -> list[dict[str, str]]:
    with (ROOT / path).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    errors = []
    summary = json.loads((RUN / "summary.json").read_text(encoding="utf-8"))
    log = rows("research/searches/koreamed_designpilot_20260710/search_log.csv")
    records = rows("data/interim/koreamed_records.csv")
    retrievals = rows("data/interim/koreamed_retrievals.csv")
    queue = rows("data/interim/koreamed_review_queue.csv")
    links = rows("data/interim/koreamed_pubmed_link_candidates.csv")
    expected_hits = {"A1": 62, "A2": 0, "B1": 0, "B2": 0, "B3": 0}
    if len(log) != 5 or {row["question_id"]: int(row["hits_observed"]) for row in log} != expected_hits:
        errors.append("KoreaMed five-run hit counts mismatch")
    if len(records) != 62 or len(retrievals) != 62 or len(queue) != 62 or len({row["kmid"] for row in records}) != 62:
        errors.append("KoreaMed complete-display record coverage mismatch")
    if any(row["human_eligibility_decision"] for row in records):
        errors.append("KoreaMed records contain unverified eligibility decisions")
    allowed_link = {"", "same_report", "not_same_report", "uncertain"}
    if any(row["human_link_decision"] not in allowed_link for row in links):
        errors.append("KoreaMed links contain invalid human decisions")
    if any(bool(row["human_link_decision"]) != all(row.get(field, "") for field in ("link_reason", "verified_by", "verified_at")) for row in links):
        errors.append("KoreaMed link decisions require reason, verifier, and timestamp")
    queue_fields = ("reviewer_1_id", "reviewer_1_decision", "reviewer_2_id", "reviewer_2_decision", "adjudicator_id", "final_decision")
    allowed_screen = {"", "include", "exclude", "uncertain"}
    if any(row["reviewer_1_decision"] not in allowed_screen or row["reviewer_2_decision"] not in allowed_screen or row["final_decision"] not in allowed_screen for row in queue):
        errors.append("KoreaMed review queue contains invalid human decisions")
    if any(row["status"] != STATUS for row in log + retrievals):
        errors.append("KoreaMed status overstated")
    if summary.get("native_records_exported") != 0 or summary.get("final_search_claim_allowed") is not False:
        errors.append("KoreaMed native export/final-search status overstated")
    for line in (RUN / "checksum.sha256").read_text(encoding="utf-8").splitlines():
        expected, name = line.split("  ", 1)
        path = ROOT / name
        if not path.is_file() or sha256(path) != expected:
            errors.append(f"KoreaMed checksum mismatch: {name}")
    result = {
        "errors": errors,
        "status": "complete_display_proxy_verified_native_export_failed" if not errors else "failed_quality_gate",
        "runs": len(log),
        "hits_observed": sum(int(row["hits_observed"]) for row in log),
        "records_captured": len(records),
        "native_records_exported": 0,
        "exact_title_link_candidates": len(links),
        "human_decisions": sum(bool(row["final_decision"]) for row in queue),
        "final_search_claim_allowed": False,
    }
    (RUN / "validation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
