from __future__ import annotations

import csv
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "research" / "logs" / "v40_run_report.json"

PROBE = ROOT / "research" / "searches_v4" / "probe_report.json"
QUERY_DEFINITIONS = ROOT / "research" / "searches_v4" / "query_definitions.json"
CORPUS = ROOT / "data" / "curated_v4" / "evidence_map.csv"
CORPUS_MANIFEST = ROOT / "data" / "curated_v4" / "corpus_manifest.json"
PHASE_B_CHECK = ROOT / "research" / "logs" / "v40_phase_b_verification.json"
SCREENING = ROOT / "data" / "curated_v4" / "agent_screening_classifications.csv"
SCREENING_BASE = ROOT / "research" / "screening" / "v40_agent"
SCREENING_MANIFEST = SCREENING_BASE / "manifest.json"
RULE_AUDIT = SCREENING_BASE / "semantic_rule_audit.json"
ADJUDICATION_CHECK = SCREENING_BASE / "semantic_adjudication_consistency.json"
INVARIANT_CHECKS = SCREENING_BASE / "invariant_checks.json"
ADJUDICATIONS = SCREENING_BASE / "semantic_adjudications.json"
DOWNSTREAM_BASE = ROOT / "research" / "systematic_review_v40"
DOWNSTREAM_MANIFEST = DOWNSTREAM_BASE / "manifest.json"
CORE_MANIFEST = DOWNSTREAM_BASE / "core_manifest.json"
DOWNSTREAM_CHECK = DOWNSTREAM_BASE / "verification.json"
V3_CORPUS_MANIFEST = ROOT / "data" / "curated_v3" / "corpus_manifest.json"
AMENDMENTS = ROOT / "research" / "protocol" / "amendments.csv"
DECISIONS = ROOT / "research" / "logs" / "DECISIONS_v40.md"

QUESTION_ORDER = (
    "HRS1_PERIOPERATIVE",
    "HRS2_KIDNEY_DISEASE",
    "HRS3_PREGNANCY",
    "HRS4_LIVER_DISEASE",
    "HRS5_ANTICOAGULATION",
)

START_STATUS = [
    " M data/curated_v2/llm_screening_classifications.csv",
    " M research/screening/llm_screening_manifest.json",
    " M research/screening/llm_screening_runs.jsonl",
    " M tools/llm_screening.py",
    "?? research/protocol/HANDOFF_v30_claude.md",
    "?? research/protocol/protocol-v4.0-mecir-search.md",
    "?? research/screening/agent_batches/",
    "?? research/screening/agent_local_runs.jsonl",
    "?? research/screening/agent_results/",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"expected JSON object: {path}")
    return value


def relative(path: Path) -> str:
    return path.resolve().relative_to(ROOT.resolve()).as_posix()


def artifact(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise RuntimeError(f"missing artifact: {path}")
    return {"path": relative(path), "sha256": sha256(path), "bytes": path.stat().st_size}


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf-8"
    ).stdout.strip()


def status_path(line: str) -> str:
    value = line[3:] if len(line) >= 4 else line
    return value.split(" -> ")[-1]


def parse_checksum(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        expected, name = line.split(maxsplit=1)
        name = name.lstrip("* ").strip()
        member = path.parent / name
        actual = sha256(member)
        if actual != expected.lower():
            raise RuntimeError(f"raw checksum mismatch: {member}")
        rows.append({"path": relative(member), "sha256": actual, "bytes": member.stat().st_size})
    return rows


def main() -> None:
    probe = load_json(PROBE)
    corpus_manifest = load_json(CORPUS_MANIFEST)
    phase_b_check = load_json(PHASE_B_CHECK)
    screening_manifest = load_json(SCREENING_MANIFEST)
    rule_audit = load_json(RULE_AUDIT)
    adjudication_check = load_json(ADJUDICATION_CHECK)
    invariant_checks = load_json(INVARIANT_CHECKS)
    adjudications = load_json(ADJUDICATIONS)
    downstream_manifest = load_json(DOWNSTREAM_MANIFEST)
    core_manifest = load_json(CORE_MANIFEST)
    downstream_check = load_json(DOWNSTREAM_CHECK)
    v3_manifest = load_json(V3_CORPUS_MANIFEST)

    if probe.get("question_count") != 5 or not probe.get("all_rules_passed"):
        raise RuntimeError("Phase A is incomplete")
    if corpus_manifest.get("status") != "complete" or corpus_manifest["corpus"]["sha256"] != sha256(CORPUS):
        raise RuntimeError("Phase B is incomplete")
    if screening_manifest.get("coverage") != 1.0 or screening_manifest.get("run_complete") is not True:
        raise RuntimeError("Phase C is incomplete")
    if downstream_check.get("passed") is not True or downstream_check.get("error_count") != 0:
        raise RuntimeError("Phase D is incomplete")

    v3_hits = {
        item["question_id"]: item["hit_count"] for item in v3_manifest["search"]["question_runs"]
    }
    probe_by_question = {item["question_id"]: item for item in probe["questions"]}
    hit_comparison: list[dict[str, Any]] = []
    phase_a_questions: list[dict[str, Any]] = []
    for question_id in QUESTION_ORDER:
        question = probe_by_question[question_id]
        old = int(v3_hits[question_id])
        new = int(question["hit_count"])
        hit_comparison.append(
            {
                "question_id": question_id,
                "v3_hit_count": old,
                "v4_hit_count": new,
                "display": f"{old} → {new}",
                "absolute_change": new - old,
                "multiple": round(new / old, 6),
            }
        )
        phase_a_questions.append(
            {
                "question_id": question_id,
                "question": question["question"],
                "hit_count": new,
                "query": question["query"],
                "query_sha256": question["query_sha256"],
                "executed_at_utc": question["executed_at_utc"],
                "transport": question["transport"],
                "raw_response": {
                    "path": question["raw_response_path"],
                    "sha256": question["raw_response_sha256"],
                },
                "blocks": question["blocks"],
                "rules_1_to_9": question["rules_1_to_9"],
                "all_rules_passed": question["all_rules_passed"],
            }
        )

    rule_rollup: list[dict[str, Any]] = []
    for rule_number in range(1, 10):
        per_question = {
            question_id: next(
                item["result"]
                for item in probe_by_question[question_id]["rules_1_to_9"]
                if item["rule"] == rule_number
            )
            for question_id in QUESTION_ORDER
        }
        first = next(
            item for item in probe_by_question[QUESTION_ORDER[0]]["rules_1_to_9"]
            if item["rule"] == rule_number
        )
        rule_rollup.append(
            {
                "rule": rule_number,
                "title": first["title"],
                "all_questions_result": "통과" if set(per_question.values()) == {"통과"} else "위반",
                "per_question": per_question,
            }
        )

    raw_runs: list[dict[str, Any]] = []
    raw_xml_total = 0
    for run in corpus_manifest["search"]["question_runs"]:
        checksum_path = ROOT / run["checksum_path"]
        members = parse_checksum(checksum_path)
        raw_xml_total += len(members)
        raw_runs.append(
            {
                **run,
                "checksum_file": artifact(checksum_path),
                "xml_files": members,
                "xml_file_count": len(members),
            }
        )

    with AMENDMENTS.open(encoding="utf-8-sig", newline="") as handle:
        amendment_rows = list(csv.DictReader(handle))
    am008 = next((row for row in amendment_rows if row["amendment_id"] == "AM-008"), None)
    if am008 is None:
        raise RuntimeError("AM-008 is missing")

    status_output = subprocess.run(
        ["git", "status", "--short"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    ).stdout
    current_status = [line.rstrip() for line in status_output.splitlines() if line]
    allowed_new_prefixes = (
        "data/curated_v4/",
        "research/searches_v4/",
        "research/screening/v40_agent/",
        "research/systematic_review_v40/",
        "research/logs/v40_",
        "research/logs/DECISIONS_v40.md",
        "tools/v40/",
    )
    end_legacy_status = sorted(
        line for line in current_status
        if status_path(line) != "research/protocol/amendments.csv"
        and not status_path(line).startswith(allowed_new_prefixes)
    )
    start_legacy_status = sorted(START_STATUS)
    legacy_unchanged = end_legacy_status == start_legacy_status
    if not legacy_unchanged:
        raise RuntimeError(
            "legacy path status changed: "
            + json.dumps({"start": start_legacy_status, "end": end_legacy_status}, ensure_ascii=False)
        )

    main_artifacts = [
        artifact(path)
        for path in (
            PROBE,
            QUERY_DEFINITIONS,
            CORPUS,
            CORPUS_MANIFEST,
            PHASE_B_CHECK,
            SCREENING,
            SCREENING_MANIFEST,
            SCREENING_BASE / "batch_index.json",
            SCREENING_BASE / "checkpoints.jsonl",
            SCREENING_BASE / "batch_runs.jsonl",
            SCREENING_BASE / "prompts" / "screening_prompt.md",
            SCREENING_BASE / "semantic_adjudications.json",
            SCREENING_BASE / "semantic_rule_audit.json",
            SCREENING_BASE / "semantic_adjudication_consistency.json",
            SCREENING_BASE / "invariant_checks.json",
            DOWNSTREAM_BASE / "regex_gate.csv",
            DOWNSTREAM_BASE / "picos_extraction.csv",
            DOWNSTREAM_BASE / "core_evidence.csv",
            DOWNSTREAM_BASE / "key_finding_translations_ko.json",
            DOWNSTREAM_BASE / "personalized_rules.json",
            DOWNSTREAM_MANIFEST,
            CORE_MANIFEST,
            DOWNSTREAM_CHECK,
            AMENDMENTS,
            DECISIONS,
            ROOT / "tools" / "v40" / "pubmed_v4.py",
            ROOT / "tools" / "v40" / "query_terms.py",
            ROOT / "tools" / "v40" / "screening_manager_v4.py",
            ROOT / "tools" / "v40" / "agent_screen_worker.py",
            ROOT / "tools" / "v40" / "build_site_v4.py",
            Path(__file__),
        )
    ]
    translation_parts = [artifact(path) for path in sorted((DOWNSTREAM_BASE / "etc" / "translation_parts").glob("*.json"))]
    semantic_audit_files = [artifact(path) for path in sorted((SCREENING_BASE / "etc" / "semantic_audit_cases").glob("*.json"))]

    report = {
        "schema_version": "1.0.0",
        "track": "v4.0_mecir_search_redesign",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run_status": "complete",
        "git": {
            "head_at_start": "6234d0ed6e2642ea1c228e78d2f1e47acc4475ff",
            "head_at_end": git("rev-parse", "HEAD"),
            "commit_created": False,
            "push_performed": False,
            "deployment_performed": False,
            "status_at_start": START_STATUS,
            "status_at_end": current_status,
            "legacy_status_at_start": start_legacy_status,
            "legacy_status_at_end": end_legacy_status,
            "legacy_v2_v3_paths_unchanged": legacy_unchanged,
            "preexisting_modified_v2_file": "data/curated_v2/llm_screening_classifications.csv",
        },
        "protocol": {
            "path": probe["protocol_path"],
            "sha256": probe["protocol_sha256"],
            "question_definition_path": corpus_manifest["picos"]["path"],
            "question_definition_sha256": corpus_manifest["picos"]["sha256"],
            "amendment": am008,
            "amendments_sha256": sha256(AMENDMENTS),
            "decisions_path": relative(DECISIONS),
            "decisions_sha256": sha256(DECISIONS),
        },
        "phase_a": {
            "status": "complete",
            "method": "PubMed ESearch count only; no EFetch in this phase",
            "source": probe["source"],
            "search_period": probe["search_period"],
            "combined_record_question_hits": probe["combined_record_question_hits"],
            "query_definitions": artifact(QUERY_DEFINITIONS),
            "probe_report": artifact(PROBE),
            "questions": phase_a_questions,
            "protocol_section_3_rule_rollup": rule_rollup,
            "all_rules_passed": probe["all_rules_passed"],
            "v3_to_v4_hit_count_change": hit_comparison,
            "query_level_method_assessment": {
                "cochrane_handbook_chapter_4": "aligned",
                "mecir_c32_to_c36": "aligned",
                "whole_review_search_process": "partial",
                "reason": "The protocol specified PubMed only; multi-database and supplementary-search requirements were not executed.",
            },
        },
        "phase_b": {
            "status": "complete",
            "run_id": corpus_manifest["run_id"],
            "raw_retrieved_rows": corpus_manifest["corpus"]["raw_retrieved_row_count"],
            "raw_xml_files": raw_xml_total,
            "question_runs": raw_runs,
            "deduplication": corpus_manifest["deduplication"],
            "corpus": corpus_manifest["corpus"],
            "source_constraint": corpus_manifest["source_constraint"],
            "search_log": corpus_manifest["search_log"],
            "phase_b_check": {**artifact(PHASE_B_CHECK), "result": phase_b_check},
            "manifest_evidence_map_hash_match": corpus_manifest["corpus"]["sha256"] == sha256(CORPUS),
        },
        "phase_c": {
            "status": "complete",
            "coverage": screening_manifest["coverage"],
            "row_count": screening_manifest["row_count"],
            "classified": screening_manifest["classified"],
            "distribution": screening_manifest["distribution"],
            "distribution_by_question": screening_manifest["distribution_by_question"],
            "evidence_basis": screening_manifest["by_evidence_basis"],
            "confidence_distribution": screening_manifest["confidence_distribution"],
            "reason_code_counts": screening_manifest["reason_code_counts"],
            "subagent_count": screening_manifest["subagent_count"],
            "subagents": screening_manifest["subagents"],
            "rows_by_agent": screening_manifest["rows_by_agent"],
            "batch_count": len(screening_manifest["batches"]),
            "batches": screening_manifest["batches"],
            "prompt": {
                "path": screening_manifest["prompt_path"],
                "sha256": screening_manifest["prompt_sha256"],
            },
            "worker": {
                "path": screening_manifest["worker_path"],
                "version": screening_manifest["worker_version"],
                "sha256": screening_manifest["worker_sha256"],
            },
            "raw_rule_audit": {
                "path": screening_manifest["semantic_rule_audit_path"],
                "sha256": screening_manifest["semantic_rule_audit_sha256"],
                "cases": rule_audit["case_count"],
                "matches": rule_audit["passed_case_count"],
                "mismatches": rule_audit["failed_case_count"],
                "adjudications_applied": rule_audit["adjudications_applied"],
            },
            "agent_adjudications": {
                "path": screening_manifest["semantic_adjudications_path"],
                "sha256": screening_manifest["semantic_adjudications_sha256"],
                "records": adjudications["record_count"],
                "consistency_cases": adjudication_check["case_count"],
                "consistency_matches": adjudication_check["passed_case_count"],
                "consistency_mismatches": adjudication_check["failed_case_count"],
            },
            "invariant_checks": {
                "path": screening_manifest["invariant_checks_path"],
                "sha256": screening_manifest["invariant_checks_sha256"],
                "cases": invariant_checks["case_count"],
                "matches": invariant_checks["passed_case_count"],
                "mismatches": invariant_checks["failed_case_count"],
            },
            "semantic_audit_files": semantic_audit_files,
            "checkpoint": artifact(SCREENING_BASE / "checkpoints.jsonl"),
            "batch_runs": artifact(SCREENING_BASE / "batch_runs.jsonl"),
            "output": artifact(SCREENING),
            "manifest": artifact(SCREENING_MANIFEST),
        },
        "phase_d": {
            "status": "complete",
            "evidence_bundle_rows": downstream_check["evidence_bundle_rows"],
            "core_records": downstream_check["core_records"],
            "core_by_question": downstream_check["core_by_question"],
            "translations": downstream_check["translations"],
            "rules": downstream_check["rules"],
            "generated_terminology_gate": downstream_check["generated_terminology_gate"],
            "clinical_rule_gate": downstream_check["clinical_rule_gate"],
            "manifest": downstream_manifest,
            "core_manifest": core_manifest,
            "verification": downstream_check,
            "translation_parts": translation_parts,
        },
        "phase_e": {
            "status": "complete",
            "amendment_id": "AM-008",
            "decisions_log": artifact(DECISIONS),
            "ledger_path": relative(OUTPUT),
        },
        "completion_conditions": {
            "five_probe_counts_and_rule_checks": True,
            "raw_xml_and_checksums_preserved": raw_xml_total == 242,
            "corpus_manifest_hash_matches_evidence_map": corpus_manifest["corpus"]["sha256"] == sha256(CORPUS),
            "screening_coverage_and_distribution_recorded": screening_manifest["coverage"] == 1.0,
            "single_ledger_contains_phase_a_to_e_lineage": True,
            "legacy_v2_v3_paths_unchanged": legacy_unchanged,
        },
        "remaining_unresolved_items": [
            {
                "item": "PubMed-only source coverage",
                "detail": "No second bibliographic database or grey-literature source was searched under the v4 protocol.",
            },
            {
                "item": "Supplementary search methods",
                "detail": "Backward/forward citation searching and specialist peer review of the search strategies were not performed.",
            },
            {
                "item": "Agent-only screening",
                "detail": "No human reference decisions exist. The raw text rules differed from 226 of 616 agent-reviewed edge cases; those 616 records use the frozen agent adjudication layer.",
            },
            {
                "item": "Title and abstract observation boundary",
                "detail": "Full article text was not observed. Eleven downstream evidence-bundle records are title-only.",
            },
            {
                "item": "Protocol boundary",
                "detail": "Final study-selection totals, pooled analyses, bias appraisal, certainty appraisal, and clinical directives were intentionally not produced.",
            },
        ],
        "artifact_index": {
            "main": main_artifacts,
            "translation_parts": translation_parts,
            "semantic_audit_files": semantic_audit_files,
        },
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(
        json.dumps(
            {
                "path": relative(OUTPUT),
                "sha256": sha256(OUTPUT),
                "bytes": OUTPUT.stat().st_size,
                "run_status": report["run_status"],
                "completion_conditions": report["completion_conditions"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
