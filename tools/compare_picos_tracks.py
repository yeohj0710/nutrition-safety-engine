#!/usr/bin/env python3
"""Compare the frozen legacy PICOS/PubMed track with the v3 AI track.

The script treats ``research/searches/search_log.csv`` as the row-level v2
search manifest and ``data/curated_v3/corpus_manifest.json`` as the v3
manifest. Counts, terms, MeSH use, and PMID set operations are always rebuilt
from those manifests and their referenced files. The only analytical policy
encoded here is the explicit question-scope mapping required for reporting.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
V2_SEARCH_MANIFEST = ROOT / "research/searches/search_log.csv"
V2_PROTOCOL = ROOT / "research/protocol/protocol-v1.0.md"
V3_CORPUS_MANIFEST = ROOT / "data/curated_v3/corpus_manifest.json"
V3_PICOS = ROOT / "research/searches_v3/ai_picos/picos_definition.json"
V3_CORPUS = ROOT / "data/curated_v3/evidence_map.csv"
OUTPUT = ROOT / "research/synthesis/picos_track_comparison.json"

V2_QUESTION_IDS = ("A1", "A2", "B1", "B2", "B3")
V3_QUESTION_IDS = (
    "HRS1_PERIOPERATIVE",
    "HRS2_KIDNEY_DISEASE",
    "HRS3_PREGNANCY",
    "HRS4_LIVER_DISEASE",
    "HRS5_ANTICOAGULATION",
)

# This is an explicit scope assessment, not a metric result. The script binds
# every assessment to question text read from the protocol/PICOS inputs and
# calculates all search/result evidence independently on each run.
SCOPE_ASSESSMENTS: dict[str, dict[str, Any]] = {
    "HRS1_PERIOPERATIVE": {
        "status": "no_legacy_question_covered",
        "covered_legacy_question_ids": [],
        "explicit_noncoverage_question_ids": list(V2_QUESTION_IDS),
        "rationale": (
            "HRS1은 수술·침습적 시술 환자의 수술주위 노출과 합병증을 다룬다. "
            "기존 A1·A2는 특정 항응고제-보충제 조합, B1·B2·B3는 신결석-특정 "
            "보충제 조합이므로 Population과 Outcome 범위가 일치하지 않는다."
        ),
        "required_v3_text": ("수술", "보충제"),
    },
    "HRS2_KIDNEY_DISEASE": {
        "status": "adjacent_renal_domain_not_coverage",
        "covered_legacy_question_ids": [],
        "explicit_noncoverage_question_ids": list(V2_QUESTION_IDS),
        "rationale": (
            "HRS2는 만성콩팥병 또는 투석 환자의 전해질 이상·신독성을 다룬다. "
            "B1·B2·B3는 칼슘옥살산 신결석 위험군의 결석 발생·재발을 다루므로 "
            "같은 신장 영역이어도 Population과 Outcome이 달라 포괄 관계가 아니다."
        ),
        "required_v3_text": ("만성콩팥병", "투석"),
    },
    "HRS3_PREGNANCY": {
        "status": "no_legacy_question_covered",
        "covered_legacy_question_ids": [],
        "explicit_noncoverage_question_ids": list(V2_QUESTION_IDS),
        "rationale": (
            "HRS3는 임신부·태아·신생아 안전성을 다룬다. 기존 A1·A2와 B1·B2·B3에는 "
            "임신 Population 또는 태아·신생아 Outcome이 지정되지 않아 포괄 관계가 아니다."
        ),
        "required_v3_text": ("임신", "태아"),
    },
    "HRS4_LIVER_DISEASE": {
        "status": "no_legacy_question_covered",
        "covered_legacy_question_ids": [],
        "explicit_noncoverage_question_ids": list(V2_QUESTION_IDS),
        "rationale": (
            "HRS4는 기존 간질환 환자의 간손상·간기능 악화를 다룬다. 기존 A1·A2와 "
            "B1·B2·B3에는 간질환 Population과 간손상 Outcome이 지정되지 않아 포괄 관계가 아니다."
        ),
        "required_v3_text": ("간질환", "간손상"),
    },
    "HRS5_ANTICOAGULATION": {
        "status": "broader_umbrella_covers_legacy_scope",
        "covered_legacy_question_ids": ["A1", "A2"],
        "explicit_noncoverage_question_ids": ["B1", "B2", "B3"],
        "rationale": (
            "HRS5는 VKA·DOAC 등을 사용하는 환자의 모든 식이·허브 보충제 병용과 "
            "출혈·혈전·응고검사 변화·상호작용을 묻는 상위 질문이다. 따라서 비타민 K-VKA인 "
            "A1과 omega-3-경구 항응고제인 A2를 질문 수준에서 포괄하지만, 신결석 질문 "
            "B1·B2·B3는 Population과 Outcome이 달라 포괄하지 않는다."
        ),
        "required_v3_text": ("항응고제", "보충제", "출혈"),
    },
}


def rel(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def sha256_query_text(path: Path) -> str:
    """query.txt 는 실행 시점에 정규화된 질의 문자열로 해싱됐다.

    git 의 autocrlf 로 체크아웃 시 개행이 CRLF 로 바뀌므로 원시 바이트 해시는
    매니페스트와 일치하지 않는다. 줄바꿈을 LF 로 정규화하고 앞뒤 공백을 제거한
    질의 문자열을 UTF-8 로 해싱해 실행 시점 값과 비교한다.
    """
    text = path.read_text(encoding="utf-8-sig").replace(chr(13) + chr(10), chr(10)).strip()
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_values(values: Iterable[str]) -> str:
    payload = "\n".join(sorted(values, key=int)).encode("ascii")
    return hashlib.sha256(payload).hexdigest()


def inventory_entry(path: Path, role: str) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"입력 파일이 없습니다: {path}")
    return {
        "path": rel(path),
        "role": role,
        "size_bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8-sig") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"JSON 최상위 값이 객체가 아닙니다: {path}")
    return value


def parse_v2_questions(path: Path) -> dict[str, dict[str, str]]:
    text = path.read_text(encoding="utf-8-sig")
    headings = list(re.finditer(r"^###\s+([AB]\d)\.\s+(.+?)\s*$", text, re.MULTILINE))
    questions: dict[str, dict[str, str]] = {}
    for index, match in enumerate(headings):
        question_id, label = match.groups()
        end = headings[index + 1].start() if index + 1 < len(headings) else len(text)
        section = text[match.end() : end]
        fields = {
            key.lower(): value.strip()
            for key, value in re.findall(
                r"^-\s+\*\*(Population|Exposure|Comparator|Outcomes):\*\*\s+(.+?)\s*$",
                section,
                re.MULTILINE,
            )
        }
        missing = {"population", "exposure", "comparator", "outcomes"} - fields.keys()
        if missing:
            raise ValueError(f"{question_id} PICOS 필드 누락: {sorted(missing)}")
        questions[question_id] = {
            "question_id": question_id,
            "label": label,
            "P": fields["population"],
            "I": fields["exposure"],
            "C": fields["comparator"],
            "O": fields["outcomes"],
        }
    if tuple(questions) != V2_QUESTION_IDS:
        raise ValueError(f"v2 질문 집합 불일치: {list(questions)}")
    return questions


def parse_v3_questions(path: Path) -> dict[str, dict[str, Any]]:
    data = read_json(path)
    questions = {item["question_id"]: item for item in data.get("questions", [])}
    if tuple(questions) != V3_QUESTION_IDS:
        raise ValueError(f"v3 질문 집합 불일치: {list(questions)}")
    return questions


def normalize_term(term: str) -> str:
    term = term.casefold().replace("*", "").replace("-", " ")
    words = re.findall(r"[a-z0-9]+", term)
    normalized: list[str] = []
    for word in words:
        if len(word) > 4 and word.endswith("ies"):
            word = word[:-3] + "y"
        elif len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
            word = word[:-1]
        normalized.append(word)
    return " ".join(normalized)


def parse_pubmed_query(query: str) -> dict[str, Any]:
    terms: set[str] = set()
    mesh_terms: set[str] = set()
    tiab_terms: set[str] = set()
    for field_match in re.finditer(r"\[(Mesh|tiab)\]", query, re.IGNORECASE):
        prefix = query[: field_match.start()].rstrip()
        if prefix.endswith('"'):
            start = prefix.rfind('"', 0, len(prefix) - 1)
            raw_term = prefix[start + 1 : -1]
        else:
            raw_term = re.split(r"[()]|\b(?:AND|OR|NOT)\b", prefix, flags=re.IGNORECASE)[-1]
        term = normalize_term(raw_term.strip())
        if not term:
            raise ValueError(f"검색식 용어를 해석하지 못했습니다: ...{prefix[-80:]}")
        field = field_match.group(1).casefold()
        terms.add(term)
        (mesh_terms if field == "mesh" else tiab_terms).add(term)
    if not terms:
        raise ValueError("PubMed 검색식에서 [Mesh]/[tiab] 용어를 찾지 못했습니다.")
    return {
        "normalized_terms": sorted(terms),
        "normalized_term_count": len(terms),
        "mesh_used": bool(mesh_terms),
        "mesh_terms": sorted(mesh_terms),
        "mesh_term_count": len(mesh_terms),
        "tiab_terms": sorted(tiab_terms),
        "tiab_term_count": len(tiab_terms),
    }


def read_pmids(path: Path) -> set[str]:
    values = {line.strip() for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()}
    invalid = sorted(value for value in values if not value.isdigit())
    if invalid:
        raise ValueError(f"숫자가 아닌 PMID가 있습니다: {path}: {invalid[:3]}")
    return values


def load_v2_track(inventory: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    inventory.append(inventory_entry(V2_SEARCH_MANIFEST, "v2_row_level_search_manifest"))
    inventory.append(inventory_entry(V2_PROTOCOL, "v2_question_definitions"))
    with V2_SEARCH_MANIFEST.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = [
            row
            for row in csv.DictReader(handle)
            if row["database"].casefold() == "pubmed"
            and row["status"] == "final_public_source_search"
            and row["question_id"] in V2_QUESTION_IDS
        ]
    if len(rows) != len(V2_QUESTION_IDS) or {row["question_id"] for row in rows} != set(V2_QUESTION_IDS):
        raise ValueError("v2 검색 manifest에서 질문별 최종 PubMed 실행 5개를 고유하게 찾지 못했습니다.")

    track: dict[str, dict[str, Any]] = {}
    for row in sorted(rows, key=lambda item: V2_QUESTION_IDS.index(item["question_id"])):
        question_id = row["question_id"]
        query_path = ROOT / row["query_file"]
        raw_dir = ROOT / row["raw_file"]
        ids_path = raw_dir / "ids.txt"
        metadata_path = raw_dir / "response_metadata.json"
        inventory.extend(
            [
                inventory_entry(query_path, f"v2_{question_id}_pubmed_query"),
                inventory_entry(ids_path, f"v2_{question_id}_retrieved_pmids"),
                inventory_entry(metadata_path, f"v2_{question_id}_response_metadata"),
            ]
        )
        actual_query_sha = sha256_file(query_path)
        if actual_query_sha != row["query_sha256"]:
            raise ValueError(f"{question_id} query SHA-256 불일치")
        metadata = read_json(metadata_path)
        pmids = read_pmids(ids_path)
        hit_count = int(row["total_hits_reported"])
        retrieved_count = int(row["records_exported"])
        if hit_count != int(metadata["total_hits_reported"]):
            raise ValueError(f"{question_id} hit 수가 search manifest와 response metadata에서 다릅니다.")
        if retrieved_count != int(metadata["records_exported"]) or retrieved_count != len(pmids):
            raise ValueError(f"{question_id} retrieved 수가 manifest, metadata, ids.txt에서 다릅니다.")
        query = query_path.read_text(encoding="utf-8-sig").strip()
        track[question_id] = {
            "question_id": question_id,
            "run_id": row["search_run_id"],
            "query_path": rel(query_path),
            "query_sha256": actual_query_sha,
            "hit_count": hit_count,
            "retrieved_count": retrieved_count,
            "unique_pmid_count": len(pmids),
            "pmids": pmids,
            "query_features": parse_pubmed_query(query),
        }
    return track


def load_v3_track(inventory: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    inventory.extend(
        [
            inventory_entry(V3_CORPUS_MANIFEST, "v3_corpus_and_search_manifest"),
            inventory_entry(V3_PICOS, "v3_ai_question_definitions_and_queries"),
            inventory_entry(V3_CORPUS, "v3_retrieved_record_corpus"),
        ]
    )
    manifest = read_json(V3_CORPUS_MANIFEST)
    if sha256_file(V3_PICOS) != manifest["picos"]["sha256"]:
        raise ValueError("v3 PICOS SHA-256이 corpus manifest와 다릅니다.")
    if sha256_file(V3_CORPUS) != manifest["corpus"]["sha256"]:
        raise ValueError("v3 corpus SHA-256이 corpus manifest와 다릅니다.")

    pmids_by_question = {question_id: set() for question_id in V3_QUESTION_IDS}
    row_count = 0
    with V3_CORPUS.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            row_count += 1
            question_id = row["question_id"]
            if question_id not in pmids_by_question:
                raise ValueError(f"v3 corpus의 알 수 없는 question_id: {question_id}")
            provider_id = row["provider_id"].strip()
            if not provider_id.isdigit():
                raise ValueError(f"v3 corpus의 숫자가 아닌 PubMed provider_id: {provider_id}")
            pmids_by_question[question_id].add(provider_id)
    if row_count != int(manifest["corpus"]["row_count"]):
        raise ValueError("v3 corpus 행 수가 corpus manifest와 다릅니다.")

    picos = parse_v3_questions(V3_PICOS)
    runs = {run["question_id"]: run for run in manifest["search"]["question_runs"]}
    if set(runs) != set(V3_QUESTION_IDS):
        raise ValueError("v3 manifest의 질문별 검색 실행 집합이 PICOS 질문과 다릅니다.")

    track: dict[str, dict[str, Any]] = {}
    for question_id in V3_QUESTION_IDS:
        run = runs[question_id]
        query_path = ROOT / run["raw_path"] / "query.txt"
        inventory.append(inventory_entry(query_path, f"v3_{question_id}_pubmed_query"))
        actual_query_sha = sha256_query_text(query_path)
        if actual_query_sha != run["query_sha256"]:
            raise ValueError(f"{question_id} query SHA-256 불일치")
        pmids = pmids_by_question[question_id]
        retrieved_count = int(run["retrieved_count"])
        if retrieved_count != len(pmids):
            raise ValueError(f"{question_id} retrieved 수가 manifest와 corpus에서 다릅니다.")
        query = query_path.read_text(encoding="utf-8-sig").strip()
        if query != picos[question_id]["pubmed_query"]:
            raise ValueError(f"{question_id} query.txt와 PICOS pubmed_query가 다릅니다.")
        track[question_id] = {
            "question_id": question_id,
            "run_id": run["run_id"],
            "query_path": rel(query_path),
            "query_sha256": actual_query_sha,
            "hit_count": int(run["hit_count"]),
            "retrieved_count": retrieved_count,
            "unique_pmid_count": len(pmids),
            "pmids": pmids,
            "query_features": parse_pubmed_query(query),
        }
    return track, manifest


def set_comparison(v2_pmids: set[str], v3_pmids: set[str], include_ids: bool = False) -> dict[str, Any]:
    intersection = v2_pmids & v3_pmids
    v2_only = v2_pmids - v3_pmids
    v3_only = v3_pmids - v2_pmids
    result: dict[str, Any] = {
        "intersection_count": len(intersection),
        "v2_only_count": len(v2_only),
        "v3_only_count": len(v3_only),
        "intersection_pmids_sha256": sha256_values(intersection),
        "v2_only_pmids_sha256": sha256_values(v2_only),
        "v3_only_pmids_sha256": sha256_values(v3_only),
    }
    if include_ids:
        result.update(
            {
                "intersection_pmids": sorted(intersection, key=int),
                "v2_only_pmids": sorted(v2_only, key=int),
                "v3_only_pmids": sorted(v3_only, key=int),
            }
        )
    return result


def term_comparison(v2_features: dict[str, Any], v3_features: dict[str, Any]) -> dict[str, Any]:
    v2_terms = set(v2_features["normalized_terms"])
    v3_terms = set(v3_features["normalized_terms"])
    intersection = v2_terms & v3_terms
    union = v2_terms | v3_terms
    return {
        "normalized_term_jaccard": len(intersection) / len(union) if union else 1.0,
        "intersection_term_count": len(intersection),
        "union_term_count": len(union),
        "intersection_terms": sorted(intersection),
        "v2_only_terms": sorted(v2_terms - v3_terms),
        "v3_only_terms": sorted(v3_terms - v2_terms),
        "v2_mesh_used": v2_features["mesh_used"],
        "v3_mesh_used": v3_features["mesh_used"],
        "mesh_term_intersection": sorted(
            set(v2_features["mesh_terms"]) & set(v3_features["mesh_terms"])
        ),
    }


def public_track_summary(track: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "question_count": len(track),
        "sum_of_question_hit_counts": sum(item["hit_count"] for item in track.values()),
        "sum_of_question_retrieved_counts": sum(item["retrieved_count"] for item in track.values()),
        "unique_pmid_count": len(set().union(*(item["pmids"] for item in track.values()))),
        "questions": [
            {
                key: value
                for key, value in track[question_id].items()
                if key != "pmids"
            }
            for question_id in track
        ],
    }


def build_report() -> dict[str, Any]:
    inventory: list[dict[str, Any]] = []
    v2_questions = parse_v2_questions(V2_PROTOCOL)
    v3_questions = parse_v3_questions(V3_PICOS)
    v2_track = load_v2_track(inventory)
    v3_track, v3_manifest = load_v3_track(inventory)

    pairwise: list[dict[str, Any]] = []
    pair_index: dict[tuple[str, str], dict[str, Any]] = {}
    for v3_id in V3_QUESTION_IDS:
        for v2_id in V2_QUESTION_IDS:
            result = {
                "v3_question_id": v3_id,
                "v2_question_id": v2_id,
                "v3_hit_count": v3_track[v3_id]["hit_count"],
                "v2_hit_count": v2_track[v2_id]["hit_count"],
                "query_comparison": term_comparison(
                    v2_track[v2_id]["query_features"], v3_track[v3_id]["query_features"]
                ),
                "pmid_comparison": set_comparison(
                    v2_track[v2_id]["pmids"], v3_track[v3_id]["pmids"]
                ),
            }
            pairwise.append(result)
            pair_index[(v3_id, v2_id)] = result

    question_coverage: list[dict[str, Any]] = []
    covered_v2: set[str] = set()
    for v3_id in V3_QUESTION_IDS:
        assessment = SCOPE_ASSESSMENTS[v3_id]
        v3_item = v3_questions[v3_id]
        scope_text = " ".join(str(v3_item.get(key, "")) for key in ("question", "P", "I", "C", "O"))
        absent_required = [term for term in assessment["required_v3_text"] if term not in scope_text]
        if absent_required:
            raise ValueError(f"{v3_id} scope 평가 전제 용어 누락: {absent_required}")
        covered_ids = assessment["covered_legacy_question_ids"]
        covered_v2.update(covered_ids)
        closest = max(
            V2_QUESTION_IDS,
            key=lambda v2_id: pair_index[(v3_id, v2_id)]["query_comparison"][
                "normalized_term_jaccard"
            ],
        )
        question_coverage.append(
            {
                "v3_question_id": v3_id,
                "v3_question": v3_item["question"],
                "status": assessment["status"],
                "covered_legacy_question_ids": covered_ids,
                "explicit_noncoverage_question_ids": assessment[
                    "explicit_noncoverage_question_ids"
                ],
                "rationale": assessment["rationale"],
                "v3_scope_evidence": {
                    key: v3_item[key] for key in ("P", "I", "C", "O")
                },
                "covered_legacy_scope_evidence": [v2_questions[v2_id] for v2_id in covered_ids],
                "mapped_search_and_result_comparisons": [
                    pair_index[(v3_id, v2_id)] for v2_id in covered_ids
                ],
                "closest_query_by_normalized_term_jaccard": {
                    "v2_question_id": closest,
                    "normalized_term_jaccard": pair_index[(v3_id, closest)][
                        "query_comparison"
                    ]["normalized_term_jaccard"],
                    "note": "검색식 용어 유사도는 질문 포괄 판정이 아니라 기술 비교값이다.",
                },
            }
        )

    v2_union = set().union(*(item["pmids"] for item in v2_track.values()))
    v3_union = set().union(*(item["pmids"] for item in v3_track.values()))
    v2_term_union = set().union(
        *(set(item["query_features"]["normalized_terms"]) for item in v2_track.values())
    )
    v3_term_union = set().union(
        *(set(item["query_features"]["normalized_terms"]) for item in v3_track.values())
    )
    track_term_union = v2_term_union | v3_term_union

    return {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "comparison": "v2_A1_B3_vs_v3_HRS1_HRS5",
        "method": {
            "manifest_basis": {
                "v2": rel(V2_SEARCH_MANIFEST),
                "v2_row_filter": {
                    "database": "PubMed",
                    "status": "final_public_source_search",
                },
                "v3": rel(V3_CORPUS_MANIFEST),
            },
            "query_term_normalization": (
                "[Mesh]와 [tiab] 바로 앞 원자 용어를 소문자화하고 와일드카드·구두점을 제거한 "
                "뒤 영문 복수형을 단수화했다. Jaccard는 정규화 용어 집합의 교집합 크기를 "
                "합집합 크기로 나눈 값이다."
            ),
            "pmid_basis": {
                "v2": "각 search manifest 행이 가리키는 ids.txt의 전체 PMID",
                "v3": "corpus manifest가 해시로 고정한 evidence_map.csv의 question_id별 provider_id",
            },
            "question_scope_assessment": (
                "프로토콜의 P/I/C/O와 AI PICOS의 P/I/C/O를 직접 대조했다. 검색식 Jaccard와 "
                "PMID 교집합은 포괄 판정의 대체값으로 사용하지 않았다."
            ),
        },
        "input_inventory": inventory,
        "integrity_checks": {
            "v2_final_pubmed_run_count": len(v2_track),
            "v2_query_hashes_match_search_manifest": True,
            "v2_retrieved_counts_match_ids_files": True,
            "v3_picos_hash_matches_corpus_manifest": True,
            "v3_corpus_hash_matches_corpus_manifest": True,
            "v3_query_hashes_match_corpus_manifest": True,
            "v3_corpus_row_count_matches_manifest": True,
            "v3_manifest_status": v3_manifest["status"],
        },
        "question_level_coverage": {
            "assessments": question_coverage,
            "covered_legacy_question_ids": sorted(covered_v2),
            "uncovered_legacy_question_ids": sorted(set(V2_QUESTION_IDS) - covered_v2),
            "finding": (
                "HRS5가 A1·A2를 상위 항응고제 질문으로 포괄한다. HRS2는 신장 영역이지만 "
                "만성콩팥병·투석과 신결석의 Population·Outcome이 달라 B1·B2·B3를 포괄하지 않는다."
            ),
        },
        "search_strategy_level": {
            "v2_question_features": {
                question_id: v2_track[question_id]["query_features"]
                for question_id in V2_QUESTION_IDS
            },
            "v3_question_features": {
                question_id: v3_track[question_id]["query_features"]
                for question_id in V3_QUESTION_IDS
            },
            "track_union": {
                "v2_normalized_term_count": len(v2_term_union),
                "v3_normalized_term_count": len(v3_term_union),
                "intersection_term_count": len(v2_term_union & v3_term_union),
                "union_term_count": len(track_term_union),
                "normalized_term_jaccard": (
                    len(v2_term_union & v3_term_union) / len(track_term_union)
                    if track_term_union
                    else 1.0
                ),
                "intersection_terms": sorted(v2_term_union & v3_term_union),
                "v2_only_terms": sorted(v2_term_union - v3_term_union),
                "v3_only_terms": sorted(v3_term_union - v2_term_union),
                "v2_questions_using_mesh": [
                    question_id
                    for question_id in V2_QUESTION_IDS
                    if v2_track[question_id]["query_features"]["mesh_used"]
                ],
                "v3_questions_using_mesh": [
                    question_id
                    for question_id in V3_QUESTION_IDS
                    if v3_track[question_id]["query_features"]["mesh_used"]
                ],
            },
            "all_question_pairs": pairwise,
        },
        "result_level": {
            "v2_track": public_track_summary(v2_track),
            "v3_track": public_track_summary(v3_track),
            "track_union_pmid_comparison": set_comparison(v2_union, v3_union, include_ids=True),
            "all_question_pairs": [
                {
                    "v3_question_id": item["v3_question_id"],
                    "v2_question_id": item["v2_question_id"],
                    "v3_hit_count": item["v3_hit_count"],
                    "v2_hit_count": item["v2_hit_count"],
                    **item["pmid_comparison"],
                }
                for item in pairwise
            ],
        },
    }


def validate_report(report: dict[str, Any]) -> None:
    inventory_paths = [item["path"] for item in report["input_inventory"]]
    if len(inventory_paths) != len(set(inventory_paths)):
        raise ValueError("input_inventory에 중복 경로가 있습니다.")
    coverage = report["question_level_coverage"]
    assessed_ids = [item["v3_question_id"] for item in coverage["assessments"]]
    if tuple(assessed_ids) != V3_QUESTION_IDS:
        raise ValueError("모든 v3 질문에 대한 포괄 판정이 없습니다.")
    covered = set(coverage["covered_legacy_question_ids"])
    uncovered = set(coverage["uncovered_legacy_question_ids"])
    if covered | uncovered != set(V2_QUESTION_IDS) or covered & uncovered:
        raise ValueError("기존 질문 covered/uncovered 분할이 완전하지 않습니다.")
    result = report["result_level"]["track_union_pmid_comparison"]
    if result["intersection_count"] != len(result["intersection_pmids"]):
        raise ValueError("교집합 PMID 개수 불일치")
    if result["v2_only_count"] != len(result["v2_only_pmids"]):
        raise ValueError("v2-only PMID 개수 불일치")
    if result["v3_only_count"] != len(result["v3_only_pmids"]):
        raise ValueError("v3-only PMID 개수 불일치")
    partitions = [
        set(result["intersection_pmids"]),
        set(result["v2_only_pmids"]),
        set(result["v3_only_pmids"]),
    ]
    if any(partitions[i] & partitions[j] for i in range(3) for j in range(i + 1, 3)):
        raise ValueError("PMID 교집합/v2-only/v3-only 분할이 서로 겹칩니다.")
    for pair in report["search_strategy_level"]["all_question_pairs"]:
        value = pair["query_comparison"]["normalized_term_jaccard"]
        if not 0.0 <= value <= 1.0:
            raise ValueError("Jaccard 값이 0~1 범위를 벗어났습니다.")


def main() -> None:
    report = build_report()
    validate_report(report)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": rel(OUTPUT),
                "sha256": sha256_file(OUTPUT),
                "covered_legacy_question_ids": report["question_level_coverage"][
                    "covered_legacy_question_ids"
                ],
                "uncovered_legacy_question_ids": report["question_level_coverage"][
                    "uncovered_legacy_question_ids"
                ],
                "track_union_pmid_counts": {
                    key: report["result_level"]["track_union_pmid_comparison"][key]
                    for key in ("intersection_count", "v2_only_count", "v3_only_count")
                },
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
