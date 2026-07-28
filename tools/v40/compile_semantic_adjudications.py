from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tools.v40.agent_screen_worker import classify
from tools.v40.screening_semantic_regression import (
    ANIMAL_CASES,
    AUDIT_CASE_DIR,
    CORPUS,
    EXPECTED,
    EXPECTED_CONFIDENCE,
    FORBIDDEN_REASON_CODES,
    PROMPT,
    REQUIRED_REASON_CODES,
    load_external_audit_cases,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "research" / "screening" / "v40_agent" / "semantic_adjudications.json"
REGRESSION = ROOT / "tools" / "v40" / "screening_semantic_regression.py"
REASON_ORDER = (
    "population",
    "exposure",
    "outcome",
    "human_signal",
    "design_signal",
    "animal_term_present",
    "off_topic",
    "insufficient_abstract",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def expectation_maps() -> tuple[
    dict[tuple[str, str], str],
    dict[tuple[str, str], str],
    dict[tuple[str, str], set[str]],
    dict[tuple[str, str], set[str]],
    list[dict[str, object]],
]:
    decisions: dict[tuple[str, str], str] = {}
    for question_id, grouped in EXPECTED.items():
        for decision, pmids in grouped.items():
            for pmid in pmids:
                key = (question_id, pmid)
                if key in decisions:
                    raise RuntimeError(f"duplicate built-in adjudication key: {key}")
                decisions[key] = decision

    confidence = dict(EXPECTED_CONFIDENCE)
    required = {key: set(value) for key, value in REQUIRED_REASON_CODES.items()}
    forbidden = {key: set(value) for key, value in FORBIDDEN_REASON_CODES.items()}
    external, source_files = load_external_audit_cases()
    for case in external:
        key = (str(case["question_id"]), str(case["pmid"]))
        decision = str(case["expected_decision"])
        prior_decision = decisions.get(key)
        if prior_decision is not None and prior_decision != decision:
            raise RuntimeError(f"conflicting adjudication decision: {key}")
        decisions[key] = decision
        expected_confidence = str(case["expected_confidence"])
        prior_confidence = confidence.get(key)
        if prior_confidence is not None and prior_confidence != expected_confidence:
            raise RuntimeError(f"conflicting adjudication confidence: {key}")
        confidence[key] = expected_confidence
        required.setdefault(key, set()).update(case.get("required_reason_codes", []))
        forbidden.setdefault(key, set()).update(case.get("forbidden_reason_codes", []))

    for key in ANIMAL_CASES:
        required.setdefault(key, set()).add("animal_term_present")
        forbidden.setdefault(key, set()).update({"population", "human_signal"})
    for key in (
        ("HRS5_ANTICOAGULATION", "28520347"),
        ("HRS5_ANTICOAGULATION", "29261922"),
    ):
        forbidden.setdefault(key, set()).add("exposure")

    for key in decisions:
        overlap = required.get(key, set()) & forbidden.get(key, set())
        if overlap:
            raise RuntimeError(f"conflicting adjudication reason codes for {key}: {sorted(overlap)}")
    return decisions, confidence, required, forbidden, source_files


def compile_payload() -> dict[str, Any]:
    decisions, confidence, required, forbidden, source_files = expectation_maps()
    rows: dict[tuple[str, str], dict[str, str]] = {}
    with CORPUS.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (row["question_id"], row["provider_id"])
            if key in decisions:
                if key in rows:
                    raise RuntimeError(f"duplicate corpus adjudication key: {key}")
                rows[key] = row
    missing = sorted(set(decisions) - set(rows))
    if missing:
        raise RuntimeError(f"missing corpus adjudication records: {missing[:10]}")

    records: list[dict[str, Any]] = []
    for key in sorted(decisions):
        row = rows[key]
        observed = classify(row, apply_adjudication=False)
        reasons = set(observed["reason_codes"])
        reasons.update(required.get(key, set()))
        reasons.difference_update(forbidden.get(key, set()))
        if not reasons:
            reasons.add("off_topic")
        records.append(
            {
                "record_id": row["record_id"],
                "question_id": row["question_id"],
                "decision": decisions[key],
                "reason_codes": [code for code in REASON_ORDER if code in reasons],
                "confidence": confidence.get(key, observed["confidence"]),
                "evidence_basis": observed["evidence_basis"],
                "status": "ok",
            }
        )

    return {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "method": "agent_reviewed_semantic_edge_case_adjudication",
        "prompt_sha256": sha256(PROMPT),
        "corpus_path": CORPUS.resolve().relative_to(ROOT.resolve()).as_posix(),
        "corpus_sha256": sha256(CORPUS),
        "regression_definition_path": REGRESSION.resolve().relative_to(ROOT.resolve()).as_posix(),
        "regression_definition_sha256": sha256(REGRESSION),
        "semantic_audit_directory": AUDIT_CASE_DIR.resolve().relative_to(ROOT.resolve()).as_posix(),
        "semantic_audit_files": source_files,
        "record_count": len(records),
        "records": records,
    }


def main() -> None:
    payload = compile_payload()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(
        json.dumps(
            {
                "path": OUTPUT.resolve().relative_to(ROOT.resolve()).as_posix(),
                "record_count": payload["record_count"],
                "sha256": sha256(OUTPUT),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
