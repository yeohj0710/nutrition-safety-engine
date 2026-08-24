"""재수집 트랙 입력을 v4 사이트 빌더 입력 형식으로 변환한다.

판정은 이 파일에서 다시 계산하지 않는다. decisions.jsonl의
`(question_id, record_id)` 판정을 고유 키로 접어 그대로 CSV에 옮긴다.
"""

from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


csv.field_size_limit(10**9)

ROOT = Path(__file__).resolve().parents[2]
INPUT_ROOT = Path(r"C:\dev\evidence-recollect\data\yeo")
CORPUS_INPUT = INPUT_ROOT / "corpus" / "evidence_map.csv"
DECISIONS_INPUT = INPUT_ROOT / "screen" / "decisions.jsonl"
FULLTEXT_INPUT = INPUT_ROOT / "fulltext" / "fulltext.jsonl"
OUT = ROOT / "data" / "recollect_v41"

CORPUS_COLUMNS = [
    "source", "record_id", "question_id", "provider_id", "title", "abstract",
    "authors", "year", "venue", "publication_types", "doi", "dedup_identity",
    "source_url", "classification", "observability", "fulltext_locator_status",
    "fulltext_locator", "raw_source_path", "raw_source_sha256",
    "extracted_effect_value", "extracted_effect_status", "decision_authority",
    "clinical_claim_allowed", "status",
]
SCREENING_COLUMNS = [
    "record_id", "question_id", "decision", "reason_codes", "confidence",
    "evidence_basis", "status", "batch_id", "assigned_agent", "screened_at",
]
TRACK = "recollect-v2"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def key(row: dict[str, Any]) -> tuple[str, str]:
    return str(row.get("question_id", "")), str(row.get("record_id", ""))


def load_decisions() -> tuple[dict[tuple[str, str], dict[str, Any]], dict[str, Any]]:
    decisions: dict[tuple[str, str], dict[str, Any]] = {}
    duplicate_lines = 0
    duplicate_conflicts = 0
    conflict_examples: list[dict[str, Any]] = []
    raw_rows = 0
    with DECISIONS_INPUT.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            raw_rows += 1
            row = json.loads(line)
            row_key = key(row)
            previous = decisions.get(row_key)
            if previous is not None:
                duplicate_lines += 1
                comparable = {
                    field: row.get(field, "")
                    for field in ("question_id", "record_id", "decision", "decision_ko", "why")
                }
                previous_comparable = {
                    field: previous.get(field, "") for field in comparable
                }
                if comparable != previous_comparable:
                    duplicate_conflicts += 1
                    if len(conflict_examples) < 10:
                        conflict_examples.append(
                            {"line": line_number, "key": row_key, "previous": previous, "current": row}
                        )
                continue
            decisions[row_key] = row
    counts = Counter(str(row.get("decision", "")) for row in decisions.values())
    return decisions, {
        "raw_rows": raw_rows,
        "unique_rows": len(decisions),
        "duplicate_lines_folded": duplicate_lines,
        "duplicate_conflicts": duplicate_conflicts,
        "duplicate_conflict_examples": conflict_examples,
        "decision_counts": dict(sorted(counts.items())),
    }


def load_fulltext() -> tuple[dict[tuple[str, str], dict[str, Any]], dict[str, Any]]:
    by_key: dict[tuple[str, str], dict[str, Any]] = {}
    raw_rows = 0
    duplicate_keys = 0
    body_files_missing = 0
    has_fulltext = 0
    with FULLTEXT_INPUT.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            raw_rows += 1
            row = json.loads(line)
            if row.get("has_fulltext"):
                has_fulltext += 1
                body_file = row.get("body_file")
                if body_file and not (FULLTEXT_INPUT.parent / body_file).is_file():
                    body_files_missing += 1
            question_ids = row.get("question_ids") or [row.get("question_id", "")]
            for question_id in question_ids:
                row_key = (str(row.get("record_id", "")), str(question_id))
                if row_key in by_key:
                    duplicate_keys += 1
                    continue
                by_key[row_key] = row
    return by_key, {
        "raw_rows": raw_rows,
        "unique_question_record_keys": len(by_key),
        "duplicate_keys": duplicate_keys,
        "has_fulltext_rows": has_fulltext,
        "body_files_missing": body_files_missing,
    }


def build_corpus(
    decisions: dict[tuple[str, str], dict[str, Any]],
    fulltext: dict[tuple[str, str], dict[str, Any]],
) -> tuple[list[dict[str, str]], dict[str, Any]]:
    rows: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    authors_empty = 0
    raw_path_empty = 0
    raw_hash_empty = 0
    effect_empty = 0
    fulltext_index_hits = 0
    fulltext_available = 0
    pmc_locator_available = 0
    missing_decisions: list[tuple[str, str]] = []

    with CORPUS_INPUT.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != [
            "record_id", "question_id", "pmid", "title", "abstract", "year", "venue", "doi",
            "publication_types", "mesh", "dedup_identity", "has_abstract", "slice_id",
        ]:
            raise RuntimeError(f"unexpected recollect corpus header: {reader.fieldnames}")
        for source in reader:
            row_key = (source["question_id"], source["record_id"])
            if row_key in seen:
                raise RuntimeError(f"duplicate recollect corpus key: {row_key}")
            seen.add(row_key)
            decision = decisions.get(row_key)
            if decision is None:
                missing_decisions.append(row_key)
            ft = fulltext.get((source["record_id"], source["question_id"]), {})
            pmcid = str(ft.get("pmcid") or "").strip()
            if ft:
                fulltext_index_hits += 1
            if ft.get("has_fulltext"):
                fulltext_available += 1
            if pmcid:
                pmc_locator_available += 1
            authors_empty += 1
            raw_path_empty += 1
            raw_hash_empty += 1
            effect_empty += 1
            provider_id = source.get("pmid", "").strip() or source["record_id"].removeprefix("pubmed:")
            fulltext_locator = (
                f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/" if pmcid else ""
            )
            rows.append({
                "source": "pubmed",
                "record_id": source["record_id"],
                "question_id": source["question_id"],
                "provider_id": provider_id,
                "title": source.get("title", ""),
                "abstract": source.get("abstract", ""),
                "authors": "",
                "year": source.get("year", ""),
                "venue": source.get("venue", ""),
                "publication_types": source.get("publication_types", ""),
                "doi": source.get("doi", ""),
                "dedup_identity": source.get("dedup_identity", ""),
                "source_url": f"https://pubmed.ncbi.nlm.nih.gov/{provider_id}/",
                "classification": "unclassified",
                "observability": "abstract_available" if source.get("abstract", "").strip() else "title_only",
                "fulltext_locator_status": "pmc_locator_available" if pmcid else "not_observed",
                "fulltext_locator": fulltext_locator,
                "raw_source_path": "",
                "raw_source_sha256": "",
                "extracted_effect_value": "",
                "extracted_effect_status": "not_observed",
                "decision_authority": "agent_screening_pending",
                "clinical_claim_allowed": "false",
                "status": "captured_exploratory_record",
            })
    if missing_decisions:
        raise RuntimeError(f"missing decisions for {len(missing_decisions)} corpus keys: {missing_decisions[:3]}")
    rows.sort(key=lambda row: (row["question_id"], row["record_id"]))
    return rows, {
        "rows": len(rows),
        "per_question": dict(sorted(Counter(row["question_id"] for row in rows).items())),
        "authors_empty": authors_empty,
        "raw_source_path_empty": raw_path_empty,
        "raw_source_sha256_empty": raw_hash_empty,
        "extracted_effect_value_empty": effect_empty,
        "fulltext_index_hits": fulltext_index_hits,
        "fulltext_available": fulltext_available,
        "pmc_locator_available": pmc_locator_available,
    }


def build_screening(
    corpus: list[dict[str, str]], decisions: dict[tuple[str, str], dict[str, Any]]
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for source in corpus:
        decision = decisions[(source["question_id"], source["record_id"])]
        rows.append({
            "record_id": source["record_id"],
            "question_id": source["question_id"],
            "decision": str(decision.get("decision", "")),
            "reason_codes": "",
            "confidence": "",
            "evidence_basis": "abstract" if source["abstract"].strip() else "title",
            "status": "ok",
            "batch_id": str(decision.get("batch_id", "")),
            "assigned_agent": "",
            "screened_at": str(decision.get("at", "")),
        })
    rows.sort(key=lambda row: (row["question_id"], row["record_id"]))
    return rows


def write_csv(path: Path, rows: list[dict[str, str]], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="raise", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    for path in (CORPUS_INPUT, DECISIONS_INPUT, FULLTEXT_INPUT):
        if not path.is_file():
            raise FileNotFoundError(path)
    OUT.mkdir(parents=True, exist_ok=True)
    decisions, decision_report = load_decisions()
    fulltext, fulltext_report = load_fulltext()
    corpus, corpus_report = build_corpus(decisions, fulltext)
    screening = build_screening(corpus, decisions)
    invalid = sorted({row["decision"] for row in screening} - {"retain", "deprioritize", "uncertain"})
    if invalid:
        raise RuntimeError(f"invalid decisions: {invalid}")

    corpus_path = OUT / "evidence_map.csv"
    screening_path = OUT / "agent_screening_classifications.csv"
    write_csv(corpus_path, corpus, CORPUS_COLUMNS)
    write_csv(screening_path, screening, SCREENING_COLUMNS)

    report = {
        "schema_version": "1.0.0",
        "track": TRACK,
        "generated_at": now(),
        "inputs": {
            "corpus": {"path": str(CORPUS_INPUT), "sha256": sha256_file(CORPUS_INPUT)},
            "decisions": {"path": str(DECISIONS_INPUT), "sha256": sha256_file(DECISIONS_INPUT)},
            "fulltext": {"path": str(FULLTEXT_INPUT), "sha256": sha256_file(FULLTEXT_INPUT)},
        },
        "corpus": corpus_report,
        "screening": {
            **decision_report,
            "output_rows": len(screening),
            "coverage": len(screening) / len(corpus) if corpus else 0,
            "format": SCREENING_COLUMNS,
        },
        "fulltext": fulltext_report,
        "defaults_and_empty_fields": {
            "authors": {
                "rows": corpus_report["authors_empty"],
                "reason": "재수집 코퍼스와 fulltext 색인에 저자 필드가 없어 빈 값으로 둠",
            },
            "raw_source_path": {
                "rows": corpus_report["raw_source_path_empty"],
                "reason": "재수집 입력에 원시 XML 파일별 경로가 없어 추정하지 않음",
            },
            "raw_source_sha256": {
                "rows": corpus_report["raw_source_sha256_empty"],
                "reason": "원시 XML 파일별 경로가 없어 해시를 추정하지 않음",
            },
            "extracted_effect_value": {
                "rows": corpus_report["extracted_effect_value_empty"],
                "reason": "입력에 효과값 추출 결과가 없어 not_observed 규약을 유지함",
            },
            "reason_codes": {
                "rows": len(screening),
                "reason": "decisions.jsonl에 코드 필드가 없어 재분류하지 않고 빈 값으로 둠",
            },
            "confidence": {
                "rows": len(screening),
                "reason": "decisions.jsonl에 신뢰도 필드가 없어 추정하지 않음",
            },
            "assigned_agent": {
                "rows": len(screening),
                "reason": "decisions.jsonl에 에이전트 식별자가 없어 빈 값으로 둠",
            },
        },
        "output": {
            "corpus": {"path": "data/recollect_v41/evidence_map.csv", "sha256": sha256_file(corpus_path)},
            "screening": {"path": "data/recollect_v41/agent_screening_classifications.csv", "sha256": sha256_file(screening_path)},
        },
        "decision_reuse": {
            "reclassified": False,
            "source_field": "decision",
            "unique_key": ["question_id", "record_id"],
        },
    }
    (OUT / "adapter_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    corpus_manifest = {
        "schema_version": "1.0.0",
        "track": TRACK,
        "generated_at": report["generated_at"],
        "source_constraint": "pubmed_only",
        "human_decisions": 0,
        "corpus": {
            "path": "data/recollect_v41/evidence_map.csv",
            "sha256": sha256_file(corpus_path),
            "row_count": len(corpus),
            "row_distribution_by_question": corpus_report["per_question"],
            "schema": CORPUS_COLUMNS,
        },
        "fulltext": fulltext_report,
        "adapter_report": "data/recollect_v41/adapter_report.json",
    }
    (OUT / "corpus_manifest.json").write_text(
        json.dumps(corpus_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    screening_manifest = {
        "schema_version": "1.0.0",
        "track": TRACK,
        "input_path": "data/recollect_v41/evidence_map.csv",
        "output_path": "data/recollect_v41/agent_screening_classifications.csv",
        "input_sha256": sha256_file(corpus_path),
        "output_sha256": sha256_file(screening_path),
        "row_count": len(corpus),
        "classified": len(screening),
        "coverage": 1.0,
        "run_complete": True,
        "decision_counts": decision_report["decision_counts"],
        "raw_rows": decision_report["raw_rows"],
        "duplicate_lines_folded": decision_report["duplicate_lines_folded"],
        "unique_key": ["question_id", "record_id"],
        "format": SCREENING_COLUMNS,
        "adapter_report": "data/recollect_v41/adapter_report.json",
    }
    (OUT / "screening_manifest.json").write_text(
        json.dumps(screening_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
