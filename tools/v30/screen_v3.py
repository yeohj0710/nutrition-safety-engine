from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[2]
CORPUS_PATH = ROOT / "data" / "curated_v3" / "evidence_map.csv"
PICOS_PATH = ROOT / "research" / "searches_v3" / "ai_picos" / "picos_definition.json"
SCREENING_ROOT = ROOT / "research" / "screening" / "v3"
PROMPT_PATH = SCREENING_ROOT / "decision_prompt.txt"
CHECKPOINT_PATH = SCREENING_ROOT / "screening_runs.jsonl"
BATCH_AUDIT_PATH = SCREENING_ROOT / "batch_audit.jsonl"
MANIFEST_PATH = SCREENING_ROOT / "manifest.json"
OUT_CSV = ROOT / "data" / "curated_v3" / "llm_screening_classifications.csv"
MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"
MODEL_CACHE_NAME = "models--Qwen--Qwen2.5-3B-Instruct"
LOGICAL_BATCH_SIZE = 100
MICRO_BATCH_SIZE = 8
MAX_INPUT_TOKENS = 3072
MAX_NEW_TOKENS = 80
MAX_ABSTRACT_CHARS = 6000
REASON_CODES = {
    "population", "exposure", "outcome", "human_signal", "design_signal",
    "animal_term_present", "off_topic", "insufficient_abstract",
}
DECISIONS = {"retain", "deprioritize", "uncertain"}
CONFIDENCES = {"high", "medium", "low"}
OUT_COLUMNS = [
    "record_id", "question_id", "llm_decision", "llm_reason_codes",
    "llm_confidence", "evidence_basis", "source", "execution_mode", "status",
]


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def effective_prompt_sha256() -> str:
    value = PROMPT_PATH.read_text(encoding="utf-8") + "\n" + canonical_json(load_questions())
    return sha256_bytes(value.encode("utf-8"))


def load_questions() -> dict[str, dict[str, str]]:
    with PICOS_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    return {question["question_id"]: question for question in payload["questions"]}


def load_corpus() -> list[dict[str, str]]:
    questions = load_questions()
    rows: list[dict[str, str]] = []
    with CORPUS_PATH.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["question_id"] not in questions:
                raise RuntimeError(f"unknown v3 question_id: {row['question_id']}")
            rows.append({
                "record_id": row["record_id"],
                "question_id": row["question_id"],
                "title": row["title"],
                "abstract": row["abstract"],
                "source": row["source"],
                "evidence_basis": "abstract" if row["abstract"].strip() else "title_only",
            })
    rows.sort(key=lambda row: (row["question_id"], row["record_id"]))
    keys = [(row["record_id"], row["question_id"]) for row in rows]
    if len(keys) != len(set(keys)):
        raise RuntimeError("duplicate keys in v3 screening frame")
    return rows


def load_checkpoint() -> dict[tuple[str, str], dict[str, Any]]:
    results: dict[tuple[str, str], dict[str, Any]] = {}
    if not CHECKPOINT_PATH.exists():
        return results
    with CHECKPOINT_PATH.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            result = json.loads(line)
            key = (result["record_id"], result["question_id"])
            if key in results:
                raise RuntimeError(f"duplicate screening checkpoint key at line {line_number}: {key}")
            results[key] = result
    return results


def find_local_model() -> Path:
    explicit = os.getenv("V30_SCREENING_MODEL_PATH", "").strip()
    if explicit:
        path = Path(explicit)
        if not path.is_dir():
            raise FileNotFoundError(f"V30_SCREENING_MODEL_PATH not found: {path}")
        return path
    hub = Path.home() / ".cache" / "huggingface" / "hub" / MODEL_CACHE_NAME / "snapshots"
    snapshots = sorted(path for path in hub.glob("*") if path.is_dir())
    if not snapshots:
        raise FileNotFoundError(f"local model cache not found for {MODEL_ID}")
    return snapshots[-1]


def build_prompt(row: dict[str, str], question: dict[str, str], *, strict: bool = False) -> str:
    system = PROMPT_PATH.read_text(encoding="utf-8").strip()
    suffix = "\nReturn only the JSON object. Do not use Markdown fences." if strict else ""
    abstract = row["abstract"].strip() or "[NO ABSTRACT AVAILABLE]"
    if len(abstract) > MAX_ABSTRACT_CHARS:
        abstract = abstract[:MAX_ABSTRACT_CHARS] + "\n[ABSTRACT TRUNCATED BY FIXED INPUT LIMIT]"
    return (
        f"{system}{suffix}\n\n"
        f"QUESTION_ID: {row['question_id']}\n"
        f"P: {question['P']}\nI: {question['I']}\nC: {question['C']}\n"
        f"O: {question['O']}\nS: {question['S']}\n"
        f"TITLE: {row['title']}\nABSTRACT: {abstract}"
    )


def build_recovery_prompt(row: dict[str, str], question: dict[str, str]) -> str:
    abstract = row["abstract"].strip()[:1500] or "[NO ABSTRACT AVAILABLE]"
    return (
        "Classify this exploratory PubMed record for the stated PICOS question. "
        "Return only JSON with decision (retain, deprioritize, or uncertain), "
        "reason_codes, and confidence (high, medium, or low).\n"
        f"P: {question['P']}\nI: {question['I']}\nO: {question['O']}\nS: {question['S']}\n"
        f"TITLE: {row['title']}\nABSTRACT: {abstract}\n"
        '{"decision":"uncertain","reason_codes":[],"confidence":"low"}'
    )


def normalize_reason_codes(value: Any) -> list[str]:
    if isinstance(value, str):
        candidates = re.split(r"[|,;\s]+", value)
    elif isinstance(value, list):
        candidates = [str(item) for item in value]
    else:
        candidates = []
    return sorted({candidate.strip() for candidate in candidates if candidate.strip() in REASON_CODES})


def parse_model_response(text: str) -> dict[str, Any]:
    candidates = re.findall(r"\{[^{}]*\}", text, flags=re.DOTALL)
    payload: dict[str, Any] | None = None
    for candidate in reversed(candidates):
        try:
            value = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict) and str(value.get("decision", "")).lower() in DECISIONS:
            payload = value
            break
    if payload is None:
        lowered = text.lower()
        decisions = [decision for decision in DECISIONS if re.search(rf"\b{decision}\b", lowered)]
        confidences = [value for value in CONFIDENCES if re.search(rf"\b{value}\b", lowered)]
        if len(decisions) != 1:
            raise ValueError(f"unparseable model response: {text[:240]!r}")
        payload = {
            "decision": decisions[0],
            "reason_codes": [code for code in REASON_CODES if code in lowered],
            "confidence": confidences[-1] if confidences else "low",
        }
    decision = str(payload.get("decision", "")).lower()
    confidence = str(payload.get("confidence", "low")).lower()
    if decision not in DECISIONS or confidence not in CONFIDENCES:
        raise ValueError(f"invalid model decision/confidence: {payload}")
    return {
        "decision": decision,
        "reason_codes": normalize_reason_codes(payload.get("reason_codes", [])),
        "confidence": confidence,
    }


class LocalQwenClassifier:
    def __init__(self, model_path: Path, micro_batch_size: int = MICRO_BATCH_SIZE) -> None:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        if not torch.cuda.is_available():
            raise RuntimeError("CUDA is required for the local v3 screening run")
        self.torch = torch
        self.micro_batch_size = micro_batch_size
        self.model_path = model_path
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
        self.tokenizer.padding_side = "left"
        if self.tokenizer.pad_token_id is None:
            self.tokenizer.pad_token_id = self.tokenizer.eos_token_id
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            local_files_only=True,
            dtype=torch.float16,
            attn_implementation="sdpa",
        ).to("cuda")
        self.model.generation_config.temperature = None
        self.model.generation_config.top_p = None
        self.model.generation_config.top_k = None
        self.model.eval()

    def _generate(self, prompts: list[str]) -> list[str]:
        conversations = [
            [{"role": "user", "content": prompt}]
            for prompt in prompts
        ]
        rendered = [
            self.tokenizer.apply_chat_template(chat, tokenize=False, add_generation_prompt=True)
            for chat in conversations
        ]
        inputs = self.tokenizer(
            rendered,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=MAX_INPUT_TOKENS,
        ).to("cuda")
        with self.torch.inference_mode():
            generated = self.model.generate(
                **inputs,
                max_new_tokens=MAX_NEW_TOKENS,
                do_sample=False,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
            )
        output_ids = generated[:, inputs["input_ids"].shape[1] :]
        return self.tokenizer.batch_decode(output_ids, skip_special_tokens=True)

    def classify(self, rows: list[dict[str, str]], questions: dict[str, dict[str, str]]) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for microbatch in chunks(rows, self.micro_batch_size):
            prompts = [build_prompt(row, questions[row["question_id"]]) for row in microbatch]
            texts = self._generate(prompts)
            for row, text in zip(microbatch, texts, strict=True):
                try:
                    parsed = parse_model_response(text)
                except ValueError:
                    retry = self._generate([
                        build_prompt(row, questions[row["question_id"]], strict=True)
                    ])[0]
                    try:
                        parsed = parse_model_response(retry)
                        text = retry
                    except ValueError:
                        recovery = self._generate([
                            build_recovery_prompt(row, questions[row["question_id"]])
                        ])[0]
                        parsed = parse_model_response(recovery)
                        text = recovery
                if row["evidence_basis"] == "title_only":
                    parsed["reason_codes"] = sorted(set(parsed["reason_codes"]) | {"insufficient_abstract"})
                    parsed["confidence"] = "low"
                else:
                    parsed["reason_codes"] = [
                        code for code in parsed["reason_codes"] if code != "insufficient_abstract"
                    ]
                results.append({
                    "record_id": row["record_id"],
                    "question_id": row["question_id"],
                    "decision": parsed["decision"],
                    "reason_codes": parsed["reason_codes"],
                    "confidence": parsed["confidence"],
                    "evidence_basis": row["evidence_basis"],
                    "source": row["source"],
                    "execution_mode": "agent_local",
                    "status": "ok",
                    "model_response_sha256": sha256_bytes(text.encode("utf-8")),
                })
        return results


def chunks(values: list[Any], size: int) -> Iterable[list[Any]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


def append_jsonl(path: Path, values: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        for value in values:
            handle.write(canonical_json(value) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def batch_input_sha256(rows: list[dict[str, str]]) -> str:
    projected = [
        {key: row[key] for key in ("record_id", "question_id", "title", "abstract")}
        for row in rows
    ]
    return sha256_bytes(canonical_json(projected).encode("utf-8"))


def verify_coverage(frame: list[dict[str, str]], results: dict[tuple[str, str], dict[str, Any]]) -> dict[str, Any]:
    requested = {(row["record_id"], row["question_id"]) for row in frame}
    returned = set(results)
    missing = sorted(requested - returned)
    unexpected = sorted(returned - requested)
    return {
        "requested": len(requested),
        "returned": len(returned & requested),
        "coverage": len(returned & requested) / len(requested) if requested else 1.0,
        "missing": missing,
        "unexpected": unexpected,
    }


def validate_checkpoint() -> dict[str, Any]:
    frame = load_corpus()
    results = load_checkpoint()
    coverage = verify_coverage(frame, results)
    if coverage["unexpected"]:
        raise RuntimeError(f"unexpected screening keys: {coverage['unexpected'][:5]}")
    expected_prefix = {
        (row["record_id"], row["question_id"])
        for row in frame[: len(results)]
    }
    if set(results) != expected_prefix:
        raise RuntimeError("checkpoint keys are not the deterministic frame prefix")
    for key, result in results.items():
        if result["decision"] not in DECISIONS:
            raise RuntimeError(f"invalid decision for {key}: {result['decision']}")
        if result["confidence"] not in CONFIDENCES:
            raise RuntimeError(f"invalid confidence for {key}: {result['confidence']}")
        if not set(result["reason_codes"]) <= REASON_CODES:
            raise RuntimeError(f"invalid reason code for {key}: {result['reason_codes']}")
        if result["evidence_basis"] == "title_only":
            if result["confidence"] != "low" or "insufficient_abstract" not in result["reason_codes"]:
                raise RuntimeError(f"title-only constraint violation for {key}")
        elif "insufficient_abstract" in result["reason_codes"]:
            raise RuntimeError(f"abstract row has insufficient_abstract for {key}")
    audits: list[dict[str, Any]] = []
    if BATCH_AUDIT_PATH.exists():
        with BATCH_AUDIT_PATH.open(encoding="utf-8") as handle:
            audits = [json.loads(line) for line in handle if line.strip()]
    expected_batches = (len(results) + LOGICAL_BATCH_SIZE - 1) // LOGICAL_BATCH_SIZE
    if len(audits) != expected_batches:
        raise RuntimeError(f"batch audit count mismatch: {len(audits)} != {expected_batches}")
    ordered_results = [results[(row["record_id"], row["question_id"])] for row in frame[: len(results)]]
    for index, audit in enumerate(audits, start=1):
        batch_rows = frame[(index - 1) * LOGICAL_BATCH_SIZE : index * LOGICAL_BATCH_SIZE]
        batch_results = ordered_results[(index - 1) * LOGICAL_BATCH_SIZE : index * LOGICAL_BATCH_SIZE]
        batch_id = f"v3-screen-{index:05d}"
        if audit["batch_id"] != batch_id or audit["input_sha256"] != batch_input_sha256(batch_rows):
            raise RuntimeError(f"batch audit input mismatch: {batch_id}")
        if audit["output_sha256"] != sha256_bytes(canonical_json(batch_results).encode("utf-8")):
            raise RuntimeError(f"batch audit output mismatch: {batch_id}")
        if any(result["batch_id"] != batch_id for result in batch_results):
            raise RuntimeError(f"checkpoint batch_id mismatch: {batch_id}")
    return {
        "classified": len(results),
        "total": len(frame),
        "coverage": coverage["coverage"],
        "batches": len(audits),
        "checkpoint_sha256": sha256_file(CHECKPOINT_PATH) if CHECKPOINT_PATH.exists() else None,
        "distribution": dict(Counter(result["decision"] for result in results.values())),
    }


def run(max_batches: int | None, micro_batch_size: int) -> None:
    frame = load_corpus()
    checkpoint = load_checkpoint()
    pending = [row for row in frame if (row["record_id"], row["question_id"]) not in checkpoint]
    if not pending:
        print("v3 screening checkpoint already covers the full frame")
        return
    model_path = find_local_model()
    classifier = LocalQwenClassifier(model_path, micro_batch_size=micro_batch_size)
    questions = load_questions()
    completed_batches = len(checkpoint) // LOGICAL_BATCH_SIZE
    batches_to_run = list(chunks(pending, LOGICAL_BATCH_SIZE))
    if max_batches is not None:
        batches_to_run = batches_to_run[:max_batches]
    for offset, batch_rows in enumerate(batches_to_run, start=1):
        batch_number = completed_batches + offset
        batch_id = f"v3-screen-{batch_number:05d}"
        started_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        input_sha = batch_input_sha256(batch_rows)
        batch_results = classifier.classify(batch_rows, questions)
        completed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        for result in batch_results:
            result["batch_id"] = batch_id
            result["batch_input_sha256"] = input_sha
            result["classified_at"] = completed_at
        output_sha = sha256_bytes(canonical_json(batch_results).encode("utf-8"))
        append_jsonl(CHECKPOINT_PATH, batch_results)
        append_jsonl(BATCH_AUDIT_PATH, [{
            "batch_id": batch_id,
            "row_count": len(batch_rows),
            "input_sha256": input_sha,
            "output_sha256": output_sha,
            "started_at": started_at,
            "completed_at": completed_at,
            "model": MODEL_ID,
            "model_revision": model_path.name,
            "prompt_sha256": effective_prompt_sha256(),
        }])
        checkpoint.update({
            (result["record_id"], result["question_id"]): result
            for result in batch_results
        })
        if batch_number % 5 == 0 or len(checkpoint) == len(frame):
            coverage = verify_coverage(frame, checkpoint)
            if coverage["unexpected"]:
                raise RuntimeError(f"unexpected screening keys: {coverage['unexpected'][:5]}")
            print(canonical_json({
                "batch_id": batch_id,
                "completed": coverage["returned"],
                "total": coverage["requested"],
                "coverage": coverage["coverage"],
            }))


def finalize() -> dict[str, Any]:
    frame = load_corpus()
    results = load_checkpoint()
    coverage = verify_coverage(frame, results)
    if coverage["missing"] or coverage["unexpected"] or coverage["coverage"] != 1.0:
        raise RuntimeError(
            f"cannot finalize incomplete v3 screening: coverage={coverage['coverage']}, "
            f"missing={len(coverage['missing'])}, unexpected={len(coverage['unexpected'])}"
        )
    ordered = [results[(row["record_id"], row["question_id"])] for row in frame]
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUT_COLUMNS)
        writer.writeheader()
        for result in ordered:
            writer.writerow({
                "record_id": result["record_id"],
                "question_id": result["question_id"],
                "llm_decision": result["decision"],
                "llm_reason_codes": "|".join(result["reason_codes"]),
                "llm_confidence": result["confidence"],
                "evidence_basis": result["evidence_basis"],
                "source": result["source"],
                "execution_mode": result["execution_mode"],
                "status": result["status"],
            })
    audit_rows: list[dict[str, Any]] = []
    with BATCH_AUDIT_PATH.open(encoding="utf-8") as handle:
        audit_rows = [json.loads(line) for line in handle if line.strip()]
    distribution = Counter(result["decision"] for result in ordered)
    by_basis: dict[str, Counter[str]] = {}
    for basis in ("abstract", "title_only"):
        by_basis[basis] = Counter(
            result["decision"] for result in ordered if result["evidence_basis"] == basis
        )
    model_path = find_local_model()
    manifest = {
        "schema_version": "1.0.0",
        "track": "v3.0_full_ai_autonomy",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "execution_mode": "agent_local",
        "model": MODEL_ID,
        "model_revision": model_path.name,
        "model_source": "local_huggingface_cache",
        "api_key_used": False,
        "human_decisions": 0,
        "prompt_path": PROMPT_PATH.relative_to(ROOT).as_posix(),
        "prompt_sha256": effective_prompt_sha256(),
        "input_path": CORPUS_PATH.relative_to(ROOT).as_posix(),
        "input_sha256": sha256_file(CORPUS_PATH),
        "output_path": OUT_CSV.relative_to(ROOT).as_posix(),
        "output_sha256": sha256_file(OUT_CSV),
        "row_count": len(frame),
        "classified": len(ordered),
        "coverage": coverage["coverage"],
        "run_complete": True,
        "distribution": dict(distribution),
        "by_evidence_basis": {
            basis: {"rows": sum(counter.values()), "distribution": dict(counter)}
            for basis, counter in by_basis.items()
        },
        "batches": audit_rows,
        "checkpoint_path": CHECKPOINT_PATH.relative_to(ROOT).as_posix(),
        "checkpoint_sha256": sha256_file(CHECKPOINT_PATH),
        "note": "retain/deprioritize/uncertain은 탐색 문헌지도용 AI 판정이며 사람의 포함·제외 판정이 아니다.",
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def smoke(rows: int, micro_batch_size: int) -> None:
    frame = load_corpus()[:rows]
    questions = load_questions()
    classifier = LocalQwenClassifier(find_local_model(), micro_batch_size=micro_batch_size)
    results = classifier.classify(frame, questions)
    print(json.dumps(results, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Screen the full v3 PubMed corpus with a local LLM")
    subparsers = parser.add_subparsers(dest="command", required=True)
    run_parser = subparsers.add_parser("run")
    run_parser.add_argument("--max-batches", type=int, default=None)
    run_parser.add_argument("--micro-batch-size", type=int, default=MICRO_BATCH_SIZE)
    smoke_parser = subparsers.add_parser("smoke")
    smoke_parser.add_argument("--rows", type=int, default=3)
    smoke_parser.add_argument("--micro-batch-size", type=int, default=2)
    subparsers.add_parser("finalize")
    subparsers.add_parser("validate")
    args = parser.parse_args()
    if args.command == "run":
        run(args.max_batches, args.micro_batch_size)
    elif args.command == "smoke":
        smoke(args.rows, args.micro_batch_size)
    elif args.command == "finalize":
        manifest = finalize()
        print(json.dumps({
            "coverage": manifest["coverage"],
            "classified": manifest["classified"],
            "distribution": manifest["distribution"],
        }, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(validate_checkpoint(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
