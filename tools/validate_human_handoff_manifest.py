#!/usr/bin/env python3
"""Validate queue hashes and derived human-review progress states."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "research/review_queue/human_handoff_manifest.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def expected_state(rows: int, any_count: int, complete: int, required: list[str]) -> str:
    if not required: return "blocker_instruction"
    if rows == 0: return "awaiting_upstream_rows"
    if any_count == 0: return "not_started"
    if complete == rows: return "complete_candidate_requires_validation"
    return "in_progress_partial"


def main() -> int:
    errors: list[str] = []
    value = json.loads(MANIFEST.read_text(encoding="utf-8"))
    queues = value.get("queues", [])
    any_total = complete_total = 0
    for item in queues:
        path = ROOT / item["path"]
        if not path.is_file() or path.stat().st_size != item["size_bytes"] or sha(path) != item["sha256"]:
            errors.append(f"handoff hash/size mismatch: {item['path']}")
            continue
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        human, required = item["human_entry_fields"], item["minimum_completion_fields"]
        any_count = sum(any(row.get(field, "").strip() for field in human) for row in rows) if human else 0
        complete = sum(all(row.get(field, "").strip() for field in required) for row in rows) if required else 0
        if (len(rows) != item["row_count"] or any_count != item["rows_with_any_human_data"]
                or complete != item["rows_complete_candidate"]):
            errors.append(f"handoff derived count mismatch: {item['path']}")
        if item["progress_state"] != expected_state(len(rows), any_count, complete, required):
            errors.append(f"handoff progress state mismatch: {item['path']}")
        any_total += any_count
        complete_total += complete
    if value.get("queue_count") != len(queues) or len(queues) != 30:
        errors.append("expected 30 handoff queues")
    if value.get("rows_with_any_human_data") != any_total or value.get("rows_complete_candidate") != complete_total:
        errors.append("handoff aggregate progress mismatch")
    actionable = [item for item in queues if item["minimum_completion_fields"]]
    expected_complete = bool(actionable) and all(item["progress_state"] == "complete_candidate_requires_validation" for item in actionable)
    expected_status = "complete_candidate_requires_phase_validation" if expected_complete else "ready_for_external_review_not_completed"
    if value.get("human_work_complete") is not expected_complete or value.get("all_actionable_queues_complete_candidate") is not expected_complete or value.get("status") != expected_status:
        errors.append("human handoff aggregate completion mismatch")
    state_contract_tests = {
        "instruction": expected_state(5, 0, 0, []) == "blocker_instruction",
        "awaiting_upstream": expected_state(0, 0, 0, ["reviewer"]) == "awaiting_upstream_rows",
        "not_started": expected_state(5, 0, 0, ["reviewer"]) == "not_started",
        "partial": expected_state(5, 1, 0, ["reviewer"]) == "in_progress_partial",
        "complete_candidate": expected_state(5, 5, 5, ["reviewer"]) == "complete_candidate_requires_validation",
    }
    if not all(state_contract_tests.values()):
        errors.append("handoff progress-state contract failed")
    result = {"errors": errors, "queues": len(queues), "rows": value.get("total_rows"),
              "rows_with_any_human_data": any_total, "rows_complete_candidate": complete_total,
              "state_contract_tests": state_contract_tests,
              "human_work_complete": expected_complete}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
