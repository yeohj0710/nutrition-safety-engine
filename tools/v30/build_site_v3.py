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


ROOT = Path(__file__).resolve().parents[2]
CORPUS_PATH = ROOT / "data" / "curated_v3" / "evidence_map.csv"
SCREENING_PATH = ROOT / "data" / "curated_v3" / "llm_screening_classifications.csv"
PICOS_PATH = ROOT / "research" / "searches_v3" / "ai_picos" / "picos_definition.json"
OUT = ROOT / "research" / "systematic_review_v30"
REGEX_PATH = OUT / "regex_gate.csv"
PICOS_OUT = OUT / "picos_extraction.csv"
CORE_OUT = OUT / "core_evidence.csv"
TRANSLATIONS_OUT = OUT / "key_finding_translations_ko.json"
RULES_OUT = OUT / "personalized_rules.json"
MANIFEST_OUT = OUT / "manifest.json"
CORE_MANIFEST_OUT = OUT / "core_manifest.json"
TRANSLATION_PARTS_DIR = OUT / "etc" / "translation_parts"
MAX_CORE_PER_QUESTION = 15

QUESTION_CONFIG: dict[str, dict[str, str]] = {
    "HRS1_PERIOPERATIVE": {
        "label_ko": "수술 전후 보충제 안전성",
        "population": r"surg|perioper|preoper|postoper|anesth|procedure|transplant",
        "outcome": r"bleed|hemorr|transfus|coag|complication|interaction|adverse|mortality",
    },
    "HRS2_KIDNEY_DISEASE": {
        "label_ko": "만성콩팥병·투석 환자의 보충제 안전성",
        "population": r"kidney|renal|dialysis|ckd|esrd|nephro",
        "outcome": r"hyperkal|hypercal|toxic|adverse|cardiovascular|mortality|hospital|electrolyte",
    },
    "HRS3_PREGNANCY": {
        "label_ko": "임신 중 보충제 안전성",
        "population": r"pregnan|maternal|prenatal|fetal|foetal|neonat|birth|gestation",
        "outcome": r"adverse|toxic|complication|congenital|terat|miscar|preterm|mortality|anomal",
    },
    "HRS4_LIVER_DISEASE": {
        "label_ko": "간질환 환자의 보충제 안전성",
        "population": r"liver|hepatic|cirrho|hepatitis|hepatocellular",
        "outcome": r"hepatotox|injur|failure|adverse|hospital|mortality|transplant|aminotransferase",
    },
    "HRS5_ANTICOAGULATION": {
        "label_ko": "항응고제 복용자의 보충제 안전성",
        "population": r"anticoag|warfarin|apixaban|rivaroxaban|dabigatran|heparin|coumarin",
        "outcome": r"bleed|hemorr|thromb|\binr\b|interaction|coag|adverse|antiplatelet",
    },
}

EXPOSURE_RE = re.compile(
    r"supplement|herb|botanical|phytotherap|vitamin|mineral|micronutrient|"
    r"folic acid|calcium|iron|probiotic|lactobac|omega|fish oil|amino acid|"
    r"protein|antioxidant|multivitamin|ginkgo|ginseng|garlic|curcumin|kava|"
    r"milk thistle|branched.chain|carnitine|choline|ascorb|ergocalciferol",
    re.IGNORECASE,
)
DOSE_RE = re.compile(
    r"\b\d+(?:[.,]\d+)?(?:\s*(?:-|–|to)\s*\d+(?:[.,]\d+)?)?\s*"
    r"(?:mg|g|µg|μg|mcg|iu|units?|ml|mmol|%)\b(?:\s*/\s*(?:d|day|week))?",
    re.IGNORECASE,
)
NUMBER_RE = re.compile(r"(?<![A-Za-z])\d+(?:[.,]\d+)?")
UNIT_RE = re.compile(
    r"(?<![A-Za-z])(?:mg|g|µg|μg|mcg|iu|ml|mmol)"
    r"(?:/(?:dl|l|d|day|week))?(?![A-Za-z])|"
    r"(?<![A-Za-z])units?/(?:patient|pt)(?![A-Za-z])|%",
    re.IGNORECASE,
)

PICOS_COLUMNS = [
    "question_id", "record_id", "source", "provider_id", "title", "abstract",
    "authors", "year", "venue", "publication_types", "doi", "url",
    "screening_decision", "regex_passed", "source_scope", "locator",
    "locator_text", "dose", "outcome", "key_finding", "population",
    "priority_score", "raw_source_path", "raw_source_sha256",
    "extracted_effect_value", "extracted_effect_status", "status",
]


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def write_csv(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="raise")
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def split_sentences(text: str) -> list[str]:
    stripped = text.strip()
    if not stripped:
        return []
    return [
        part.strip()
        for part in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\[])", stripped)
        if part.strip()
    ]


def regex_passes(row: dict[str, str]) -> tuple[bool, str]:
    text = f"{row['title']} {row['abstract']}"
    config = QUESTION_CONFIG[row["question_id"]]
    exposure = bool(EXPOSURE_RE.search(text))
    population = bool(re.search(config["population"], text, flags=re.IGNORECASE))
    outcome = bool(re.search(config["outcome"], text, flags=re.IGNORECASE))
    passed = exposure and population and outcome
    signals = [name for name, value in (
        ("exposure", exposure), ("population", population), ("outcome", outcome)
    ) if value]
    return passed, "|".join(signals)


def choose_key_finding(row: dict[str, str]) -> tuple[str, str]:
    if not row["abstract"].strip():
        return "TITLE", row["title"].strip()
    sentences = split_sentences(row["abstract"])
    if not sentences:
        raise RuntimeError(f"abstract could not be split: {row['record_id']}")
    outcome_re = re.compile(QUESTION_CONFIG[row["question_id"]]["outcome"], re.IGNORECASE)
    direction_re = re.compile(
        r"increase|decrease|reduce|improv|worsen|higher|lower|associated|risk|"
        r"safe|tolerat|adverse|toxic|significant|no effect|did not|mortality|bleed",
        re.IGNORECASE,
    )
    scored: list[tuple[int, int, str]] = []
    for index, sentence in enumerate(sentences, start=1):
        score = 0
        score += 6 if outcome_re.search(sentence) else 0
        score += 5 if direction_re.search(sentence) else 0
        score += 3 if NUMBER_RE.search(sentence) else 0
        score += 2 if re.search(r"result|conclu|finding", sentence, re.IGNORECASE) else 0
        score += min(len(sentence) // 160, 2)
        scored.append((score, -index, sentence))
    _, negative_index, sentence = max(scored)
    return f"ABSTRACT_SENTENCE_{-negative_index}", sentence


def priority_score(row: dict[str, str], key_finding: str) -> int:
    publication_types = row["publication_types"].lower()
    score = 0
    score += 8 if "systematic review" in publication_types or "meta-analysis" in publication_types else 0
    score += 6 if "randomized controlled trial" in publication_types else 0
    score += 4 if "clinical trial" in publication_types or "cohort" in row["abstract"].lower() else 0
    score += 3 if row["abstract"].strip() else 0
    score += 2 if row["doi"].strip() else 0
    score += 3 if DOSE_RE.search(key_finding) else 0
    score += 4 if re.search(r"result|conclu|associated|risk|adverse|toxic|bleed", key_finding, re.IGNORECASE) else 0
    return score


def extract_observed_axes(row: dict[str, str]) -> list[str]:
    text = f"{row['title']} {row['abstract']}"
    axes: list[str] = []
    if re.search(r"child|adolesc|adult|elder|older|aged|years? old|age[sd]?\b", text, re.IGNORECASE):
        axes.append("age_group")
    if re.search(r"\bmen\b|\bwomen\b|\bmale\b|\bfemale\b|\bsex\b|\bgender\b", text, re.IGNORECASE):
        axes.append("sex")
    if re.search(r"warfarin|anticoag|aspirin|heparin|medication|drug|therapy", text, re.IGNORECASE):
        axes.append("concomitant_medication")
    if re.search(r"kidney|renal|dialysis|pregnan|liver|hepatic|cirrho|surg|diabet|hypertens|cancer", text, re.IGNORECASE):
        axes.append("underlying_condition")
    if DOSE_RE.search(text):
        axes.append("dose_range")
    return axes


def build() -> dict[str, Any]:
    corpus = read_csv(CORPUS_PATH)
    screening_rows = read_csv(SCREENING_PATH)
    screening = {(row["record_id"], row["question_id"]): row for row in screening_rows}
    if len(screening) != len(screening_rows):
        raise RuntimeError("duplicate screening keys")
    regex_rows: list[dict[str, Any]] = []
    extracted: list[dict[str, Any]] = []
    dropped_by_llm = 0
    for row in corpus:
        key = (row["record_id"], row["question_id"])
        decision = screening.get(key)
        if decision is None:
            raise RuntimeError(f"screening row missing: {key}")
        passed, signals = regex_passes(row)
        if passed and decision["llm_decision"] != "retain":
            dropped_by_llm += 1
        regex_rows.append({
            "question_id": row["question_id"], "record_id": row["record_id"],
            "regex_passed": str(passed).lower(), "regex_signals": signals,
            "llm_decision": decision["llm_decision"],
            "kept": str(passed and decision["llm_decision"] == "retain").lower(),
        })
        if not passed or decision["llm_decision"] != "retain":
            continue
        locator, key_finding = choose_key_finding(row)
        scope = "abstract_only" if row["abstract"].strip() else "title_only"
        text = f"{row['title']} {row['abstract']}"
        doses = list(dict.fromkeys(match.group(0) for match in DOSE_RE.finditer(text)))[:8]
        config = QUESTION_CONFIG[row["question_id"]]
        outcome_sentences = [
            sentence for sentence in split_sentences(row["abstract"])
            if re.search(config["outcome"], sentence, re.IGNORECASE)
        ][:3]
        population_sentences = [
            sentence for sentence in split_sentences(row["abstract"])
            if re.search(config["population"], sentence, re.IGNORECASE)
        ][:3]
        extracted.append({
            "question_id": row["question_id"], "record_id": row["record_id"],
            "source": row["source"], "provider_id": row["provider_id"],
            "title": row["title"], "abstract": row["abstract"], "authors": row["authors"],
            "year": row["year"], "venue": row["venue"],
            "publication_types": row["publication_types"], "doi": row["doi"],
            "url": row["source_url"], "screening_decision": decision["llm_decision"],
            "regex_passed": "true", "source_scope": scope, "locator": locator,
            "locator_text": key_finding, "dose": " | ".join(doses),
            "outcome": " | ".join(outcome_sentences), "key_finding": key_finding,
            "population": " | ".join(population_sentences),
            "priority_score": priority_score(row, key_finding),
            "raw_source_path": row["raw_source_path"],
            "raw_source_sha256": row["raw_source_sha256"],
            "extracted_effect_value": "", "extracted_effect_status": "not_observed",
            "status": "ai_screened_regex_confirmed",
        })
    regex_rows.sort(key=lambda row: (row["question_id"], row["record_id"]))
    extracted.sort(key=lambda row: (row["question_id"], row["record_id"]))
    write_csv(REGEX_PATH, regex_rows, [
        "question_id", "record_id", "regex_passed", "regex_signals", "llm_decision", "kept"
    ])
    write_csv(PICOS_OUT, extracted, PICOS_COLUMNS)
    core: list[dict[str, Any]] = []
    for question_id in QUESTION_CONFIG:
        candidates = [row for row in extracted if row["question_id"] == question_id]
        candidates.sort(key=lambda row: (-int(row["priority_score"]), -int(row["year"] or 0), row["record_id"]))
        core.extend(candidates[:MAX_CORE_PER_QUESTION])
    core.sort(key=lambda row: (row["question_id"], -int(row["priority_score"]), row["record_id"]))
    write_csv(CORE_OUT, core, PICOS_COLUMNS)
    regex_passed_count = sum(row["regex_passed"] == "true" for row in regex_rows)
    kept_count = len(extracted)
    manifest = {
        "schema_version": "1.0.0", "track": "v3.0_full_ai_autonomy",
        "generated_at": now(), "protocol": "protocol-v3.0-full-ai",
        "input": CORPUS_PATH.relative_to(ROOT).as_posix(),
        "input_sha256": sha256_file(CORPUS_PATH),
        "screening_input": SCREENING_PATH.relative_to(ROOT).as_posix(),
        "screening_sha256": sha256_file(SCREENING_PATH),
        "records": kept_count,
        "by_question": dict(Counter(row["question_id"] for row in extracted)),
        "with_dose": sum(bool(row["dose"]) for row in extracted),
        "with_fulltext_locator": 0,
        "source_scope": dict(Counter(row["source_scope"] for row in extracted)),
        "effect_status": dict(Counter(row["extracted_effect_status"] for row in extracted)),
        "llm_gate": {
            "applied": True, "regex_passed": regex_passed_count,
            "dropped_by_llm": dropped_by_llm, "kept": kept_count,
            "decision_source": SCREENING_PATH.relative_to(ROOT).as_posix(),
        },
        "core_limit_per_question": MAX_CORE_PER_QUESTION,
        "human_decisions": 0,
        "limitations": [
            "AI-only title/abstract screening and extraction; no human reference decisions",
            "PubMed title/abstract scope only; all retained records are abstract_only or title_only",
            "No effect estimate is imputed; unobserved values remain not_observed",
        ],
    }
    write_json(MANIFEST_OUT, manifest)
    return manifest


def normalized_tokens(pattern: re.Pattern[str], text: str) -> list[str]:
    return [match.group(0).lower().replace("μ", "µ") for match in pattern.finditer(text)]


def normalized_number_tokens(text: str) -> list[str]:
    tokens = [
        match.group(0).lower()
        for match in NUMBER_RE.finditer(text)
        if not text[match.end():].lstrip().startswith(("차", "번째"))
    ]
    word_values = {
        "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
        "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
        "ten": "10", "once": "1", "twice": "2", "both": "2",
    }
    word_tokens: set[str] = set()
    for match in re.finditer(r"\b(?:" + "|".join(word_values) + r")\b", text, re.IGNORECASE):
        word_tokens.add(word_values[match.group(0).lower()])
    korean_values = {
        "두": "2", "세": "3", "네": "4", "다섯": "5",
        "여섯": "6", "일곱": "7", "여덟": "8", "아홉": "9", "열": "10",
    }
    for match in re.finditer(r"(?<![가-힣0-9])(?:" + "|".join(korean_values) + r")(?=\s)", text):
        word_tokens.add(korean_values[match.group(0)])
    semantic_phrases = (
        ("일주일", "1"), ("한 달", "1"), ("한 개", "1"), ("한 편", "1"), ("한 건", "1"),
        ("한 명", "1"), ("한 군", "1"), ("한 그룹", "1"), ("한 연구", "1"),
        ("한 시험", "1"),
    )
    for phrase, value in semantic_phrases:
        if phrase in text:
            word_tokens.add(value)
    tokens.extend(sorted(word_tokens - set(tokens)))
    return tokens


def normalized_unit_tokens(text: str) -> list[str]:
    normalized = text.lower().replace("μ", "µ")
    replacements = {
        "유닛/환자": "units/patient", "단위/환자": "units/patient",
        "유닛/pt": "units/patient", "단위/pt": "units/patient",
        "units/pt": "units/patient", "unit/pt": "unit/patient",
    }
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)
    korean_units = {
        "밀리그램": "mg", "마이크로그램": "µg", "그램": "g",
        "밀리리터": "ml", "국제단위": "iu",
    }
    for source, target in korean_units.items():
        normalized = re.sub(rf"(?<=\d)\s*{source}", f" {target}", normalized)
    normalized = normalized.replace("/일", "/day").replace("/주", "/week")
    normalized = re.sub(r"(?<=\d)(?=(?:mg|g|µg|mcg|iu|ml|mmol)\b)", " ", normalized)
    tokens = normalized_tokens(UNIT_RE, normalized)
    return [
        token.replace("units/pt", "units/patient")
        .replace("unit/pt", "units/patient")
        .replace("unit/patient", "units/patient")
        for token in tokens
    ]


def translation_is_valid(source: str, translation: str) -> bool:
    return (
        bool(re.search(r"[가-힣]", translation))
        and Counter(normalized_number_tokens(source)) == Counter(normalized_number_tokens(translation))
        and Counter(normalized_unit_tokens(source)) == Counter(normalized_unit_tokens(translation))
    )


def direction_is_valid(source: str, translation: str) -> bool:
    requirements = [
        (r"increase|higher|elevat|rise|greater", r"증가|높|상승|늘|커|많"),
        (r"decrease|lower|reduc|declin|attenuat", r"감소|낮|줄|완화|저하"),
        (r"no significant|not significant|not associated|no association|no effect|did not", r"없|않|못|무관|무효과|차이"),
        (r"\brisk\b", r"위험"),
        (r"mortality|death", r"사망"),
        (r"bleed|hemorrhag", r"출혈"),
    ]
    return all(
        not re.search(source_pattern, source, re.IGNORECASE)
        or bool(re.search(translation_pattern, translation))
        for source_pattern, translation_pattern in requirements
    )


def translate() -> dict[str, Any]:
    if not CORE_OUT.exists():
        build()
    core = read_csv(CORE_OUT)
    core_by_id = {
        f"{row['question_id']}|{row['record_id']}": row
        for row in core
    }
    if len(core_by_id) != len(core):
        raise RuntimeError("duplicate core evidence translation keys")

    part_paths = sorted(TRANSLATION_PARTS_DIR.glob("*.json"))
    expected_questions = set(QUESTION_CONFIG)
    if len(part_paths) != len(expected_questions):
        raise RuntimeError(
            f"expected {len(expected_questions)} translation part files, found {len(part_paths)}"
        )
    merged: dict[str, str] = {}
    seen_questions: set[str] = set()
    part_manifest: list[dict[str, str]] = []
    for path in part_paths:
        part = json.loads(path.read_text(encoding="utf-8"))
        question_id = part.get("question_id")
        if question_id not in expected_questions:
            raise RuntimeError(f"invalid translation part question_id in {path.name}: {question_id!r}")
        if question_id in seen_questions:
            raise RuntimeError(f"duplicate translation part question_id: {question_id}")
        if part.get("translation_authorship") != "ai_generated":
            raise RuntimeError(f"invalid translation_authorship in {path.name}")
        if part.get("author") != "OpenAI Codex":
            raise RuntimeError(f"invalid translation author in {path.name}")
        part_translations = part.get("translations")
        if not isinstance(part_translations, dict):
            raise RuntimeError(f"translations must be an object in {path.name}")
        for translation_id, candidate in part_translations.items():
            if not isinstance(translation_id, str) or not translation_id.startswith(f"{question_id}|"):
                raise RuntimeError(f"invalid translation key in {path.name}: {translation_id!r}")
            if translation_id in merged:
                raise RuntimeError(f"duplicate translation key: {translation_id}")
            if not isinstance(candidate, str) or not candidate.strip():
                raise RuntimeError(f"empty translation in {path.name}: {translation_id}")
            merged[translation_id] = candidate.strip()
        seen_questions.add(question_id)
        part_manifest.append({
            "path": path.relative_to(ROOT).as_posix(),
            "sha256": sha256_file(path),
        })

    if seen_questions != expected_questions:
        raise RuntimeError(
            f"translation part questions do not match expected questions: "
            f"missing={sorted(expected_questions - seen_questions)}"
        )
    core_keys = set(core_by_id)
    merged_keys = set(merged)
    if merged_keys != core_keys:
        raise RuntimeError(
            "translation part keys do not equal core evidence keys: "
            f"missing={sorted(core_keys - merged_keys)}, extra={sorted(merged_keys - core_keys)}"
        )

    translations: list[dict[str, str]] = []
    for row in core:
        translation_id = f"{row['question_id']}|{row['record_id']}"
        candidate = merged[translation_id]
        source_sha = sha256_text(row["key_finding"])
        if not translation_is_valid(row["key_finding"], candidate):
            raise RuntimeError(
                f"translation number/unit validation failed for {translation_id}: {candidate!r}; "
                f"source_numbers={normalized_number_tokens(row['key_finding'])}; "
                f"translation_numbers={normalized_number_tokens(candidate)}; "
                f"source_units={normalized_unit_tokens(row['key_finding'])}; "
                f"translation_units={normalized_unit_tokens(candidate)}"
            )
        if not direction_is_valid(row["key_finding"], candidate):
            raise RuntimeError(
                f"translation direction validation failed for {translation_id}: {candidate!r}"
            )
        translations.append({
            "translation_id": translation_id,
            "question_id": row["question_id"], "record_id": row["record_id"],
            "source_text": row["key_finding"], "source_sha256": source_sha,
            "translation_ko": candidate, "translation_authorship": "ai_generated",
            "author": "OpenAI Codex",
            "numeric_unit_validation": "passed", "direction_validation": "passed",
        })
    payload = {
        "schema_version": "1.0.0", "track": "v3.0_full_ai_autonomy",
        "generated_at": now(), "translation_authorship": "ai_generated",
        "author": "OpenAI Codex", "source": "Codex-authored translation parts",
        "parts": part_manifest,
        "records": len(translations), "translations": translations,
    }
    write_json(TRANSLATIONS_OUT, payload)
    return payload


def evidence_object(row: dict[str, str], translation_ko: str) -> dict[str, Any]:
    return {
        "record_id": row["record_id"], "title": row["title"], "authors": row["authors"],
        "venue": row["venue"], "year": int(row["year"] or 0), "doi": row["doi"],
        "url": row["url"], "locator": f"{row['locator']}: {row['locator_text']}",
        "dose": row["dose"], "outcome": row["outcome"],
        "key_finding": row["key_finding"], "key_finding_ko": translation_ko,
        "publication_types": row["publication_types"], "population": row["population"],
        "priority_score": int(row["priority_score"] or 0),
        "source_scope": row["source_scope"], "raw_source_path": row["raw_source_path"],
        "raw_source_sha256": row["raw_source_sha256"],
        "effect_status": row["extracted_effect_status"],
    }


def rule_payload(question_id: str, rule_id: str, label: str, evidence: list[dict[str, Any]], *, axis: str = "base") -> dict[str, Any]:
    return {
        "rule_id": rule_id, "question_id": question_id, "ingredient": label,
        "medication": "문헌에 명시된 병용약 확인", "condition": QUESTION_CONFIG.get(question_id, {}).get("label_ko", label),
        "personalization_axis": axis,
        "checks": ["제품명과 1일 용량", "복용 시작일과 중단일", "병용약과 기저질환", "최근 증상과 검사 결과"],
        "output": "근거 문장의 대상·노출·결과와 현재 복용 정보를 함께 대조하세요. 임의로 복용을 중단하거나 용량을 바꾸지 마세요.",
        "evidence": evidence[:3], "all_evidence": evidence,
        "status": "ai_generated_observed_evidence_rule",
    }


def build_rules() -> dict[str, Any]:
    if not TRANSLATIONS_OUT.exists():
        translate()
    core = read_csv(CORE_OUT)
    translation_payload = json.loads(TRANSLATIONS_OUT.read_text(encoding="utf-8"))
    translation_map = {
        (entry["question_id"], entry["record_id"]): entry["translation_ko"]
        for entry in translation_payload["translations"]
    }
    by_question: dict[str, list[dict[str, Any]]] = defaultdict(list)
    source_rows: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in core:
        key = (row["question_id"], row["record_id"])
        by_question[row["question_id"]].append(evidence_object(row, translation_map[key]))
        source_rows[row["question_id"]].append(row)
    rules: list[dict[str, Any]] = []
    axis_support: dict[str, dict[str, int]] = {}
    for question_id, config in QUESTION_CONFIG.items():
        evidence = by_question[question_id]
        rules.append(rule_payload(question_id, f"{question_id}:base", config["label_ko"], evidence))
        counts = Counter(axis for row in source_rows[question_id] for axis in set(extract_observed_axes(row)))
        axis_support[question_id] = dict(sorted(counts.items()))
        for axis, count in sorted(counts.items()):
            if count < 1:
                continue
            supported_ids = {
                row["record_id"] for row in source_rows[question_id] if axis in extract_observed_axes(row)
            }
            supported = [item for item in evidence if item["record_id"] in supported_ids]
            rules.append(rule_payload(
                question_id, f"{question_id}:{axis}", f"{config['label_ko']} — {axis}", supported, axis=axis
            ))
    aliases = {
        "A1": ("HRS5_ANTICOAGULATION", "비타민 K", r"vitamin k|warfarin|\binr\b"),
        "A2": ("HRS5_ANTICOAGULATION", "오메가-3", r"omega|fish oil|eicosapenta|docosahexa"),
        "B1": ("HRS2_KIDNEY_DISEASE", "칼슘", r"calcium|hypercal"),
        "B2": ("HRS2_KIDNEY_DISEASE", "비타민 D", r"vitamin d|ergocalciferol|cholecalciferol|25.hydroxy"),
        "B3": ("HRS2_KIDNEY_DISEASE", "비타민 C", r"vitamin c|ascorb"),
    }
    for alias, (question_id, label, pattern) in aliases.items():
        filtered = [
            item for item in by_question[question_id]
            if re.search(pattern, f"{item['title']} {item['key_finding']}", re.IGNORECASE)
        ]
        evidence = filtered or by_question[question_id][:5]
        alias_rule = rule_payload(alias, f"compat:{alias}", label, evidence, axis="compatibility_alias")
        alias_rule["condition"] = QUESTION_CONFIG[question_id]["label_ko"]
        alias_rule["source_question_id"] = question_id
        rules.append(alias_rule)
    write_json(RULES_OUT, rules)
    per_question = dict(Counter(row["question_id"] for row in core))
    manifest = {
        "schema_version": "1.0.0", "track": "v3.0_full_ai_autonomy",
        "generated_at": now(), "core_records": len(core), "per_question": per_question,
        "rules": len(rules), "source_sha256": sha256_file(PICOS_OUT),
        "core_sha256": sha256_file(CORE_OUT), "translation_sha256": sha256_file(TRANSLATIONS_OUT),
        "translation_authorship": "ai_generated",
        "personalization": {
            "axes": sorted({axis for counts in axis_support.values() for axis in counts}),
            "evidence_rows_by_question_and_axis": axis_support,
            "compatibility_aliases": {
                alias: {"source_question_id": value[0], "ingredient": value[1]}
                for alias, value in aliases.items()
            },
        },
        "llm_gate": json.loads(MANIFEST_OUT.read_text(encoding="utf-8"))["llm_gate"],
    }
    write_json(CORE_MANIFEST_OUT, manifest)
    return manifest


def validate() -> dict[str, Any]:
    required = [REGEX_PATH, PICOS_OUT, CORE_OUT, TRANSLATIONS_OUT, RULES_OUT, MANIFEST_OUT, CORE_MANIFEST_OUT]
    missing = [path.relative_to(ROOT).as_posix() for path in required if not path.exists()]
    if missing:
        raise RuntimeError(f"missing outputs: {missing}")
    corpus = {(row["record_id"], row["question_id"]): row for row in read_csv(CORPUS_PATH)}
    screening = {(row["record_id"], row["question_id"]): row for row in read_csv(SCREENING_PATH)}
    regex_rows = read_csv(REGEX_PATH)
    extracted = read_csv(PICOS_OUT)
    core = read_csv(CORE_OUT)
    translations = json.loads(TRANSLATIONS_OUT.read_text(encoding="utf-8"))
    rules = json.loads(RULES_OUT.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_OUT.read_text(encoding="utf-8"))
    core_manifest = json.loads(CORE_MANIFEST_OUT.read_text(encoding="utf-8"))
    errors: list[str] = []
    regex_map = {(row["record_id"], row["question_id"]): row for row in regex_rows}
    extracted_keys = {(row["record_id"], row["question_id"]) for row in extracted}
    core_keys = {(row["record_id"], row["question_id"]) for row in core}
    if not core_keys.issubset(extracted_keys):
        errors.append("core is not a subset of picos extraction")
    for row in extracted:
        key = (row["record_id"], row["question_id"])
        source = corpus.get(key)
        if source is None:
            errors.append(f"absent corpus key: {key}")
            continue
        if screening[key]["llm_decision"] != "retain" or regex_map[key]["regex_passed"] != "true":
            errors.append(f"gate violation: {key}")
        haystack = source["abstract"] if row["source_scope"] == "abstract_only" else source["title"]
        if row["locator_text"] not in haystack or row["key_finding"] != row["locator_text"]:
            errors.append(f"locator mismatch: {key}")
        raw_path = ROOT / row["raw_source_path"]
        if not raw_path.exists() or sha256_file(raw_path) != row["raw_source_sha256"]:
            errors.append(f"raw source hash mismatch: {key}")
        if row["extracted_effect_value"] or row["extracted_effect_status"] != "not_observed":
            errors.append(f"effect provenance violation: {key}")
    translation_map = {
        (entry["record_id"], entry["question_id"]): entry for entry in translations["translations"]
    }
    if set(translation_map) != core_keys:
        errors.append("translation keys do not equal core keys")
    for row in core:
        key = (row["record_id"], row["question_id"])
        item = translation_map.get(key)
        if not item or item.get("translation_authorship") != "ai_generated":
            errors.append(f"missing AI translation: {key}")
        elif not translation_is_valid(row["key_finding"], item["translation_ko"]):
            errors.append(f"translation token mismatch: {key}")
    alias_ids = {"A1", "A2", "B1", "B2", "B3"}
    if not alias_ids.issubset({rule["question_id"] for rule in rules}):
        errors.append("site compatibility aliases missing")
    if manifest["llm_gate"]["applied"] is not True:
        errors.append("llm_gate.applied is not true")
    if manifest["llm_gate"]["kept"] != len(extracted):
        errors.append("llm_gate kept count mismatch")
    if core_manifest["translation_authorship"] != "ai_generated":
        errors.append("translation authorship missing from core manifest")
    if core_manifest["rules"] <= 5:
        errors.append("personalization rules were not expanded")
    result = {
        "valid": not errors, "validated_at": now(), "errors": errors,
        "corpus_records": len(corpus), "regex_passed": manifest["llm_gate"]["regex_passed"],
        "dropped_by_llm": manifest["llm_gate"]["dropped_by_llm"],
        "kept": len(extracted), "core_records": len(core), "rules": len(rules),
        "translations": len(translation_map),
    }
    write_json(OUT / "validation.json", result)
    if errors:
        raise RuntimeError(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def all_steps() -> dict[str, Any]:
    build()
    translate()
    build_rules()
    return validate()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("build", "translate", "rules", "validate", "all"))
    args = parser.parse_args()
    result = {
        "build": build, "translate": translate, "rules": build_rules,
        "validate": validate, "all": all_steps,
    }[args.command]()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
