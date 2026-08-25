from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tools.v30 import build_site_v3 as base


ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "data" / "curated_v4" / "evidence_map.csv"
CORPUS_MANIFEST = ROOT / "data" / "curated_v4" / "corpus_manifest.json"
SCREENING = ROOT / "data" / "curated_v4" / "agent_screening_classifications.csv"
SCREENING_DIR = ROOT / "research" / "screening" / "v40_agent"
SCREENING_MANIFEST = SCREENING_DIR / "manifest.json"
SCREENING_INDEX = SCREENING_DIR / "batch_index.json"
SCREENING_CHECKPOINT = SCREENING_DIR / "checkpoints.jsonl"
SCREENING_RUNS = SCREENING_DIR / "batch_runs.jsonl"
SCREENING_PROMPT = SCREENING_DIR / "prompts" / "screening_prompt.md"
SCREENING_INVARIANTS = SCREENING_DIR / "invariant_checks.json"
SCREENING_ADJUDICATIONS = SCREENING_DIR / "semantic_adjudications.json"
SCREENING_RULE_AUDIT = SCREENING_DIR / "semantic_rule_audit.json"
SCREENING_ADJUDICATION_CHECK = SCREENING_DIR / "semantic_adjudication_consistency.json"
SCREENING_AUDIT_CASE_DIR = SCREENING_DIR / "etc" / "semantic_audit_cases"
SCREENING_WORKER = ROOT / "tools" / "v40" / "agent_screen_worker.py"
SEARCH_ROOT = ROOT / "research" / "searches_v4"
OUT = ROOT / "research" / "systematic_review_v40"
REGEX = OUT / "regex_gate.csv"
PICOS = OUT / "picos_extraction.csv"
CORE = OUT / "core_evidence.csv"
TRANSLATIONS = OUT / "key_finding_translations_ko.json"
RULES = OUT / "personalized_rules.json"
MANIFEST = OUT / "manifest.json"
CORE_MANIFEST = OUT / "core_manifest.json"
PARTS = OUT / "etc" / "translation_parts"
VERIFICATION = OUT / "verification.json"
COMPAT_MANIFEST = OUT / "etc" / "manifest_v30_compat.json"
TRACK = "v4.0_mecir_search_redesign"
PROTOCOL = "protocol-v4.0-mecir-search"
NEUTRAL_RULE_OUTPUT = (
    "연구에서 관찰된 대상·노출·결과와 근거 문장을 연결해 표시합니다. "
    "이 출력은 임상 판단, 복용 시작·중단 또는 용량 변경을 지시하지 않습니다."
)
NEUTRAL_RULE_CHECKS = ["연구 대상", "관찰된 노출", "관찰된 결과", "근거 문장 위치"]
VERBATIM_SOURCE_FIELDS = frozenset({
    "title", "abstract", "authors", "venue", "publication_types", "doi", "url",
    "locator", "locator_text", "dose", "outcome", "key_finding", "population",
    "raw_source_path", "raw_source_sha256", "source_text",
})
FORBIDDEN_GENERATED_TERM = re.compile(
    r"(?<![A-Za-z0-9])(?:sensitivity|specificity|accuracy|gold_standard|validated|include|exclude)"
    r"(?![A-Za-z0-9])",
    re.IGNORECASE,
)
COMPATIBILITY_ALIASES: dict[str, tuple[str, str, str]] = {
    "A1": (
        "HRS5_ANTICOAGULATION", "비타민 K",
        r"\bvitamin\s*k(?:1|2)?\b|phylloquinone|menaquinone|phytonadione|menadione",
    ),
    "A2": ("HRS5_ANTICOAGULATION", "오메가-3", r"omega|fish oil|eicosapenta|docosahexa"),
    "B1": ("HRS2_KIDNEY_DISEASE", "칼슘", r"\bcalcium\b|calcitriol"),
    "B2": ("HRS2_KIDNEY_DISEASE", "비타민 D", r"vitamin\s*d|ergocalciferol|cholecalciferol"),
    "B3": ("HRS2_KIDNEY_DISEASE", "비타민 C", r"vitamin c|ascorb"),
}


def _ingredient_match(alias: str, text: str) -> bool:
    pattern = COMPATIBILITY_ALIASES[alias][2]
    candidate = text
    if alias == "A1":
        candidate = re.sub(
            r"\b(?:non[- ]?vitamin\s*k(?:\s+antagonist)?\s+oral\s+anticoagulants?"
            r"|vitamin\s*k\s+antagonists?)\b",
            " ",
            candidate,
            flags=re.IGNORECASE,
        )
    return bool(re.search(pattern, candidate, re.IGNORECASE))


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_json(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def repo_relative(path: Path) -> str:
    return path.resolve().relative_to(ROOT.resolve()).as_posix()


def is_within(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def _assert_v4_output_path(path: Path) -> None:
    if not is_within(path, OUT):
        raise RuntimeError(f"refusing non-v4 output path: {path}")


def _assert_v4_write_preflight() -> None:
    expected_out = ROOT / "research" / "systematic_review_v40"
    if OUT.resolve() != expected_out.resolve():
        raise RuntimeError(f"v4 output root mismatch: {OUT}")
    writable = {
        "OUT": OUT, "REGEX": REGEX, "PICOS": PICOS, "CORE": CORE,
        "TRANSLATIONS": TRANSLATIONS, "RULES": RULES, "MANIFEST": MANIFEST,
        "CORE_MANIFEST": CORE_MANIFEST, "PARTS": PARTS, "VERIFICATION": VERIFICATION,
        "COMPAT_MANIFEST": COMPAT_MANIFEST,
    }
    escaped = {name: str(path) for name, path in writable.items() if not is_within(path, OUT)}
    if escaped:
        raise RuntimeError(f"v4 write preflight failed: {escaped}")


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def write_csv(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    _assert_v4_output_path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, value: Any) -> None:
    _assert_v4_output_path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"invalid JSONL {repo_relative(path)}:{number}: {exc}") from exc
        if not isinstance(value, dict):
            raise RuntimeError(f"JSONL row is not an object: {repo_relative(path)}:{number}")
        rows.append(value)
    return rows


def _input_provenance_paths() -> dict[str, Path]:
    return {
        "corpus_manifest": CORPUS_MANIFEST,
        "screening_manifest": SCREENING_MANIFEST,
        "screening_batch_index": SCREENING_INDEX,
        "screening_checkpoint": SCREENING_CHECKPOINT,
        "screening_batch_runs": SCREENING_RUNS,
        "screening_prompt": SCREENING_PROMPT,
        "screening_worker": SCREENING_WORKER,
        "screening_invariant_checks": SCREENING_INVARIANTS,
        "screening_semantic_adjudications": SCREENING_ADJUDICATIONS,
        "screening_semantic_rule_audit": SCREENING_RULE_AUDIT,
        "screening_semantic_adjudication_consistency": SCREENING_ADJUDICATION_CHECK,
    }


def _require_phase_d_inputs() -> None:
    required = [CORPUS, SCREENING, *_input_provenance_paths().values()]
    missing = [repo_relative(path) for path in required if not path.is_file()]
    if missing:
        raise RuntimeError("Phase D input provenance is incomplete: " + ", ".join(missing))


def _input_provenance() -> dict[str, dict[str, str]]:
    _require_phase_d_inputs()
    return {
        name: {"path": repo_relative(path), "sha256": sha256(path)}
        for name, path in _input_provenance_paths().items()
    }


def _translation_part_manifest() -> list[dict[str, str]]:
    return [
        {"path": repo_relative(path), "sha256": sha256(path)}
        for path in sorted(PARTS.glob("*.json"))
    ]


def _source_field_is_verbatim(parent_path: str, key: str, source_mode: str) -> bool:
    if key not in VERBATIM_SOURCE_FIELDS:
        return False
    if source_mode == "bundle":
        return bool(re.fullmatch(r"\$\[\d+\]", parent_path))
    if source_mode == "translations":
        return key == "source_text" and bool(re.fullmatch(r"\$\.translations\[\d+\]", parent_path))
    if source_mode == "rules":
        return bool(re.search(r"\.(?:evidence|all_evidence)\[\d+\]$", parent_path))
    return False


def _generated_term_locations(value: Any, path: str = "$", source_mode: str = "none") -> list[str]:
    locations: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if FORBIDDEN_GENERATED_TERM.search(str(key)):
                child_path = f"{path}.<generated_field>"
                locations.append(f"{child_path}:name")
            if _source_field_is_verbatim(path, str(key), source_mode):
                continue
            locations.extend(_generated_term_locations(child, child_path, source_mode))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            locations.extend(_generated_term_locations(child, f"{path}[{index}]", source_mode))
    elif isinstance(value, str) and FORBIDDEN_GENERATED_TERM.search(value):
        locations.append(path)
    return locations


def _append_generated_term_errors(
    errors: list[str], name: str, value: Any, source_mode: str = "none",
) -> None:
    for location in _generated_term_locations(value, source_mode=source_mode):
        errors.append(f"generated terminology gate failed: {name}:{location}")


def _neutralize_rule_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for item in rows:
        item["medication"] = "not_assigned"
        item["checks"] = list(NEUTRAL_RULE_CHECKS)
        item["output"] = NEUTRAL_RULE_OUTPUT
        item["output_scope"] = "evidence_linking_only"
        item["clinical_recommendation"] = False
        item["decision_authority"] = "none"
        item["status"] = "ai_generated_evidence_linking_rule"
        if item.get("source_question_id") and item.get("personalization_axis") == "compatibility_alias":
            alias = item.get("question_id")
            if alias in COMPATIBILITY_ALIASES:
                item["ingredient"] = COMPATIBILITY_ALIASES[alias][1]
            marked = [
                {
                    **entry,
                    "ingredient_match": _ingredient_match(
                        str(alias), f"{entry.get('title', '')} {entry.get('key_finding', '')}",
                    ),
                }
                for entry in item.get("all_evidence", [])
            ]
            matched = [entry for entry in marked if entry["ingredient_match"]]
            item["all_evidence"] = matched
            item["evidence"] = matched[:3]
            item["ingredient_matched_count"] = len(matched)
            item["evidence_status"] = "direct_evidence" if matched else "no_direct_evidence"
            if not matched:
                item["status"] = "no_direct_evidence"
    return rows


def configure_base() -> None:
    _assert_v4_write_preflight()
    base.CORPUS_PATH = CORPUS
    base.SCREENING_PATH = SCREENING
    base.OUT = OUT
    base.REGEX_PATH = REGEX
    base.PICOS_OUT = PICOS
    base.CORE_OUT = CORE
    base.TRANSLATIONS_OUT = TRANSLATIONS
    base.RULES_OUT = RULES
    base.MANIFEST_OUT = MANIFEST
    base.CORE_MANIFEST_OUT = CORE_MANIFEST
    base.TRANSLATION_PARTS_DIR = PARTS
    base.TRANSLATION_AUTHOR = "Codex"
    expected = {
        "OUT": OUT, "REGEX_PATH": REGEX, "PICOS_OUT": PICOS, "CORE_OUT": CORE,
        "TRANSLATIONS_OUT": TRANSLATIONS, "RULES_OUT": RULES,
        "MANIFEST_OUT": MANIFEST, "CORE_MANIFEST_OUT": CORE_MANIFEST,
        "TRANSLATION_PARTS_DIR": PARTS,
    }
    discovered = {
        name for name, value in vars(base).items()
        if isinstance(value, Path)
        and (name == "OUT" or name.endswith("_OUT") or name in {"REGEX_PATH", "TRANSLATION_PARTS_DIR"})
    }
    unknown = sorted(discovered - set(expected))
    if unknown:
        raise RuntimeError(f"unmapped v3 writable path constants: {unknown}")
    for name, expected_path in expected.items():
        actual = Path(getattr(base, name))
        if actual.resolve() != expected_path.resolve() or not is_within(actual, OUT):
            raise RuntimeError(f"base writable path escaped v4: {name}={actual}")


def canonicalize(stage: str = "all") -> None:
    if stage not in {"build", "translation", "rules", "all"}:
        raise ValueError(f"unknown canonicalization stage: {stage}")

    if stage in {"build", "all"} and REGEX.exists():
        rows = read_csv(REGEX)
        if rows and "llm_decision" in rows[0]:
            for row in rows:
                row["agent_decision"] = row.pop("llm_decision")
            write_csv(
                REGEX,
                rows,
                ["question_id", "record_id", "regex_passed", "regex_signals", "agent_decision", "kept"],
            )

    if stage in {"build", "all"} and MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        manifest["track"] = TRACK
        manifest["protocol"] = PROTOCOL
        gate = manifest.pop("llm_gate", manifest.get("agent_gate", {}))
        if gate:
            gate["dropped_by_agent"] = gate.pop("dropped_by_llm", gate.get("dropped_by_agent", 0))
            manifest["agent_gate"] = gate
        manifest["limitations"] = [
            "Codex title/abstract screening and extraction; no human reference decisions",
            "PubMed title/abstract scope only; retained records are abstract_only or title_only",
            "No effect estimate is imputed; unobserved values remain not_observed",
        ]
        manifest["input_provenance"] = _input_provenance()
        manifest["output_hashes"] = {
            "regex_gate_sha256": sha256(REGEX),
            "evidence_bundle_sha256": sha256(PICOS),
            "core_evidence_sha256": sha256(CORE),
        }
        manifest["verbatim_source_fields"] = sorted(VERBATIM_SOURCE_FIELDS)
        write_json(MANIFEST, manifest)

    if stage in {"translation", "all"} and TRANSLATIONS.exists():
        payload = json.loads(TRANSLATIONS.read_text(encoding="utf-8"))
        payload["track"] = TRACK
        payload["author"] = "Codex"
        payload["source"] = "Codex-authored translation parts"
        payload["parts"] = _translation_part_manifest()
        payload["verbatim_source_fields"] = ["source_text"]
        for item in payload.get("translations", []):
            item["author"] = "Codex"
        write_json(TRANSLATIONS, payload)

    if stage in {"rules", "all"} and RULES.exists():
        rule_rows = json.loads(RULES.read_text(encoding="utf-8"))
        if not isinstance(rule_rows, list):
            raise RuntimeError("personalized rules must be a list")
        write_json(RULES, _neutralize_rule_rows(rule_rows))

    if stage in {"rules", "all"} and CORE_MANIFEST.exists():
        payload = json.loads(CORE_MANIFEST.read_text(encoding="utf-8"))
        payload["track"] = TRACK
        gate = payload.pop("llm_gate", payload.get("agent_gate", {}))
        if gate:
            gate["dropped_by_agent"] = gate.pop("dropped_by_llm", gate.get("dropped_by_agent", 0))
            payload["agent_gate"] = gate
        parts = _translation_part_manifest()
        payload["source_sha256"] = sha256(PICOS)
        payload["core_sha256"] = sha256(CORE)
        payload["translation_sha256"] = sha256(TRANSLATIONS)
        payload["rules_sha256"] = sha256(RULES)
        payload["translation_parts"] = parts
        payload["translation_parts_index_sha256"] = sha256_json(parts)
        payload["input_provenance"] = _input_provenance()
        payload["generator"] = {
            "path": repo_relative(Path(__file__)), "sha256": sha256(Path(__file__)),
            "base_path": repo_relative(Path(base.__file__)), "base_sha256": sha256(Path(base.__file__)),
        }
        payload["verbatim_source_fields"] = sorted(VERBATIM_SOURCE_FIELDS)
        write_json(CORE_MANIFEST, payload)


def build() -> dict[str, Any]:
    _require_phase_d_inputs()
    configure_base()
    base.build()
    canonicalize("build")
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def translate() -> dict[str, Any]:
    _require_phase_d_inputs()
    if not all(path.is_file() for path in (REGEX, PICOS, CORE, MANIFEST)):
        build()
    configure_base()
    base.translate()
    canonicalize("translation")
    return json.loads(TRANSLATIONS.read_text(encoding="utf-8"))


def rules() -> dict[str, Any]:
    _require_phase_d_inputs()
    if not all(path.is_file() for path in (REGEX, PICOS, CORE, MANIFEST, TRANSLATIONS)):
        translate()
    configure_base()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    compatibility_manifest = dict(manifest)
    compatibility_manifest["llm_gate"] = dict(compatibility_manifest.get("agent_gate", {}))
    write_json(COMPAT_MANIFEST, compatibility_manifest)
    original_manifest_out = base.MANIFEST_OUT
    try:
        base.MANIFEST_OUT = COMPAT_MANIFEST
        base.build_rules()
    finally:
        base.MANIFEST_OUT = original_manifest_out
        if COMPAT_MANIFEST.exists():
            COMPAT_MANIFEST.unlink()
    canonicalize("rules")
    return json.loads(CORE_MANIFEST.read_text(encoding="utf-8"))


def _row_key(row: dict[str, Any]) -> tuple[str, str]:
    return str(row.get("record_id", "")), str(row.get("question_id", ""))


def _duplicate_keys(rows: list[dict[str, Any]]) -> list[tuple[str, str]]:
    counts = Counter(_row_key(row) for row in rows)
    return sorted(key for key, count in counts.items() if count > 1)


def _expected_build_outputs(
    corpus_rows: list[dict[str, str]], screening: dict[tuple[str, str], dict[str, str]],
) -> tuple[list[dict[str, str]], list[dict[str, str]], list[dict[str, str]]]:
    regex_rows: list[dict[str, str]] = []
    picos_rows: list[dict[str, str]] = []
    for source in corpus_rows:
        key = _row_key(source)
        decision_row = screening.get(key)
        if decision_row is None:
            continue
        decision = decision_row.get("decision", "")
        passed, signals = base.regex_passes(source)
        regex_rows.append({
            "question_id": source["question_id"], "record_id": source["record_id"],
            "regex_passed": str(passed).lower(), "regex_signals": signals,
            "agent_decision": decision, "kept": str(passed and decision == "retain").lower(),
        })
        if not passed or decision != "retain":
            continue
        locator, key_finding = base.choose_key_finding(source)
        scope = "abstract_only" if source["abstract"].strip() else "title_only"
        text = f"{source['title']} {source['abstract']}"
        doses = list(dict.fromkeys(match.group(0) for match in base.DOSE_RE.finditer(text)))[:8]
        config = base.QUESTION_CONFIG[source["question_id"]]
        outcome_sentences = [
            sentence for sentence in base.split_sentences(source["abstract"])
            if re.search(config["outcome"], sentence, re.IGNORECASE)
        ][:3]
        population_sentences = [
            sentence for sentence in base.split_sentences(source["abstract"])
            if re.search(config["population"], sentence, re.IGNORECASE)
        ][:3]
        picos_rows.append({
            "question_id": source["question_id"], "record_id": source["record_id"],
            "source": source["source"], "provider_id": source["provider_id"],
            "title": source["title"], "abstract": source["abstract"], "authors": source["authors"],
            "year": source["year"], "venue": source["venue"],
            "publication_types": source["publication_types"], "doi": source["doi"],
            "url": source["source_url"], "screening_decision": decision,
            "regex_passed": "true", "source_scope": scope, "locator": locator,
            "locator_text": key_finding, "dose": " | ".join(doses),
            "outcome": " | ".join(outcome_sentences), "key_finding": key_finding,
            "population": " | ".join(population_sentences),
            "priority_score": str(base.priority_score(source, key_finding)),
            "raw_source_path": source["raw_source_path"],
            "raw_source_sha256": source["raw_source_sha256"],
            "extracted_effect_value": "", "extracted_effect_status": "not_observed",
            "status": "ai_screened_regex_confirmed",
        })
    regex_rows.sort(key=lambda row: (row["question_id"], row["record_id"]))
    picos_rows.sort(key=lambda row: (row["question_id"], row["record_id"]))
    core_rows: list[dict[str, str]] = []
    for question_id in base.QUESTION_CONFIG:
        candidates = [row for row in picos_rows if row["question_id"] == question_id]
        candidates.sort(key=lambda row: (-int(row["priority_score"]), -int(row["year"] or 0), row["record_id"]))
        core_rows.extend(candidates[:base.MAX_CORE_PER_QUESTION])
    core_rows.sort(key=lambda row: (row["question_id"], -int(row["priority_score"]), row["record_id"]))
    return regex_rows, picos_rows, core_rows


def _expected_rules(
    core_rows: list[dict[str, str]], translation_map: dict[tuple[str, str], dict[str, Any]],
) -> list[dict[str, Any]]:
    by_question: dict[str, list[dict[str, Any]]] = defaultdict(list)
    source_rows: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in core_rows:
        key = _row_key(row)
        translation = translation_map[key]["translation_ko"]
        by_question[row["question_id"]].append(base.evidence_object(row, translation))
        source_rows[row["question_id"]].append(row)
    rows: list[dict[str, Any]] = []
    for question_id, config in base.QUESTION_CONFIG.items():
        evidence = by_question[question_id]
        rows.append(base.rule_payload(question_id, f"{question_id}:base", config["label_ko"], evidence))
        counts = Counter(axis for row in source_rows[question_id] for axis in set(base.extract_observed_axes(row)))
        for axis, count in sorted(counts.items()):
            if count < 1:
                continue
            supported_ids = {
                row["record_id"] for row in source_rows[question_id] if axis in base.extract_observed_axes(row)
            }
            supported = [item for item in evidence if item["record_id"] in supported_ids]
            rows.append(base.rule_payload(
                question_id, f"{question_id}:{axis}", f"{config['label_ko']} — {axis}", supported, axis=axis,
            ))
    for alias, (question_id, _label, _pattern) in COMPATIBILITY_ALIASES.items():
        marked: list[dict[str, Any]] = []
        for item in by_question[question_id]:
            matched = _ingredient_match(alias, f"{item['title']} {item['key_finding']}")
            marked.append({**item, "ingredient_match": matched})
        ordered = [item for item in marked if item["ingredient_match"]] + [
            item for item in marked if not item["ingredient_match"]
        ]
        alias_rule = base.rule_payload(alias, f"compat:{alias}", _label, ordered, axis="compatibility_alias")
        alias_rule["condition"] = base.QUESTION_CONFIG[question_id]["label_ko"]
        alias_rule["source_question_id"] = question_id
        alias_rule["ingredient_matched_count"] = sum(1 for item in marked if item["ingredient_match"])
        rows.append(alias_rule)
    return _neutralize_rule_rows(rows)


def _parse_checksum(path: Path) -> dict[str, str]:
    entries: dict[str, str] = {}
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        parts = line.split(maxsplit=1)
        if len(parts) != 2 or not re.fullmatch(r"[0-9a-fA-F]{64}", parts[0]):
            raise RuntimeError(f"invalid checksum line: {repo_relative(path)}:{number}")
        name = parts[1].lstrip("* ").strip()
        if not name or Path(name).name != name or name in entries:
            raise RuntimeError(f"invalid checksum member: {repo_relative(path)}:{number}")
        entries[name] = parts[0].lower()
    return entries


def _validate_input_provenance(
    corpus_rows: list[dict[str, str]], screening_rows: list[dict[str, str]], errors: list[str],
) -> dict[str, str]:
    hashes = {name: sha256(path) for name, path in _input_provenance_paths().items()}
    corpus_map = {_row_key(row): row for row in corpus_rows}
    corpus_manifest = json.loads(CORPUS_MANIFEST.read_text(encoding="utf-8"))
    corpus_section = corpus_manifest.get("corpus", {})
    if corpus_manifest.get("track") != TRACK:
        errors.append("corpus manifest track mismatch")
    if corpus_section.get("path") != repo_relative(CORPUS):
        errors.append("corpus manifest path mismatch")
    if corpus_section.get("sha256") != sha256(CORPUS):
        errors.append("corpus manifest hash mismatch")
    if corpus_section.get("row_count") != len(corpus_rows):
        errors.append("corpus manifest row count mismatch")
    expected_question_distribution = dict(sorted(Counter(row["question_id"] for row in corpus_rows).items()))
    if corpus_section.get("row_distribution_by_question") != expected_question_distribution:
        errors.append("corpus manifest question distribution mismatch")

    index = json.loads(SCREENING_INDEX.read_text(encoding="utf-8"))
    screening_manifest = json.loads(SCREENING_MANIFEST.read_text(encoding="utf-8"))
    if index.get("track") != TRACK or screening_manifest.get("track") != TRACK:
        errors.append("screening provenance track mismatch")
    if index.get("corpus_sha256") != sha256(CORPUS) or index.get("total_rows") != len(corpus_rows):
        errors.append("screening batch index corpus mismatch")
    if index.get("prompt_sha256") != sha256(SCREENING_PROMPT):
        errors.append("screening batch index prompt mismatch")
    required_screening_hashes = {
        "input_sha256": sha256(CORPUS), "output_sha256": sha256(SCREENING),
        "batch_index_sha256": sha256(SCREENING_INDEX),
        "checkpoint_sha256": sha256(SCREENING_CHECKPOINT),
        "batch_runs_sha256": sha256(SCREENING_RUNS), "prompt_sha256": sha256(SCREENING_PROMPT),
    }
    for field, expected in required_screening_hashes.items():
        if screening_manifest.get(field) != expected:
            errors.append(f"screening manifest hash mismatch: {field}")
    if (
        screening_manifest.get("input_path") != repo_relative(CORPUS)
        or screening_manifest.get("output_path") != repo_relative(SCREENING)
        or screening_manifest.get("row_count") != len(corpus_rows)
        or screening_manifest.get("classified") != len(screening_rows)
        or screening_manifest.get("coverage") != 1.0
        or screening_manifest.get("run_complete") is not True
    ):
        errors.append("screening manifest completion mismatch")
    worker_sha = sha256(SCREENING_WORKER)
    adjudications = json.loads(SCREENING_ADJUDICATIONS.read_text(encoding="utf-8"))
    rule_audit = json.loads(SCREENING_RULE_AUDIT.read_text(encoding="utf-8"))
    adjudication_check = json.loads(SCREENING_ADJUDICATION_CHECK.read_text(encoding="utf-8"))
    invariant_checks = json.loads(SCREENING_INVARIANTS.read_text(encoding="utf-8"))
    semantic_hash_fields = {
        "worker_sha256": worker_sha,
        "semantic_adjudications_sha256": sha256(SCREENING_ADJUDICATIONS),
        "semantic_rule_audit_sha256": sha256(SCREENING_RULE_AUDIT),
        "semantic_adjudication_consistency_sha256": sha256(SCREENING_ADJUDICATION_CHECK),
        "invariant_checks_sha256": sha256(SCREENING_INVARIANTS),
    }
    for field, expected in semantic_hash_fields.items():
        if screening_manifest.get(field) != expected:
            errors.append(f"screening semantic lineage mismatch: {field}")
    if (
        screening_manifest.get("worker_path") != repo_relative(SCREENING_WORKER)
        or screening_manifest.get("semantic_adjudications_path") != repo_relative(SCREENING_ADJUDICATIONS)
        or screening_manifest.get("semantic_rule_audit_path") != repo_relative(SCREENING_RULE_AUDIT)
        or screening_manifest.get("semantic_adjudication_consistency_path") != repo_relative(SCREENING_ADJUDICATION_CHECK)
        or screening_manifest.get("invariant_checks_path") != repo_relative(SCREENING_INVARIANTS)
    ):
        errors.append("screening semantic provenance path mismatch")
    if (
        screening_manifest.get("worker_version") != rule_audit.get("worker_version")
        or adjudication_check.get("worker_version") != rule_audit.get("worker_version")
        or invariant_checks.get("worker_version") != rule_audit.get("worker_version")
        or screening_manifest.get("semantic_adjudicated_records") != adjudications.get("record_count")
        or screening_manifest.get("semantic_rule_audit_cases") != rule_audit.get("case_count")
        or screening_manifest.get("semantic_rule_audit_matches") != rule_audit.get("passed_case_count")
        or screening_manifest.get("semantic_rule_audit_mismatches") != rule_audit.get("failed_case_count")
        or screening_manifest.get("semantic_adjudication_consistency_cases") != adjudication_check.get("case_count")
        or screening_manifest.get("semantic_adjudication_consistency_matches") != adjudication_check.get("passed_case_count")
        or screening_manifest.get("invariant_check_cases") != invariant_checks.get("case_count")
        or screening_manifest.get("invariant_checks_passed") != invariant_checks.get("passed_case_count")
    ):
        errors.append("screening semantic report metadata mismatch")
    if (
        rule_audit.get("mode") != "raw_rule_audit"
        or rule_audit.get("adjudications_applied") is not False
        or adjudication_check.get("mode") != "adjudication_consistency"
        or adjudication_check.get("adjudications_applied") is not True
        or adjudication_check.get("all_passed") is not True
        or adjudication_check.get("failed_case_count") != 0
        or invariant_checks.get("all_passed") is not True
        or invariant_checks.get("failed_case_count") != 0
    ):
        errors.append("screening semantic checks are incomplete")
    for report in (rule_audit, adjudication_check, invariant_checks):
        if report.get("worker_sha256") != worker_sha:
            errors.append("screening semantic report worker hash mismatch")
    for report in (rule_audit, adjudication_check):
        if report.get("prompt_sha256") != sha256(SCREENING_PROMPT) or report.get("corpus_sha256") != sha256(CORPUS):
            errors.append("screening semantic report input hash mismatch")
    if adjudications.get("prompt_sha256") != sha256(SCREENING_PROMPT) or adjudications.get("corpus_sha256") != sha256(CORPUS):
        errors.append("screening semantic adjudication input hash mismatch")
    actual_case_files = [
        {
            "path": repo_relative(path), "sha256": sha256(path),
            "case_count": len(json.loads(path.read_text(encoding="utf-8"))),
        }
        for path in sorted(SCREENING_AUDIT_CASE_DIR.glob("*.json"))
    ]
    if screening_manifest.get("semantic_audit_case_files") != actual_case_files:
        errors.append("screening semantic audit case file lineage mismatch")

    checkpoint_rows = read_jsonl(SCREENING_CHECKPOINT)
    checkpoint_duplicates = _duplicate_keys(checkpoint_rows)
    if checkpoint_duplicates:
        errors.append(f"duplicate screening checkpoint keys: {len(checkpoint_duplicates)}")
    checkpoint_map = {_row_key(row): row for row in checkpoint_rows}
    screening_map = {_row_key(row): row for row in screening_rows}
    if set(checkpoint_map) != set(screening_map):
        errors.append("screening CSV keys differ from checkpoint keys")
    for key, row in screening_map.items():
        checkpoint = checkpoint_map.get(key)
        if checkpoint is None:
            continue
        expected = {
            "record_id": checkpoint.get("record_id", ""), "question_id": checkpoint.get("question_id", ""),
            "decision": checkpoint.get("decision", ""),
            "reason_codes": "|".join(checkpoint.get("reason_codes", [])),
            "confidence": checkpoint.get("confidence", ""),
            "evidence_basis": checkpoint.get("evidence_basis", ""), "status": checkpoint.get("status", ""),
            "batch_id": checkpoint.get("batch_id", ""), "assigned_agent": checkpoint.get("assigned_agent", ""),
            "screened_at": checkpoint.get("screened_at", ""),
        }
        if row != expected:
            errors.append(f"screening CSV row differs from checkpoint: {key}")

    runs = read_jsonl(SCREENING_RUNS)
    if screening_manifest.get("batches") != runs:
        errors.append("screening manifest batch audit differs from batch_runs")
    batch_meta_rows = index.get("batches", [])
    batch_ids = [str(item.get("batch_id", "")) for item in batch_meta_rows]
    run_ids = [str(item.get("batch_id", "")) for item in runs]
    if len(batch_ids) != len(set(batch_ids)) or len(run_ids) != len(set(run_ids)) or set(batch_ids) != set(run_ids):
        errors.append("screening batch identities mismatch")
    if index.get("batch_count") != len(batch_meta_rows) or len(runs) != len(batch_meta_rows):
        errors.append("screening batch count mismatch")
    meta_by_id = {str(item.get("batch_id", "")): item for item in batch_meta_rows}
    batch_partition_keys: set[tuple[str, str]] = set()
    decision_partition_keys: set[tuple[str, str]] = set()
    for run in runs:
        batch_id = str(run.get("batch_id", ""))
        meta = meta_by_id.get(batch_id)
        if meta is None:
            continue
        if (
            run.get("input_sha256") != meta.get("input_sha256")
            or run.get("row_count") != meta.get("row_count")
            or run.get("assigned_agent") != meta.get("assigned_agent")
            or run.get("question_id") != meta.get("question_id")
            or run.get("worker_sha256") != worker_sha
            or run.get("semantic_adjudications_sha256") != sha256(SCREENING_ADJUDICATIONS)
        ):
            errors.append(f"screening batch provenance mismatch: {batch_id}")
        batch_path = ROOT / str(meta.get("path", ""))
        decision_path = SCREENING_DIR / "decisions" / f"{batch_id}.jsonl"
        batch_rows: list[dict[str, Any]] = []
        if not is_within(batch_path, SCREENING_DIR / "batches") or not batch_path.is_file():
            errors.append(f"screening batch path mismatch: {batch_id}")
        elif sha256(batch_path) != meta.get("file_sha256"):
            errors.append(f"screening batch file hash mismatch: {batch_id}")
        else:
            batch = json.loads(batch_path.read_text(encoding="utf-8"))
            candidate_rows = batch.get("rows", [])
            if isinstance(candidate_rows, list) and all(isinstance(row, dict) for row in candidate_rows):
                batch_rows = candidate_rows
            else:
                errors.append(f"screening batch rows are not objects: {batch_id}")
            rows_sha = sha256_json(batch_rows)
            if (
                batch.get("batch_id") != batch_id
                or batch.get("question_id") != meta.get("question_id")
                or batch.get("assigned_agent") != meta.get("assigned_agent")
                or batch.get("row_count") != len(batch_rows)
                or batch.get("row_count") != meta.get("row_count")
                or batch.get("prompt_sha256") != sha256(SCREENING_PROMPT)
                or batch.get("input_sha256") != rows_sha
                or meta.get("input_sha256") != rows_sha
            ):
                errors.append(f"screening batch semantic hash mismatch: {batch_id}")
            for batch_row in batch_rows:
                key = _row_key(batch_row)
                if key in batch_partition_keys:
                    errors.append(f"screening batch partition duplicate: {key}")
                batch_partition_keys.add(key)
                source = corpus_map.get(key)
                expected_batch_row = None if source is None else {
                    "record_id": source["record_id"], "question_id": source["question_id"],
                    "title": source["title"], "abstract": source["abstract"],
                    "publication_types": source["publication_types"], "year": source["year"],
                    "venue": source["venue"],
                }
                if batch_row != expected_batch_row:
                    errors.append(f"screening batch row differs from corpus: {key}")
        if not decision_path.is_file() or sha256(decision_path) != run.get("decisions_sha256"):
            errors.append(f"screening decision file hash mismatch: {batch_id}")
            continue
        decisions = read_jsonl(decision_path)
        decision_keys = [_row_key(row) for row in decisions]
        batch_keys = [_row_key(row) for row in batch_rows]
        if len(decision_keys) != len(set(decision_keys)) or set(decision_keys) != set(batch_keys):
            errors.append(f"screening decision keys differ from batch: {batch_id}")
        for decision in decisions:
            key = _row_key(decision)
            if key in decision_partition_keys:
                errors.append(f"screening decision partition duplicate: {key}")
            decision_partition_keys.add(key)
            if set(decision) != {
                "record_id", "question_id", "decision", "reason_codes", "confidence", "evidence_basis", "status",
            }:
                errors.append(f"screening decision schema mismatch: {key}")
            expected_checkpoint = {
                "record_id": decision.get("record_id", ""), "question_id": decision.get("question_id", ""),
                "decision": decision.get("decision", ""), "reason_codes": decision.get("reason_codes", []),
                "confidence": decision.get("confidence", ""),
                "evidence_basis": decision.get("evidence_basis", ""), "status": decision.get("status", ""),
                "batch_id": batch_id, "assigned_agent": meta.get("assigned_agent", ""),
                "screened_at": run.get("completed_at", ""),
            }
            if checkpoint_map.get(key) != expected_checkpoint:
                errors.append(f"screening checkpoint differs from decision file: {key}")
    if batch_partition_keys != set(corpus_map):
        errors.append("screening batches do not exactly partition the corpus")
    if decision_partition_keys != set(corpus_map):
        errors.append("screening decisions do not exactly partition the corpus")

    search_runs = corpus_manifest.get("search", {}).get("question_runs", [])
    if len(search_runs) != len(base.QUESTION_CONFIG):
        errors.append("corpus search run count mismatch")
    run_questions = [str(run.get("question_id", "")) for run in search_runs]
    if len(run_questions) != len(set(run_questions)) or set(run_questions) != set(base.QUESTION_CONFIG):
        errors.append("corpus search run question mismatch")
    raw_hashes: dict[Path, str] = {}
    checksum_by_directory: dict[Path, dict[str, str]] = {}
    for run in search_runs:
        raw_dir = ROOT / str(run.get("raw_path", ""))
        checksum_path = ROOT / str(run.get("checksum_path", ""))
        if (
            not is_within(raw_dir, SEARCH_ROOT) or not is_within(checksum_path, SEARCH_ROOT)
            or checksum_path.parent.resolve() != raw_dir.resolve()
            or not checksum_path.is_file()
        ):
            errors.append(f"search run path mismatch: {run.get('question_id', '')}")
            continue
        if sha256(checksum_path) != run.get("checksum_sha256"):
            errors.append(f"search checksum file hash mismatch: {run.get('question_id', '')}")
        entries = _parse_checksum(checksum_path)
        declared_files = run.get("efetch_files", [])
        if len(declared_files) != len(set(declared_files)) or set(entries) != set(declared_files):
            errors.append(f"search checksum membership mismatch: {run.get('question_id', '')}")
        checksum_by_directory[raw_dir.resolve()] = entries
        for name, expected_hash in entries.items():
            path = raw_dir / name
            if not path.is_file():
                errors.append(f"missing raw search file: {repo_relative(path)}")
                continue
            actual_hash = sha256(path)
            raw_hashes[path.resolve()] = actual_hash
            if actual_hash != expected_hash:
                errors.append(f"raw search file hash mismatch: {repo_relative(path)}")
    for row in corpus_rows:
        raw_path = ROOT / row.get("raw_source_path", "")
        resolved = raw_path.resolve()
        entries = checksum_by_directory.get(resolved.parent)
        if not is_within(raw_path, SEARCH_ROOT) or entries is None:
            errors.append(f"corpus raw source escaped declared v4 runs: {_row_key(row)}")
            continue
        expected_hash = entries.get(raw_path.name)
        if expected_hash is None or row.get("raw_source_sha256") != expected_hash:
            errors.append(f"corpus raw source checksum mismatch: {_row_key(row)}")
        if raw_hashes.get(resolved) != row.get("raw_source_sha256"):
            errors.append(f"corpus raw source file mismatch: {_row_key(row)}")
    return hashes


def verify() -> dict[str, Any]:
    configure_base()
    required = [
        CORPUS, SCREENING, *_input_provenance_paths().values(),
        REGEX, PICOS, CORE, TRANSLATIONS, RULES, MANIFEST, CORE_MANIFEST,
    ]
    missing = [repo_relative(path) for path in required if not path.is_file()]
    errors: list[str] = []
    if missing:
        errors.append("missing outputs: " + ", ".join(missing))
        result = {
            "schema_version": "2.0.0", "checked_at": now(), "passed": False,
            "errors": errors, "missing": missing,
        }
        write_json(VERIFICATION, result)
        raise RuntimeError(json.dumps(result, ensure_ascii=False, indent=2))

    corpus_rows = read_csv(CORPUS)
    screening_rows = read_csv(SCREENING)
    regex_rows = read_csv(REGEX)
    picos_rows = read_csv(PICOS)
    core_rows = read_csv(CORE)
    for name, rows in (
        ("corpus", corpus_rows), ("screening", screening_rows), ("regex gate", regex_rows),
        ("evidence bundle", picos_rows), ("core evidence", core_rows),
    ):
        duplicates = _duplicate_keys(rows)
        if duplicates:
            errors.append(f"duplicate {name} keys: {len(duplicates)}")
    corpus = {_row_key(row): row for row in corpus_rows}
    screening = {_row_key(row): row for row in screening_rows}
    regex_map = {_row_key(row): row for row in regex_rows}
    picos_keys = {_row_key(row) for row in picos_rows}
    core_keys = {_row_key(row) for row in core_rows}
    if set(screening) != set(corpus):
        errors.append("screening keys differ from corpus keys")
    if set(regex_map) != set(corpus):
        errors.append("regex gate keys differ from corpus keys")
    invalid_decisions = sorted({row.get("decision", "") for row in screening_rows} - {"retain", "deprioritize", "uncertain"})
    if invalid_decisions:
        errors.append("screening decision vocabulary mismatch")
    corpus_questions = {row.get("question_id", "") for row in corpus_rows}
    if corpus_questions != set(base.QUESTION_CONFIG):
        errors.append("corpus question set mismatch")

    expected_regex: list[dict[str, str]] = []
    expected_picos: list[dict[str, str]] = []
    expected_core: list[dict[str, str]] = []
    if set(screening) == set(corpus) and corpus_questions == set(base.QUESTION_CONFIG) and not invalid_decisions:
        try:
            expected_regex, expected_picos, expected_core = _expected_build_outputs(corpus_rows, screening)
        except (KeyError, RuntimeError, ValueError) as exc:
            errors.append(f"could not reconstruct v4 build outputs: {type(exc).__name__}")
    if regex_rows != expected_regex:
        errors.append("regex gate rows differ from deterministic reconstruction")
    expected_gate_keys = {_row_key(row) for row in expected_picos}
    if picos_keys != expected_gate_keys or len(picos_rows) != len(expected_picos):
        errors.append("evidence bundle keys differ from the exact retain-and-regex gate")
    if picos_rows != expected_picos:
        errors.append("evidence bundle rows differ from deterministic reconstruction")
    expected_core_keys = [_row_key(row) for row in expected_core]
    actual_core_keys = [_row_key(row) for row in core_rows]
    if actual_core_keys != expected_core_keys or len(core_rows) != len(expected_core):
        errors.append("core evidence differs from the exact per-question ranked selection")
    if core_rows != expected_core:
        errors.append("core evidence rows differ from deterministic reconstruction")

    translation_payload = json.loads(TRANSLATIONS.read_text(encoding="utf-8"))
    if (
        translation_payload.get("track") != TRACK
        or translation_payload.get("translation_authorship") != "ai_generated"
        or translation_payload.get("author") != "Codex"
        or translation_payload.get("source") != "Codex-authored translation parts"
        or translation_payload.get("verbatim_source_fields") != ["source_text"]
    ):
        errors.append("translation collection provenance mismatch")
    translation_rows = translation_payload.get("translations", [])
    if not isinstance(translation_rows, list):
        translation_rows = []
        errors.append("translation collection is not a list")
    translation_duplicates = _duplicate_keys(translation_rows)
    if translation_duplicates:
        errors.append(f"duplicate translation keys: {len(translation_duplicates)}")
    translation_map = {_row_key(item): item for item in translation_rows}
    if set(translation_map) != core_keys:
        errors.append("translation keys differ from core evidence keys")
    if translation_payload.get("records") != len(translation_rows):
        errors.append("translation record count mismatch")
    part_manifest = _translation_part_manifest()
    if translation_payload.get("parts") != part_manifest:
        errors.append("translation part manifest mismatch")
    part_paths = sorted(PARTS.glob("*.json"))
    if len(part_paths) != len(base.QUESTION_CONFIG):
        errors.append("translation part file count mismatch")
    merged_parts: dict[str, str] = {}
    part_questions: list[str] = []
    for path in part_paths:
        if not is_within(path, PARTS):
            errors.append("translation part path escaped v4 output")
            continue
        part = json.loads(path.read_text(encoding="utf-8"))
        question_id = str(part.get("question_id", ""))
        part_questions.append(question_id)
        if (
            question_id not in base.QUESTION_CONFIG
            or part.get("translation_authorship") != "ai_generated"
            or part.get("author") != "Codex"
            or not isinstance(part.get("translations"), dict)
        ):
            errors.append(f"translation part provenance mismatch: {path.name}")
            continue
        for translation_id, candidate in part["translations"].items():
            if (
                not isinstance(translation_id, str) or not translation_id.startswith(f"{question_id}|")
                or translation_id in merged_parts or not isinstance(candidate, str) or not candidate.strip()
            ):
                errors.append(f"translation part entry mismatch: {path.name}")
                continue
            merged_parts[translation_id] = candidate.strip()
        _append_generated_term_errors(errors, f"translation_part:{path.name}", part)
    if len(part_questions) != len(set(part_questions)) or set(part_questions) != set(base.QUESTION_CONFIG):
        errors.append("translation part question set mismatch")
    expected_translation_ids = {f"{question_id}|{record_id}" for record_id, question_id in core_keys}
    if set(merged_parts) != expected_translation_ids:
        errors.append("translation part keys differ from core evidence keys")
    for row in core_rows:
        key = _row_key(row)
        item = translation_map.get(key)
        if item is None:
            continue
        translation_id = f"{row['question_id']}|{row['record_id']}"
        if (
            item.get("translation_id") != translation_id
            or item.get("source_text") != row["key_finding"]
            or item.get("source_sha256") != sha256_text(row["key_finding"])
            or item.get("translation_ko") != merged_parts.get(translation_id)
            or item.get("translation_authorship") != "ai_generated"
            or item.get("author") != "Codex"
        ):
            errors.append(f"translation provenance mismatch: {key}")
        elif not base.translation_is_valid(row["key_finding"], str(item.get("translation_ko", ""))):
            errors.append(f"translation token mismatch: {key}")
        elif not base.direction_is_valid(row["key_finding"], str(item.get("translation_ko", ""))):
            errors.append(f"translation direction mismatch: {key}")

    rule_rows = json.loads(RULES.read_text(encoding="utf-8"))
    if not isinstance(rule_rows, list):
        rule_rows = []
        errors.append("personalized rules are not a list")
    rule_ids = [str(item.get("rule_id", "")) for item in rule_rows]
    if len(rule_ids) != len(set(rule_ids)) or any(not rule_id for rule_id in rule_ids):
        errors.append("duplicate or empty rule identifiers")
    if not set(COMPATIBILITY_ALIASES).issubset({item.get("question_id") for item in rule_rows}):
        errors.append("compatibility aliases missing")
    if set(translation_map) == core_keys:
        try:
            expected_rules = _expected_rules(core_rows, translation_map)
        except (KeyError, TypeError, ValueError) as exc:
            errors.append(f"could not reconstruct evidence rules: {type(exc).__name__}")
        else:
            if rule_rows != expected_rules:
                errors.append("personalized rules differ from exact reconstructed evidence rules")
    clinical_rule_gate_passed = True
    for item in rule_rows:
        if (
            item.get("clinical_recommendation") is not False
            or item.get("decision_authority") != "none"
            or item.get("output_scope") != "evidence_linking_only"
            or item.get("output") != NEUTRAL_RULE_OUTPUT
            or item.get("checks") != NEUTRAL_RULE_CHECKS
        ):
            clinical_rule_gate_passed = False
            errors.append(f"non-neutral rule metadata: {item.get('rule_id', '')}")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    core_manifest = json.loads(CORE_MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("track") != TRACK or core_manifest.get("track") != TRACK:
        errors.append("track mismatch")
    if manifest.get("protocol") != PROTOCOL:
        errors.append("protocol mismatch")
    if manifest.get("input_sha256") != sha256(CORPUS):
        errors.append("manifest corpus hash mismatch")
    if manifest.get("screening_sha256") != sha256(SCREENING):
        errors.append("manifest screening hash mismatch")
    if manifest.get("verbatim_source_fields") != sorted(VERBATIM_SOURCE_FIELDS):
        errors.append("manifest source field exception mismatch")
    expected_input_provenance = _input_provenance()
    if manifest.get("input_provenance") != expected_input_provenance:
        errors.append("manifest input provenance mismatch")
    expected_manifest_hashes = {
        "regex_gate_sha256": sha256(REGEX), "evidence_bundle_sha256": sha256(PICOS),
        "core_evidence_sha256": sha256(CORE),
    }
    if manifest.get("output_hashes") != expected_manifest_hashes:
        errors.append("manifest output hash lineage mismatch")
    expected_agent_gate = {
        "applied": True,
        "regex_passed": sum(row["regex_passed"] == "true" for row in expected_regex),
        "kept": len(expected_picos),
        "decision_source": repo_relative(SCREENING),
        "dropped_by_agent": sum(
            row["regex_passed"] == "true" and row["agent_decision"] != "retain" for row in expected_regex
        ),
    }
    if manifest.get("agent_gate") != expected_agent_gate:
        errors.append("manifest agent gate mismatch")
    if (
        manifest.get("records") != len(expected_picos)
        or manifest.get("by_question") != dict(Counter(row["question_id"] for row in expected_picos))
        or manifest.get("core_limit_per_question") != base.MAX_CORE_PER_QUESTION
    ):
        errors.append("manifest output counts mismatch")

    expected_core_hashes = {
        "source_sha256": sha256(PICOS), "core_sha256": sha256(CORE),
        "translation_sha256": sha256(TRANSLATIONS), "rules_sha256": sha256(RULES),
    }
    for field, expected in expected_core_hashes.items():
        if core_manifest.get(field) != expected:
            errors.append(f"core manifest hash mismatch: {field}")
    if (
        core_manifest.get("input_provenance") != expected_input_provenance
        or core_manifest.get("translation_parts") != part_manifest
        or core_manifest.get("translation_parts_index_sha256") != sha256_json(part_manifest)
    ):
        errors.append("core manifest provenance lineage mismatch")
    expected_generator = {
        "path": repo_relative(Path(__file__)), "sha256": sha256(Path(__file__)),
        "base_path": repo_relative(Path(base.__file__)), "base_sha256": sha256(Path(base.__file__)),
    }
    if core_manifest.get("generator") != expected_generator:
        errors.append("core manifest generator hash mismatch")
    if core_manifest.get("verbatim_source_fields") != sorted(VERBATIM_SOURCE_FIELDS):
        errors.append("core manifest source field exception mismatch")
    if core_manifest.get("agent_gate") != expected_agent_gate:
        errors.append("core manifest agent gate mismatch")
    if (
        core_manifest.get("core_records") != len(core_rows)
        or core_manifest.get("rules") != len(rule_rows)
        or core_manifest.get("per_question") != dict(Counter(row["question_id"] for row in core_rows))
    ):
        errors.append("core manifest output counts mismatch")

    provenance_hashes: dict[str, str] = {}
    try:
        provenance_hashes = _validate_input_provenance(corpus_rows, screening_rows, errors)
    except (KeyError, OSError, RuntimeError, TypeError, ValueError) as exc:
        errors.append(f"input provenance verification failed: {type(exc).__name__}")

    terminology_error_start = len(errors)
    for name, value, source_mode in (
        ("regex_gate", regex_rows, "none"),
        ("evidence_bundle", picos_rows, "bundle"), ("core_evidence", core_rows, "bundle"),
        ("translations", translation_payload, "translations"),
        ("personalized_rules", rule_rows, "rules"),
        ("manifest", manifest, "none"), ("core_manifest", core_manifest, "none"),
    ):
        _append_generated_term_errors(errors, name, value, source_mode)
    terminology_gate_passed = len(errors) == terminology_error_start

    per_question = dict(sorted(Counter(row["question_id"] for row in core_rows).items()))
    output_hashes: dict[str, Any] = {
        "corpus_manifest_sha256": sha256(CORPUS_MANIFEST), "corpus_sha256": sha256(CORPUS),
        "screening_sha256": sha256(SCREENING), **{f"{name}_sha256": value for name, value in provenance_hashes.items()},
        "regex_gate_sha256": sha256(REGEX), "evidence_bundle_sha256": sha256(PICOS),
        "core_evidence_sha256": sha256(CORE), "translations_sha256": sha256(TRANSLATIONS),
        "translation_parts": {item["path"]: item["sha256"] for item in part_manifest},
        "rules_sha256": sha256(RULES), "manifest_sha256": sha256(MANIFEST),
        "core_manifest_sha256": sha256(CORE_MANIFEST),
        "generator_sha256": sha256(Path(__file__)), "base_generator_sha256": sha256(Path(base.__file__)),
    }
    result = {
        "schema_version": "2.0.0", "checked_at": now(), "passed": not errors,
        "errors": errors[:100], "error_count": len(errors), "corpus_rows": len(corpus_rows),
        "screening_rows": len(screening_rows), "evidence_bundle_rows": len(picos_rows),
        "core_records": len(core_rows), "core_by_question": per_question,
        "rules": len(rule_rows), "translations": len(translation_map),
        "exact_gate_records": len(expected_picos), "exact_core_records": len(expected_core),
        "generated_terminology_gate": {
            "passed": terminology_gate_passed,
            "verbatim_source_field_exceptions": sorted(VERBATIM_SOURCE_FIELDS),
        },
        "clinical_rule_gate": {"passed": clinical_rule_gate_passed, "scope": "evidence_linking_only"},
        "hashes": output_hashes,
    }
    write_json(VERIFICATION, result)
    if errors:
        raise RuntimeError(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def all_steps() -> dict[str, Any]:
    build()
    translate()
    rules()
    return verify()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("build", "translate", "rules", "verify", "all"))
    args = parser.parse_args()
    result = {
        "build": build, "translate": translate, "rules": rules,
        "verify": verify, "all": all_steps,
    }[args.command]()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
