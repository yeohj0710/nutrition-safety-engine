from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import random
import re
from collections import Counter
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path
from typing import Any, Iterable

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
CORPUS_PATH = ROOT / "data" / "curated_v3" / "evidence_map.csv"
SCREENING_PATH = ROOT / "data" / "curated_v3" / "llm_screening_classifications.csv"
PICOS_PATH = ROOT / "research" / "searches_v3" / "ai_picos" / "picos_definition.json"
SCREENING_MANIFEST_PATH = ROOT / "research" / "screening" / "v3" / "manifest.json"
OUT_ROOT = ROOT / "research" / "validation" / "screening_ai_reference_v3"
PROMPT_PATH = OUT_ROOT / "reference_prompt.txt"
BLIND_PATH = OUT_ROOT / "sample_blind.csv"
KEY_PATH = OUT_ROOT / "sample_key.csv"
SAMPLE_MANIFEST_PATH = OUT_ROOT / "sample_manifest.json"
SCORES_PATH = OUT_ROOT / "ai_reference_scores.csv"
SCORING_MANIFEST_PATH = OUT_ROOT / "scoring_manifest.json"
SYNTHESIS_PATH = ROOT / "research" / "synthesis" / "screener_vs_ai_reference_v3.json"
MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"
MODEL_CACHE_NAME = "models--Qwen--Qwen2.5-3B-Instruct"
SAMPLE_SEED = 20260727
ROUND_ORDER_SEEDS = {1: 202607271, 2: 202607272, 3: 202607273}
ROUND_GENERATION_SEEDS = {1: 202607281, 2: 202607282, 3: 202607283}
STRATUM_SAMPLE_SIZE = 100
LOGICAL_BATCH_SIZE = 50
MICRO_BATCH_SIZE = 16
MAX_INPUT_TOKENS = 3072
MAX_ABSTRACT_CHARS = 6000
MAX_NEW_TOKENS = 96
BOOTSTRAP_REPS = 10_000
ELEMENTS = ("population", "exposure", "comparator", "outcome", "design")
ELEMENT_VALUES = {"yes", "no", "uncertain"}
REFERENCE_LABELS = {"retain", "deprioritize", "uncertain"}


def find_local_model() -> Path:
    explicit = os.getenv("V30_SCREENING_MODEL_PATH", "").strip()
    if explicit:
        path = Path(explicit)
        if not path.is_dir():
            raise FileNotFoundError(f"V30_SCREENING_MODEL_PATH not found: {path}")
        return path
    snapshots_root = (
        Path.home() / ".cache" / "huggingface" / "hub" / MODEL_CACHE_NAME / "snapshots"
    )
    snapshots = sorted(path for path in snapshots_root.glob("*") if path.is_dir())
    if not snapshots:
        raise FileNotFoundError(f"local model cache not found for {MODEL_ID}")
    return snapshots[-1]


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


def write_csv(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="raise")
        writer.writeheader()
        writer.writerows(rows)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def append_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(canonical_json(row) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def load_questions() -> dict[str, dict[str, str]]:
    with PICOS_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    return {question["question_id"]: question for question in payload["questions"]}


def effective_prompt_sha256() -> str:
    payload = PROMPT_PATH.read_text(encoding="utf-8") + "\n" + canonical_json(load_questions())
    return sha256_bytes(payload.encode("utf-8"))


def create_sample() -> dict[str, Any]:
    corpus = {
        (row["record_id"], row["question_id"]): row
        for row in read_csv(CORPUS_PATH)
    }
    screening_rows = read_csv(SCREENING_PATH)
    strata: dict[str, list[dict[str, str]]] = {label: [] for label in REFERENCE_LABELS}
    for screening in screening_rows:
        key = (screening["record_id"], screening["question_id"])
        if key not in corpus:
            raise RuntimeError(f"screening key absent from corpus: {key}")
        label = screening["llm_decision"]
        if label not in strata:
            raise RuntimeError(f"unknown P2 stratum: {label}")
        strata[label].append({**corpus[key], "p2_decision": label})
    rng = random.Random(SAMPLE_SEED)
    selected: list[dict[str, str]] = []
    stratum_metadata: list[dict[str, Any]] = []
    for label in sorted(strata):
        frame = sorted(strata[label], key=lambda row: (row["question_id"], row["record_id"]))
        if len(frame) < STRATUM_SAMPLE_SIZE:
            raise RuntimeError(f"stratum {label} has only {len(frame)} rows")
        chosen = rng.sample(frame, STRATUM_SAMPLE_SIZE)
        selected.extend(chosen)
        stratum_metadata.append({
            "stratum": label,
            "frame_size": len(frame),
            "sample_size": STRATUM_SAMPLE_SIZE,
            "weight": len(frame) / STRATUM_SAMPLE_SIZE,
            "sampling_fraction": STRATUM_SAMPLE_SIZE / len(frame),
        })
    rng.shuffle(selected)
    questions = load_questions()
    blind_rows: list[dict[str, Any]] = []
    key_rows: list[dict[str, Any]] = []
    metadata_by_label = {row["stratum"]: row for row in stratum_metadata}
    for index, row in enumerate(selected, start=1):
        sample_id = f"v3ref-{index:04d}"
        question = questions[row["question_id"]]
        blind_rows.append({
            "sample_id": sample_id,
            "record_id": row["record_id"],
            "question_id": row["question_id"],
            "title": row["title"],
            "abstract": row["abstract"],
            "source": row["source"],
            "evidence_basis": "abstract" if row["abstract"].strip() else "title_only",
            "P": question["P"], "I": question["I"], "C": question["C"],
            "O": question["O"], "S": question["S"],
        })
        meta = metadata_by_label[row["p2_decision"]]
        key_rows.append({
            "sample_id": sample_id,
            "record_id": row["record_id"],
            "question_id": row["question_id"],
            "p2_decision": row["p2_decision"],
            "stratum": row["p2_decision"],
            "frame_size": meta["frame_size"],
            "sample_size": meta["sample_size"],
            "weight": meta["weight"],
        })
    blind_columns = [
        "sample_id", "record_id", "question_id", "title", "abstract", "source",
        "evidence_basis", "P", "I", "C", "O", "S",
    ]
    key_columns = [
        "sample_id", "record_id", "question_id", "p2_decision", "stratum",
        "frame_size", "sample_size", "weight",
    ]
    write_csv(BLIND_PATH, blind_rows, blind_columns)
    write_csv(KEY_PATH, key_rows, key_columns)
    if "p2_decision" in BLIND_PATH.read_text(encoding="utf-8").splitlines()[0]:
        raise RuntimeError("P2 decision leaked into blind sample")
    manifest = {
        "schema_version": "1.0.0",
        "track": "v3.0_full_ai_autonomy",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sampling_design": "stratified_random_equal_allocation",
        "seed": SAMPLE_SEED,
        "sample_size": len(blind_rows),
        "strata": stratum_metadata,
        "blind_path": BLIND_PATH.relative_to(ROOT).as_posix(),
        "blind_sha256": sha256_file(BLIND_PATH),
        "key_path": KEY_PATH.relative_to(ROOT).as_posix(),
        "key_sha256": sha256_file(KEY_PATH),
        "source_screening_path": SCREENING_PATH.relative_to(ROOT).as_posix(),
        "source_screening_sha256": sha256_file(SCREENING_PATH),
        "p2_labels_present_in_blind_file": False,
        "human_decisions": 0,
    }
    SAMPLE_MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def normalize_element(value: Any) -> str:
    normalized = str(value).strip().lower()
    mapping = {
        "y": "yes", "true": "yes", "present": "yes",
        "n": "no", "false": "no", "absent": "no",
        "unknown": "uncertain", "unclear": "uncertain", "not sure": "uncertain",
    }
    normalized = mapping.get(normalized, normalized)
    return normalized if normalized in ELEMENT_VALUES else "uncertain"


def parse_element_response(text: str) -> dict[str, str]:
    payload: dict[str, Any] = {}
    for candidate in reversed(re.findall(r"\{[^{}]*\}", text, flags=re.DOTALL)):
        repaired = re.sub(
            r'(:\s*)(yes|no|uncertain)(\s*[,}])',
            r'\1"\2"\3',
            candidate,
            flags=re.IGNORECASE,
        )
        try:
            parsed = json.loads(repaired)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            payload = parsed
            break
    if not payload:
        lowered = text.lower()
        for element in ELEMENTS:
            match = re.search(rf'{element}["\s]*[:=]\s*"?(yes|no|uncertain)', lowered)
            if match:
                payload[element] = match.group(1)
    if not payload:
        raise ValueError(f"unparseable element response: {text[:240]!r}")
    return {element: normalize_element(payload.get(element, "uncertain")) for element in ELEMENTS}


def aggregate_reference_label(elements: dict[str, str]) -> str:
    required = (elements["population"], elements["exposure"], elements["outcome"], elements["design"])
    if all(value == "yes" for value in required):
        return "retain"
    if any(value == "no" for value in required):
        return "deprioritize"
    return "uncertain"


def build_prompt(row: dict[str, str], round_id: int) -> str:
    abstract = row["abstract"].strip() or "[NO ABSTRACT AVAILABLE]"
    if len(abstract) > MAX_ABSTRACT_CHARS:
        abstract = abstract[:MAX_ABSTRACT_CHARS] + "\n[ABSTRACT TRUNCATED BY FIXED INPUT LIMIT]"
    round_focus = {
        1: "Read population and exposure first, then outcome and design.",
        2: "Read design and outcome first, then exposure and population.",
        3: "Assess every element independently before returning the JSON object.",
    }[round_id]
    return (
        PROMPT_PATH.read_text(encoding="utf-8").strip() + "\n"
        + round_focus + "\n\n"
        + f"P: {row['P']}\nI: {row['I']}\nC: {row['C']}\nO: {row['O']}\nS: {row['S']}\n"
        + f"TITLE: {row['title']}\nABSTRACT: {abstract}"
    )


def build_recovery_prompt(row: dict[str, str]) -> str:
    abstract = row["abstract"].strip()[:1500] or "[NO ABSTRACT AVAILABLE]"
    return (
        "Judge population, exposure, comparator, outcome, and design as yes, no, or uncertain. "
        "Return only one JSON object.\n"
        + f"P: {row['P']}\nI: {row['I']}\nC: {row['C']}\nO: {row['O']}\nS: {row['S']}\n"
        + f"TITLE: {row['title']}\nABSTRACT: {abstract}"
    )


def chunks(values: list[Any], size: int) -> Iterable[list[Any]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


class LocalQwenElementJudge:
    def __init__(self, micro_batch_size: int = MICRO_BATCH_SIZE) -> None:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.torch = torch
        self.model_path = find_local_model()
        self.micro_batch_size = micro_batch_size
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_path, local_files_only=True)
        self.tokenizer.padding_side = "left"
        if self.tokenizer.pad_token_id is None:
            self.tokenizer.pad_token_id = self.tokenizer.eos_token_id
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_path,
            local_files_only=True,
            dtype=torch.float16,
            attn_implementation="sdpa",
        ).to("cuda")
        self.model.eval()

    def _generate(self, prompts: list[str]) -> list[str]:
        rendered = [
            self.tokenizer.apply_chat_template(
                [{"role": "user", "content": prompt}],
                tokenize=False,
                add_generation_prompt=True,
            )
            for prompt in prompts
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
                do_sample=True,
                temperature=0.3,
                top_p=0.9,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
            )
        output_ids = generated[:, inputs["input_ids"].shape[1] :]
        return self.tokenizer.batch_decode(output_ids, skip_special_tokens=True)

    def judge(self, rows: list[dict[str, str]], round_id: int, generation_seed: int) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for micro_index, microbatch in enumerate(chunks(rows, self.micro_batch_size)):
            seed = generation_seed + micro_index
            self.torch.manual_seed(seed)
            self.torch.cuda.manual_seed_all(seed)
            texts = self._generate([build_prompt(row, round_id) for row in microbatch])
            for row, text in zip(microbatch, texts, strict=True):
                try:
                    elements = parse_element_response(text)
                except ValueError:
                    recovery = self._generate([build_recovery_prompt(row)])[0]
                    elements = parse_element_response(recovery)
                    text = recovery
                results.append({
                    "sample_id": row["sample_id"],
                    "record_id": row["record_id"],
                    "question_id": row["question_id"],
                    "round": round_id,
                    "elements": elements,
                    "reference_label": aggregate_reference_label(elements),
                    "model_response_sha256": sha256_bytes(text.encode("utf-8")),
                    "status": "ok",
                })
        return results


def load_round(round_id: int) -> dict[str, dict[str, Any]]:
    path = OUT_ROOT / f"round_{round_id}.jsonl"
    results: dict[str, dict[str, Any]] = {}
    if not path.exists():
        return results
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            row = json.loads(line)
            sample_id = row["sample_id"]
            if sample_id in results:
                raise RuntimeError(f"duplicate round {round_id} sample at line {line_number}: {sample_id}")
            results[sample_id] = row
    return results


def score_round(round_id: int, max_batches: int | None, micro_batch_size: int) -> None:
    if round_id not in ROUND_ORDER_SEEDS:
        raise ValueError("round must be 1, 2, or 3")
    blind = read_csv(BLIND_PATH)
    rng = random.Random(ROUND_ORDER_SEEDS[round_id])
    rng.shuffle(blind)
    checkpoint = load_round(round_id)
    pending = [row for row in blind if row["sample_id"] not in checkpoint]
    if not pending:
        print(f"round {round_id} already complete")
        return
    batches = list(chunks(pending, LOGICAL_BATCH_SIZE))
    if max_batches is not None:
        batches = batches[:max_batches]
    judge = LocalQwenElementJudge(micro_batch_size=micro_batch_size)
    completed_batches = len(checkpoint) // LOGICAL_BATCH_SIZE
    audit_path = OUT_ROOT / f"round_{round_id}_audit.jsonl"
    for offset, batch_rows in enumerate(batches, start=1):
        batch_number = completed_batches + offset
        batch_id = f"ai-ref-r{round_id}-{batch_number:03d}"
        input_projection = [
            {key: row[key] for key in ("sample_id", "record_id", "question_id", "title", "abstract")}
            for row in batch_rows
        ]
        input_sha = sha256_bytes(canonical_json(input_projection).encode("utf-8"))
        started_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        results = judge.judge(
            batch_rows,
            round_id,
            ROUND_GENERATION_SEEDS[round_id] + batch_number * 1000,
        )
        completed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        for result in results:
            result.update({
                "batch_id": batch_id,
                "batch_input_sha256": input_sha,
                "judged_at": completed_at,
            })
        output_sha = sha256_bytes(canonical_json(results).encode("utf-8"))
        append_jsonl(OUT_ROOT / f"round_{round_id}.jsonl", results)
        append_jsonl(audit_path, [{
            "batch_id": batch_id,
            "round": round_id,
            "row_count": len(results),
            "input_sha256": input_sha,
            "output_sha256": output_sha,
            "started_at": started_at,
            "completed_at": completed_at,
            "order_seed": ROUND_ORDER_SEEDS[round_id],
            "generation_seed": ROUND_GENERATION_SEEDS[round_id] + batch_number * 1000,
            "model": MODEL_ID,
            "model_revision": judge.model_path.name,
            "prompt_sha256": effective_prompt_sha256(),
        }])
        checkpoint.update({result["sample_id"]: result for result in results})
        print(canonical_json({"round": round_id, "completed": len(checkpoint), "total": len(blind)}))


def validate_rounds() -> dict[str, Any]:
    blind = read_csv(BLIND_PATH)
    blind_ids = {row["sample_id"] for row in blind}
    if len(blind_ids) != len(blind):
        raise RuntimeError("duplicate sample IDs in blind frame")
    status: dict[str, Any] = {}
    for round_id in (1, 2, 3):
        results = load_round(round_id)
        unexpected = set(results) - blind_ids
        if unexpected:
            raise RuntimeError(f"round {round_id} unexpected sample IDs: {sorted(unexpected)[:5]}")
        for sample_id, result in results.items():
            if result["reference_label"] not in REFERENCE_LABELS:
                raise RuntimeError(f"round {round_id} invalid label for {sample_id}")
            if set(result["elements"]) != set(ELEMENTS):
                raise RuntimeError(f"round {round_id} missing element for {sample_id}")
            if not set(result["elements"].values()) <= ELEMENT_VALUES:
                raise RuntimeError(f"round {round_id} invalid element value for {sample_id}")
        status[str(round_id)] = {
            "completed": len(results),
            "coverage": len(results) / len(blind),
            "distribution": dict(Counter(row["reference_label"] for row in results.values())),
        }
    return {"sample_size": len(blind), "rounds": status}


def majority_label(labels: list[str]) -> tuple[str | None, bool]:
    counts = Counter(labels)
    label, count = counts.most_common(1)[0]
    if count >= 2:
        return label, False
    return None, True


def weighted_metrics(rows: list[dict[str, Any]]) -> dict[str, float | None]:
    resolved = [row for row in rows if row["ai_reference_label"] is not None]
    exact_weight = sum(row["weight"] for row in resolved if row["p2_decision"] == row["ai_reference_label"])
    total_weight = sum(row["weight"] for row in resolved)
    positives = [row for row in resolved if row["ai_reference_label"] == "retain"]
    negatives = [row for row in resolved if row["ai_reference_label"] == "deprioritize"]
    tp = sum(row["weight"] for row in positives if row["p2_decision"] == "retain")
    fn = sum(row["weight"] for row in positives if row["p2_decision"] != "retain")
    tn = sum(row["weight"] for row in negatives if row["p2_decision"] != "retain")
    fp = sum(row["weight"] for row in negatives if row["p2_decision"] == "retain")
    sensitivity = tp / (tp + fn) if tp + fn else None
    specificity = tn / (tn + fp) if tn + fp else None
    return {
        "sensitivity_vs_ai_reference": sensitivity,
        "specificity_vs_ai_reference": specificity,
        "agreement_vs_ai_reference": exact_weight / total_weight if total_weight else None,
        "weighted_reference_positive_classifier_positive": tp,
        "weighted_reference_positive_classifier_nonpositive": fn,
        "weighted_reference_negative_classifier_nonpositive": tn,
        "weighted_reference_negative_classifier_positive": fp,
    }


def corrected_retain_count(
    apparent_prevalence: float,
    sensitivity: float | None,
    specificity: float | None,
    corpus_size: int,
) -> float | None:
    if sensitivity is None or specificity is None:
        return None
    denominator = sensitivity + specificity - 1.0
    if abs(denominator) < 1e-12:
        return None
    prevalence = (apparent_prevalence + specificity - 1.0) / denominator
    return min(1.0, max(0.0, prevalence)) * corpus_size


def percentile(values: list[float], q: float) -> float | None:
    return float(np.percentile(np.asarray(values, dtype=float), q)) if values else None


def bootstrap_corrected(rows: list[dict[str, Any]], corpus_size: int, apparent: float) -> dict[str, Any]:
    rng = np.random.default_rng(SAMPLE_SEED + 9000)
    by_stratum: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        by_stratum.setdefault(row["stratum"], []).append(row)
    corrected: list[float] = []
    sensitivities: list[float] = []
    specificities: list[float] = []
    for _ in range(BOOTSTRAP_REPS):
        replicate: list[dict[str, Any]] = []
        for stratum in sorted(by_stratum):
            frame = by_stratum[stratum]
            indices = rng.integers(0, len(frame), size=len(frame))
            replicate.extend(frame[int(index)] for index in indices)
        metrics = weighted_metrics(replicate)
        sensitivity = metrics["sensitivity_vs_ai_reference"]
        specificity = metrics["specificity_vs_ai_reference"]
        estimate = corrected_retain_count(apparent, sensitivity, specificity, corpus_size)
        if sensitivity is not None:
            sensitivities.append(float(sensitivity))
        if specificity is not None:
            specificities.append(float(specificity))
        if estimate is not None and math.isfinite(estimate):
            corrected.append(float(estimate))
    return {
        "method": "stratified_within_p2_decision_resampling",
        "requested_replicates": BOOTSTRAP_REPS,
        "valid_corrected_replicates": len(corrected),
        "corrected_retain_count_95pct_ci": [percentile(corrected, 2.5), percentile(corrected, 97.5)],
        "sensitivity_vs_ai_reference_95pct_ci": [
            percentile(sensitivities, 2.5), percentile(sensitivities, 97.5)
        ],
        "specificity_vs_ai_reference_95pct_ci": [
            percentile(specificities, 2.5), percentile(specificities, 97.5)
        ],
    }


def finalize() -> dict[str, Any]:
    validation = validate_rounds()
    if any(round_info["coverage"] != 1.0 for round_info in validation["rounds"].values()):
        raise RuntimeError(f"cannot finalize incomplete AI reference rounds: {validation}")
    blind = {row["sample_id"]: row for row in read_csv(BLIND_PATH)}
    key = {row["sample_id"]: row for row in read_csv(KEY_PATH)}
    rounds = {round_id: load_round(round_id) for round_id in (1, 2, 3)}
    score_rows: list[dict[str, Any]] = []
    eval_rows: list[dict[str, Any]] = []
    unresolved = 0
    for sample_id in sorted(blind):
        labels = [rounds[round_id][sample_id]["reference_label"] for round_id in (1, 2, 3)]
        majority, is_unresolved = majority_label(labels)
        unresolved += int(is_unresolved)
        row = {
            "sample_id": sample_id,
            "record_id": blind[sample_id]["record_id"],
            "question_id": blind[sample_id]["question_id"],
            "round_1_label": labels[0],
            "round_2_label": labels[1],
            "round_3_label": labels[2],
            "round_1_elements": canonical_json(rounds[1][sample_id]["elements"]),
            "round_2_elements": canonical_json(rounds[2][sample_id]["elements"]),
            "round_3_elements": canonical_json(rounds[3][sample_id]["elements"]),
            "ai_reference_label": majority or "unresolved",
            "unresolved": str(is_unresolved).lower(),
        }
        score_rows.append(row)
        eval_rows.append({
            "sample_id": sample_id,
            "record_id": row["record_id"],
            "question_id": row["question_id"],
            "title": blind[sample_id]["title"],
            "p2_decision": key[sample_id]["p2_decision"],
            "stratum": key[sample_id]["stratum"],
            "weight": float(key[sample_id]["weight"]),
            "ai_reference_label": majority,
        })
    score_columns = [
        "sample_id", "record_id", "question_id", "round_1_label", "round_2_label",
        "round_3_label", "round_1_elements", "round_2_elements", "round_3_elements",
        "ai_reference_label", "unresolved",
    ]
    write_csv(SCORES_PATH, score_rows, score_columns)
    pairwise: dict[str, float] = {}
    for left, right in combinations((1, 2, 3), 2):
        pairwise[f"round_{left}_vs_round_{right}"] = sum(
            rounds[left][sample_id]["reference_label"] == rounds[right][sample_id]["reference_label"]
            for sample_id in blind
        ) / len(blind)
    metrics = weighted_metrics(eval_rows)
    with SCREENING_MANIFEST_PATH.open(encoding="utf-8") as handle:
        screening_manifest = json.load(handle)
    corpus_size = int(screening_manifest["row_count"])
    apparent = screening_manifest["distribution"]["retain"] / corpus_size
    corrected = corrected_retain_count(
        apparent,
        metrics["sensitivity_vs_ai_reference"],
        metrics["specificity_vs_ai_reference"],
        corpus_size,
    )
    bootstrap = bootstrap_corrected(eval_rows, corpus_size, apparent)
    false_positive = [
        row for row in eval_rows
        if row["ai_reference_label"] == "deprioritize" and row["p2_decision"] == "retain"
    ][:20]
    false_negative = [
        row for row in eval_rows
        if row["ai_reference_label"] == "retain" and row["p2_decision"] != "retain"
    ][:20]
    synthesis = {
        "schema_version": "1.0.0",
        "track": "v3.0_full_ai_autonomy",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ai_reference_standard": {
            "sample_size": len(blind),
            "resolved": len(blind) - unresolved,
            "unresolved": unresolved,
            "human_decisions": 0,
            "model": MODEL_ID,
            "model_revision": find_local_model().name,
            "same_model_family_as_classifier": True,
            "independence_limitation": "분류기와 AI 참조표준이 같은 모델 계열이므로 독립성이 부분적이다.",
            "prompt_sha256": effective_prompt_sha256(),
            "round_order_seeds": ROUND_ORDER_SEEDS,
            "round_generation_seeds": ROUND_GENERATION_SEEDS,
            "round_distributions": validation["rounds"],
            "inter_round_agreement": {
                "pairwise": pairwise,
                "mean_pairwise": sum(pairwise.values()) / len(pairwise),
            },
        },
        "weighted_metrics": metrics,
        "rogan_gladen_correction": {
            "classifier_retain_apparent_prevalence": apparent,
            "corrected_retain_count_point": corrected,
            "corpus_size": corpus_size,
            **bootstrap,
        },
        "discordant_examples": {
            "classifier_positive_ai_reference_negative": false_positive,
            "classifier_nonpositive_ai_reference_positive": false_negative,
        },
        "limitations": [
            "AI 참조표준 대비 재현도를 측정하며 진실 대비 임상적 정확도를 측정하지 않는다.",
            "분류기와 참조표준은 같은 Qwen2.5 모델 계열을 사용해 독립성이 부분적이다.",
            "사람 판정은 0건이다.",
            "자료원은 PubMed 하나다."
        ],
    }
    SYNTHESIS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SYNTHESIS_PATH.write_text(
        json.dumps(synthesis, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    scoring_manifest = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": MODEL_ID,
        "model_revision": find_local_model().name,
        "prompt_path": PROMPT_PATH.relative_to(ROOT).as_posix(),
        "prompt_sha256": effective_prompt_sha256(),
        "blind_input_sha256": sha256_file(BLIND_PATH),
        "scores_path": SCORES_PATH.relative_to(ROOT).as_posix(),
        "scores_sha256": sha256_file(SCORES_PATH),
        "synthesis_path": SYNTHESIS_PATH.relative_to(ROOT).as_posix(),
        "synthesis_sha256": sha256_file(SYNTHESIS_PATH),
        "round_order_seeds": ROUND_ORDER_SEEDS,
        "round_generation_seeds": ROUND_GENERATION_SEEDS,
        "human_decisions": 0,
        "run_complete": True,
    }
    SCORING_MANIFEST_PATH.write_text(
        json.dumps(scoring_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return synthesis


def main() -> None:
    parser = argparse.ArgumentParser(description="Build and score the v3 AI reference standard")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("sample")
    score_parser = subparsers.add_parser("score")
    score_parser.add_argument("--round", type=int, required=True, choices=(1, 2, 3))
    score_parser.add_argument("--max-batches", type=int, default=None)
    score_parser.add_argument("--micro-batch-size", type=int, default=MICRO_BATCH_SIZE)
    subparsers.add_parser("validate")
    subparsers.add_parser("finalize")
    args = parser.parse_args()
    if args.command == "sample":
        print(json.dumps(create_sample(), ensure_ascii=False, indent=2))
    elif args.command == "score":
        score_round(args.round, args.max_batches, args.micro_batch_size)
    elif args.command == "validate":
        print(json.dumps(validate_rounds(), ensure_ascii=False, indent=2))
    else:
        result = finalize()
        print(json.dumps({
            "sample_size": result["ai_reference_standard"]["sample_size"],
            "unresolved": result["ai_reference_standard"]["unresolved"],
            "weighted_metrics": result["weighted_metrics"],
            "corrected_retain_count_point": result["rogan_gladen_correction"]["corrected_retain_count_point"],
        }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
