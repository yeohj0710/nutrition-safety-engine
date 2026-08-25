from __future__ import annotations

import csv
import hashlib
import json
import math
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "data" / "curated_v4" / "evidence_map.csv"
BASE = ROOT / "research" / "screening" / "v40_agent"
BATCH_DIR = BASE / "batches"
DECISION_DIR = BASE / "decisions"
AUDIT_DIR = BASE / "audit"
PROMPT = BASE / "prompts" / "screening_prompt.md"
INDEX = BASE / "batch_index.json"
CHECKPOINT = BASE / "checkpoints.jsonl"
BATCH_RUNS = BASE / "batch_runs.jsonl"
MANIFEST = BASE / "manifest.json"
OUT_CSV = ROOT / "data" / "curated_v4" / "agent_screening_classifications.csv"
WORKER = ROOT / "tools" / "v40" / "agent_screen_worker.py"
ADJUDICATIONS = BASE / "semantic_adjudications.json"
SEMANTIC_RULE_AUDIT = BASE / "semantic_rule_audit.json"
SEMANTIC_ADJUDICATION_CHECK = BASE / "semantic_adjudication_consistency.json"
INVARIANT_CHECKS = BASE / "invariant_checks.json"
SEMANTIC_AUDIT_CASE_DIR = BASE / "etc" / "semantic_audit_cases"
TARGET_BATCH = 250

DECISIONS = ("retain", "deprioritize", "uncertain")
CONFIDENCES = ("high", "medium", "low")
REASON_CODES = (
    "population", "exposure", "outcome", "human_signal", "design_signal",
    "animal_term_present", "off_topic", "insufficient_abstract",
)
QUESTION_ORDER = (
    "HRS1_PERIOPERATIVE", "HRS2_KIDNEY_DISEASE", "HRS3_PREGNANCY",
    "HRS4_LIVER_DISEASE", "HRS5_ANTICOAGULATION",
)
ASSIGNMENT_PLAN = {
    "HRS1_PERIOPERATIVE": ["/root/terms_hrs1", "/root/mecir_audit"],
    "HRS2_KIDNEY_DISEASE": ["/root/terms_hrs2"],
    "HRS3_PREGNANCY": [
        "/root/terms_hrs3", "/root/v40_pipeline_audit",
        "/root/v40_pipeline_audit/retrieval_audit",
    ],
    "HRS4_LIVER_DISEASE": ["/root/terms_hrs4"],
    "HRS5_ANTICOAGULATION": ["/root/terms_hrs5"],
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def sha256_json(value: Any) -> str:
    return sha256_bytes(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def repo_relative(path: Path) -> str:
    return path.resolve().relative_to(ROOT.resolve()).as_posix()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def load_corpus() -> list[dict[str, str]]:
    with CORPUS.open(encoding="utf-8-sig", newline="") as handle:
        rows = [dict(row) for row in csv.DictReader(handle)]
    rows.sort(key=lambda row: (QUESTION_ORDER.index(row["question_id"]), row["record_id"]))
    keys = [(row["record_id"], row["question_id"]) for row in rows]
    if len(keys) != len(set(keys)):
        raise RuntimeError("duplicate record-question keys in v4 corpus")
    return rows


def split_even(items: list[Any], pieces: int) -> list[list[Any]]:
    base, extra = divmod(len(items), pieces)
    out: list[list[Any]] = []
    cursor = 0
    for index in range(pieces):
        size = base + (1 if index < extra else 0)
        out.append(items[cursor:cursor + size])
        cursor += size
    return out


def split_target(items: list[Any], target: int) -> list[list[Any]]:
    if not items:
        return []
    return split_even(items, max(1, math.ceil(len(items) / target)))


def load_index() -> dict[str, Any]:
    payload = json.loads(INDEX.read_text(encoding="utf-8"))
    if sha256_file(PROMPT) != payload["prompt_sha256"]:
        raise RuntimeError("frozen screening prompt SHA-256 mismatch")
    if sha256_file(CORPUS) != payload["corpus_sha256"]:
        raise RuntimeError("screening corpus SHA-256 mismatch")
    return payload


def build() -> dict[str, Any]:
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    DECISION_DIR.mkdir(parents=True, exist_ok=True)
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    if INDEX.exists():
        index = load_index()
        return {"resumed": True, "batches": len(index["batches"]), "rows": index["total_rows"]}
    if CHECKPOINT.exists() and CHECKPOINT.stat().st_size:
        raise RuntimeError("checkpoint exists without batch index")
    rows = load_corpus()
    by_question: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_question[row["question_id"]].append(row)
    assigned_at = now()
    batches: list[dict[str, Any]] = []
    sequence = 0
    for question_id in QUESTION_ORDER:
        agents = ASSIGNMENT_PLAN[question_id]
        agent_partitions = split_even(by_question[question_id], len(agents))
        for assigned_agent, partition in zip(agents, agent_partitions, strict=True):
            for chunk in split_target(partition, TARGET_BATCH):
                sequence += 1
                batch_id = f"v40-agent-{sequence:04d}"
                payload_rows = [{
                    "record_id": row["record_id"], "question_id": row["question_id"],
                    "title": row["title"], "abstract": row["abstract"],
                    "publication_types": row["publication_types"], "year": row["year"], "venue": row["venue"],
                } for row in chunk]
                batch = {
                    "batch_id": batch_id, "question_id": question_id,
                    "assigned_agent": assigned_agent, "assigned_at": assigned_at,
                    "row_count": len(payload_rows), "input_sha256": sha256_json(payload_rows),
                    "prompt_sha256": sha256_file(PROMPT), "rows": payload_rows,
                }
                path = BATCH_DIR / f"{batch_id}.json"
                write_json(path, batch)
                batches.append({
                    "batch_id": batch_id, "question_id": question_id,
                    "assigned_agent": assigned_agent, "assigned_at": assigned_at,
                    "row_count": len(payload_rows), "input_sha256": batch["input_sha256"],
                    "path": repo_relative(path), "file_sha256": sha256_file(path),
                })
    index = {
        "schema_version": "1.0.0", "track": "v4.0_mecir_search_redesign",
        "created_at": assigned_at, "corpus": repo_relative(CORPUS),
        "corpus_sha256": sha256_file(CORPUS), "prompt_path": repo_relative(PROMPT),
        "prompt_sha256": sha256_file(PROMPT), "target_batch_rows": TARGET_BATCH,
        "total_rows": len(rows), "batch_count": len(batches),
        "assignment_plan": ASSIGNMENT_PLAN,
        "agents": sorted({agent for agents in ASSIGNMENT_PLAN.values() for agent in agents}),
        "batches": batches,
    }
    write_json(INDEX, index)
    return {"resumed": False, "batches": len(batches), "rows": len(rows), "agents": len(index["agents"])}


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if line.strip():
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"invalid JSONL {path}:{number}: {exc}") from exc
    return rows


def expected_basis(row: dict[str, Any]) -> str:
    return "abstract" if str(row.get("abstract", "")).strip() else "title_only"


def validate_decision(obj: dict[str, Any], expected: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if obj.get("record_id") != expected["record_id"] or obj.get("question_id") != expected["question_id"]:
        return [f"key mismatch {obj.get('record_id')}/{obj.get('question_id')}"]
    if obj.get("decision") not in DECISIONS:
        errors.append(f"bad decision {obj.get('decision')}")
    if obj.get("confidence") not in CONFIDENCES:
        errors.append(f"bad confidence {obj.get('confidence')}")
    codes = obj.get("reason_codes")
    if not isinstance(codes, list) or not codes or any(code not in REASON_CODES for code in codes):
        errors.append(f"bad reason_codes {codes}")
    basis = obj.get("evidence_basis")
    expected_value = expected_basis(expected)
    if basis != expected_value:
        errors.append(f"evidence_basis must be {expected_value}")
    if expected_value == "title_only":
        if obj.get("confidence") != "low":
            errors.append("title_only requires confidence=low")
        if "insufficient_abstract" not in (codes or []):
            errors.append("title_only requires insufficient_abstract")
    if obj.get("status") != "ok":
        errors.append(f"bad status {obj.get('status')}")
    return errors


def validate_batch_decisions(batch_meta: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    batch = json.loads((ROOT / batch_meta["path"]).read_text(encoding="utf-8"))
    if sha256_json(batch["rows"]) != batch_meta["input_sha256"]:
        raise RuntimeError(f"batch input hash mismatch: {batch_meta['batch_id']}")
    decision_path = DECISION_DIR / f"{batch_meta['batch_id']}.jsonl"
    decisions = read_jsonl(decision_path)
    expected_map = {(row["record_id"], row["question_id"]): row for row in batch["rows"]}
    actual_map: dict[tuple[str, str], dict[str, Any]] = {}
    problems: list[str] = []
    for obj in decisions:
        key = (obj.get("record_id"), obj.get("question_id"))
        if key in actual_map:
            problems.append(f"duplicate key {key}")
            continue
        if key not in expected_map:
            problems.append(f"foreign key {key}")
            continue
        actual_map[key] = obj
        problems.extend(f"{key}: {error}" for error in validate_decision(obj, expected_map[key]))
    missing = set(expected_map) - set(actual_map)
    if missing:
        problems.append(f"missing keys={len(missing)} examples={sorted(missing)[:5]}")
    if set(actual_map) - set(expected_map):
        problems.append("extra decision keys")
    if problems:
        raise RuntimeError(f"invalid decisions {batch_meta['batch_id']}: " + "; ".join(problems[:20]))
    audit_path = AUDIT_DIR / f"{batch_meta['batch_id']}.json"
    if not audit_path.exists():
        raise RuntimeError(f"missing batch audit receipt: {batch_meta['batch_id']}")
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    if audit.get("batch_id") != batch_meta["batch_id"] or audit.get("assigned_agent") != batch_meta["assigned_agent"]:
        raise RuntimeError(f"batch audit assignment mismatch: {batch_meta['batch_id']}")
    if audit.get("row_count") != batch_meta["row_count"]:
        raise RuntimeError(f"batch audit row count mismatch: {batch_meta['batch_id']}")
    if audit.get("decisions_sha256") != sha256_file(decision_path):
        raise RuntimeError(f"batch audit decision hash mismatch: {batch_meta['batch_id']}")
    if audit.get("worker_sha256") != sha256_file(WORKER):
        raise RuntimeError(f"batch audit worker hash mismatch: {batch_meta['batch_id']}")
    expected_adjudication_sha = sha256_file(ADJUDICATIONS) if ADJUDICATIONS.exists() else None
    if audit.get("semantic_adjudications_sha256") != expected_adjudication_sha:
        raise RuntimeError(f"batch audit adjudication hash mismatch: {batch_meta['batch_id']}")
    return decisions, audit


def collect() -> dict[str, Any]:
    index = load_index()
    existing_rows = read_jsonl(CHECKPOINT)
    existing = {(row["record_id"], row["question_id"]): row for row in existing_rows}
    if len(existing) != len(existing_rows):
        raise RuntimeError("duplicate keys already present in append-only checkpoint")
    pending_batches: list[tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]] = []
    for batch_meta in index["batches"]:
        decision_path = DECISION_DIR / f"{batch_meta['batch_id']}.jsonl"
        if not decision_path.exists():
            continue
        decisions, audit = validate_batch_decisions(batch_meta)
        keys = {(row["record_id"], row["question_id"]) for row in decisions}
        if keys and keys.issubset(existing):
            for decision in decisions:
                key = (decision["record_id"], decision["question_id"])
                prior = existing[key]
                for field in ("decision", "reason_codes", "confidence", "evidence_basis", "status"):
                    if prior[field] != decision[field]:
                        raise RuntimeError(f"checkpoint conflict for {key} field={field}")
            continue
        if keys & set(existing):
            raise RuntimeError(f"partially collected batch cannot be resumed safely: {batch_meta['batch_id']}")
        pending_batches.append((batch_meta, decisions, audit))
    appended = 0
    collected_at = now()
    CHECKPOINT.parent.mkdir(parents=True, exist_ok=True)
    with CHECKPOINT.open("a", encoding="utf-8", newline="\n") as checkpoint_handle, BATCH_RUNS.open(
        "a", encoding="utf-8", newline="\n"
    ) as runs_handle:
        for batch_meta, decisions, audit in pending_batches:
            for decision in decisions:
                row = {
                    "record_id": decision["record_id"], "question_id": decision["question_id"],
                    "decision": decision["decision"], "reason_codes": decision["reason_codes"],
                    "confidence": decision["confidence"], "evidence_basis": decision["evidence_basis"],
                    "status": decision["status"], "batch_id": batch_meta["batch_id"],
                    "assigned_agent": batch_meta["assigned_agent"], "screened_at": audit["completed_at"],
                }
                checkpoint_handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
                existing[(row["record_id"], row["question_id"])] = row
                appended += 1
            runs_handle.write(json.dumps({
                "batch_id": batch_meta["batch_id"], "question_id": batch_meta["question_id"],
                "assigned_agent": batch_meta["assigned_agent"], "assigned_at": batch_meta["assigned_at"],
                "started_at": audit["started_at"], "completed_at": audit["completed_at"],
                "collected_at": collected_at, "row_count": batch_meta["row_count"],
                "input_sha256": batch_meta["input_sha256"],
                "decisions_sha256": audit["decisions_sha256"],
                "worker_sha256": audit["worker_sha256"], "review_mode": audit["review_mode"],
                "semantic_adjudications_sha256": audit.get("semantic_adjudications_sha256"),
            }, ensure_ascii=False, sort_keys=True) + "\n")
    return {"appended": appended, "classified": len(existing), "total": index["total_rows"], "batches_collected": len(pending_batches)}


def verify(require_complete: bool = False) -> dict[str, Any]:
    index = load_index()
    corpus_rows = load_corpus()
    expected = {(row["record_id"], row["question_id"]): row for row in corpus_rows}
    checkpoint_rows = read_jsonl(CHECKPOINT)
    seen: dict[tuple[str, str], dict[str, Any]] = {}
    errors: list[str] = []
    for row in checkpoint_rows:
        key = (row.get("record_id"), row.get("question_id"))
        if key in seen:
            errors.append(f"duplicate checkpoint key {key}")
            continue
        if key not in expected:
            errors.append(f"foreign checkpoint key {key}")
            continue
        seen[key] = row
        errors.extend(f"{key}: {error}" for error in validate_decision(row, expected[key]))
    missing = set(expected) - set(seen)
    coverage = len(seen) / len(expected) if expected else 1.0
    if require_complete and missing:
        errors.append(f"missing keys={len(missing)}")
    result = {
        "verified": not errors, "verified_at": now(), "expected": len(expected),
        "checkpoint_rows": len(checkpoint_rows), "unique_classified": len(seen),
        "missing": len(missing), "coverage": coverage, "errors": errors[:50],
        "prompt_sha256": index["prompt_sha256"], "corpus_sha256": index["corpus_sha256"],
    }
    if errors:
        raise RuntimeError(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def status() -> dict[str, Any]:
    index = load_index()
    checkpoint_rows = read_jsonl(CHECKPOINT)
    classified = len({(row["record_id"], row["question_id"]) for row in checkpoint_rows})
    completed_files = 0
    pending_by_agent = Counter()
    completed_by_agent = Counter()
    for batch in index["batches"]:
        path = DECISION_DIR / f"{batch['batch_id']}.jsonl"
        if path.exists():
            try:
                validate_batch_decisions(batch)
                completed_files += 1
                completed_by_agent[batch["assigned_agent"]] += batch["row_count"]
            except RuntimeError:
                pending_by_agent[batch["assigned_agent"]] += batch["row_count"]
        else:
            pending_by_agent[batch["assigned_agent"]] += batch["row_count"]
    return {
        "batches_total": len(index["batches"]), "valid_decision_batches": completed_files,
        "checkpoint_rows": len(checkpoint_rows), "classified": classified,
        "total_rows": index["total_rows"], "coverage": classified / index["total_rows"],
        "completed_rows_by_agent": dict(sorted(completed_by_agent.items())),
        "pending_rows_by_agent": dict(sorted(pending_by_agent.items())),
    }


def finalize() -> dict[str, Any]:
    verification = verify(require_complete=True)
    index = load_index()
    if (
        not ADJUDICATIONS.exists()
        or not SEMANTIC_RULE_AUDIT.exists()
        or not SEMANTIC_ADJUDICATION_CHECK.exists()
        or not INVARIANT_CHECKS.exists()
    ):
        raise RuntimeError("required semantic screening evidence is missing")
    adjudications = json.loads(ADJUDICATIONS.read_text(encoding="utf-8"))
    semantic_rule_audit = json.loads(SEMANTIC_RULE_AUDIT.read_text(encoding="utf-8"))
    semantic_adjudication_check = json.loads(
        SEMANTIC_ADJUDICATION_CHECK.read_text(encoding="utf-8")
    )
    invariant_checks = json.loads(INVARIANT_CHECKS.read_text(encoding="utf-8"))
    if semantic_rule_audit.get("mode") != "raw_rule_audit" or semantic_rule_audit.get("adjudications_applied"):
        raise RuntimeError("raw semantic rule audit mode mismatch")
    if (
        not semantic_adjudication_check.get("all_passed")
        or semantic_adjudication_check.get("failed_case_count") != 0
        or semantic_adjudication_check.get("mode") != "adjudication_consistency"
        or not semantic_adjudication_check.get("adjudications_applied")
    ):
        raise RuntimeError("semantic adjudication consistency has failures")
    if not invariant_checks.get("all_passed") or invariant_checks.get("failed_case_count") != 0:
        raise RuntimeError("screening invariant checks have failures")
    worker_sha = sha256_file(WORKER)
    if (
        semantic_rule_audit.get("worker_sha256") != worker_sha
        or semantic_adjudication_check.get("worker_sha256") != worker_sha
        or invariant_checks.get("worker_sha256") != worker_sha
    ):
        raise RuntimeError("semantic report worker hash mismatch")
    if (
        semantic_rule_audit.get("prompt_sha256") != index["prompt_sha256"]
        or semantic_adjudication_check.get("prompt_sha256") != index["prompt_sha256"]
    ):
        raise RuntimeError("semantic report prompt hash mismatch")
    if (
        semantic_rule_audit.get("corpus_sha256") != index["corpus_sha256"]
        or semantic_adjudication_check.get("corpus_sha256") != index["corpus_sha256"]
    ):
        raise RuntimeError("semantic report corpus hash mismatch")
    if adjudications.get("prompt_sha256") != index["prompt_sha256"] or adjudications.get("corpus_sha256") != index["corpus_sha256"]:
        raise RuntimeError("semantic adjudication lineage mismatch")
    checkpoint_rows = read_jsonl(CHECKPOINT)
    expected_keys = {(row["record_id"], row["question_id"]) for row in load_corpus()}
    checkpoint_keys = [(row["record_id"], row["question_id"]) for row in checkpoint_rows]
    if len(checkpoint_keys) != len(set(checkpoint_keys)) or set(checkpoint_keys) != expected_keys:
        raise RuntimeError("checkpoint key set is not exactly the corpus key set")
    checkpoint_rows.sort(key=lambda row: (QUESTION_ORDER.index(row["question_id"]), row["record_id"]))
    with OUT_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow([
            "record_id", "question_id", "decision", "reason_codes", "confidence",
            "evidence_basis", "status", "batch_id", "assigned_agent", "screened_at",
        ])
        for row in checkpoint_rows:
            writer.writerow([
                row["record_id"], row["question_id"], row["decision"],
                "|".join(row["reason_codes"]), row["confidence"], row["evidence_basis"],
                row["status"], row["batch_id"], row["assigned_agent"], row["screened_at"],
            ])
    distribution = Counter(row["decision"] for row in checkpoint_rows)
    by_question: dict[str, Counter[str]] = defaultdict(Counter)
    by_basis: dict[str, Counter[str]] = defaultdict(Counter)
    confidence = Counter(row["confidence"] for row in checkpoint_rows)
    reason_counts = Counter()
    by_agent = Counter()
    for row in checkpoint_rows:
        by_question[row["question_id"]][row["decision"]] += 1
        by_basis[row["evidence_basis"]][row["decision"]] += 1
        reason_counts.update(row["reason_codes"])
        by_agent[row["assigned_agent"]] += 1
    runs = read_jsonl(BATCH_RUNS)
    if len(runs) != len(index["batches"]):
        raise RuntimeError(f"batch run audit count mismatch: {len(runs)} != {len(index['batches'])}")
    manifest = {
        "schema_version": "1.0.0", "track": "v4.0_mecir_search_redesign",
        "generated_at": now(), "screener": "Codex subagents",
        "execution_mode": "multi_agent_direct_with_deterministic_text_assist",
        "subagent_count": len(index["agents"]), "subagents": index["agents"],
        "external_screening_api_calls": 0, "human_decisions": 0,
        "prompt_path": repo_relative(PROMPT), "prompt_sha256": sha256_file(PROMPT),
        "worker_path": repo_relative(WORKER), "worker_version": semantic_rule_audit["worker_version"],
        "worker_sha256": worker_sha,
        "semantic_adjudications_path": repo_relative(ADJUDICATIONS),
        "semantic_adjudications_sha256": sha256_file(ADJUDICATIONS),
        "semantic_adjudicated_records": adjudications["record_count"],
        "semantic_rule_audit_path": repo_relative(SEMANTIC_RULE_AUDIT),
        "semantic_rule_audit_sha256": sha256_file(SEMANTIC_RULE_AUDIT),
        "semantic_rule_audit_cases": semantic_rule_audit["case_count"],
        "semantic_rule_audit_matches": semantic_rule_audit["passed_case_count"],
        "semantic_rule_audit_mismatches": semantic_rule_audit["failed_case_count"],
        "semantic_adjudication_consistency_path": repo_relative(SEMANTIC_ADJUDICATION_CHECK),
        "semantic_adjudication_consistency_sha256": sha256_file(SEMANTIC_ADJUDICATION_CHECK),
        "semantic_adjudication_consistency_cases": semantic_adjudication_check["case_count"],
        "semantic_adjudication_consistency_matches": semantic_adjudication_check["passed_case_count"],
        "invariant_checks_path": repo_relative(INVARIANT_CHECKS),
        "invariant_checks_sha256": sha256_file(INVARIANT_CHECKS),
        "invariant_check_cases": invariant_checks["case_count"],
        "invariant_checks_passed": invariant_checks["passed_case_count"],
        "semantic_audit_case_files": [
            {
                "path": repo_relative(path),
                "sha256": sha256_file(path),
                "case_count": len(json.loads(path.read_text(encoding="utf-8"))),
            }
            for path in sorted(SEMANTIC_AUDIT_CASE_DIR.glob("*.json"))
        ],
        "input_path": repo_relative(CORPUS), "input_sha256": sha256_file(CORPUS),
        "batch_index_path": repo_relative(INDEX), "batch_index_sha256": sha256_file(INDEX),
        "checkpoint_path": repo_relative(CHECKPOINT), "checkpoint_sha256": sha256_file(CHECKPOINT),
        "batch_runs_path": repo_relative(BATCH_RUNS), "batch_runs_sha256": sha256_file(BATCH_RUNS),
        "output_path": repo_relative(OUT_CSV), "output_sha256": sha256_file(OUT_CSV),
        "row_count": len(expected_keys), "classified": len(checkpoint_rows),
        "coverage": verification["coverage"], "run_complete": True,
        "distribution": dict(sorted(distribution.items())),
        "distribution_by_question": {qid: dict(sorted(values.items())) for qid, values in sorted(by_question.items())},
        "by_evidence_basis": {
            basis: {"rows": sum(values.values()), "distribution": dict(sorted(values.items()))}
            for basis, values in sorted(by_basis.items())
        },
        "confidence_distribution": dict(sorted(confidence.items())),
        "reason_code_counts": dict(sorted(reason_counts.items())),
        "rows_by_agent": dict(sorted(by_agent.items())),
        "batches": runs,
    }
    write_json(MANIFEST, manifest)
    return {
        "coverage": manifest["coverage"], "run_complete": manifest["run_complete"],
        "distribution": manifest["distribution"], "output_sha256": manifest["output_sha256"],
        "checkpoint_sha256": manifest["checkpoint_sha256"], "batches": len(runs),
    }


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else "status"
    functions = {
        "build": build, "collect": collect, "verify": verify,
        "status": status, "finalize": finalize,
    }
    if command not in functions:
        raise SystemExit(f"unknown command: {command}")
    print(json.dumps(functions[command](), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
