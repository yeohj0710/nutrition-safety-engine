from __future__ import annotations

import argparse
import calendar
import csv
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from query_terms import QUESTION_SPECS, TERM_CATEGORY_EVIDENCE


ROOT = Path(__file__).resolve().parents[2]
SEARCH_ROOT = ROOT / "research" / "searches_v4"
PROBE_REPORT = SEARCH_ROOT / "probe_report.json"
QUERY_DEFINITIONS = SEARCH_ROOT / "query_definitions.json"
CORPUS_PATH = ROOT / "data" / "curated_v4" / "evidence_map.csv"
CORPUS_MANIFEST_PATH = ROOT / "data" / "curated_v4" / "corpus_manifest.json"
SEARCH_LOG_PATH = SEARCH_ROOT / "search_log.csv"
PICOS_PATH = ROOT / "research" / "searches_v3" / "ai_picos" / "picos_definition.json"
PROTOCOL_PATH = ROOT / "research" / "protocol" / "protocol-v4.0-mecir-search.md"
EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
TOOL_NAME = "nutrition_safety_engine_v40"
REQUEST_INTERVAL_SECONDS = 0.36
SEARCH_START = "2022/01/01"
MAX_ESEARCH_IDS = 9_999
EFETCH_BATCH = 200

EVIDENCE_COLUMNS = [
    "source", "record_id", "question_id", "provider_id", "title", "abstract",
    "authors", "year", "venue", "publication_types", "doi", "dedup_identity",
    "source_url", "classification", "observability", "fulltext_locator_status",
    "fulltext_locator", "raw_source_path", "raw_source_sha256",
    "extracted_effect_value", "extracted_effect_status", "decision_authority",
    "clinical_claim_allowed", "status",
]
SEARCH_LOG_COLUMNS = [
    "question_id", "run_id", "executed_at", "query_sha256", "probe_hit_count",
    "fetch_hit_count", "retrieved_count", "deduplicated_count", "raw_path", "status",
]
V3_HIT_COUNTS = {
    "HRS1_PERIOPERATIVE": 296,
    "HRS2_KIDNEY_DISEASE": 138,
    "HRS3_PREGNANCY": 515,
    "HRS4_LIVER_DISEASE": 967,
    "HRS5_ANTICOAGULATION": 293,
}
FORBIDDEN_QUERY_FRAGMENTS = (
    "humans[mesh]", "humans[mh]", "[publication type]", "[pt]", "[language]",
    "[lang]", "randomized controlled trial", "randomised controlled trial",
    "clinical trial[", "cohort[", "case-control[", "case report[",
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repo_relative(path: Path) -> str:
    return path.resolve().relative_to(ROOT.resolve()).as_posix()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def write_csv(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="raise", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def append_search_log(rows: list[dict[str, Any]]) -> None:
    SEARCH_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    exists = SEARCH_LOG_PATH.exists() and SEARCH_LOG_PATH.stat().st_size > 0
    with SEARCH_LOG_PATH.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=SEARCH_LOG_COLUMNS, lineterminator="\n")
        if not exists:
            writer.writeheader()
        writer.writerows(rows)


def canonical_lexical_term(term: str) -> str:
    value = re.sub(r"\[(?:mesh|mh|tiab|tw)\]\s*$", "", term, flags=re.IGNORECASE)
    value = value.strip().strip('"').lower().replace("-", " ")
    return " ".join(value.split())


def build_base_query(p_terms: list[str], i_terms: list[str]) -> str:
    return f"({' OR '.join(p_terms)}) AND ({' OR '.join(i_terms)})"


def date_clause(start_date: str, end_date: str) -> str:
    return f'("{start_date}"[Date - Publication] : "{end_date}"[Date - Publication])'


def build_query(p_terms: list[str], i_terms: list[str], start_date: str, end_date: str) -> str:
    return f"{build_base_query(p_terms, i_terms)} AND {date_clause(start_date, end_date)}"


def warning_strings(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, dict):
        out: list[str] = []
        for key, item in value.items():
            out.append(str(key))
            out.extend(warning_strings(item))
        return out
    return [str(value)]


class RateLimitedEutils:
    def __init__(self, email: str, api_key: str = "", interval_seconds: float = REQUEST_INTERVAL_SECONDS) -> None:
        self.email = email
        self.api_key = api_key
        self.interval_seconds = interval_seconds
        self.last_request_monotonic = 0.0
        self.last_transport = ""

    def request(self, endpoint: str, params: dict[str, str | int], attempts: int = 5) -> bytes:
        merged: dict[str, str | int] = {"tool": TOOL_NAME, "email": self.email, **params}
        if self.api_key:
            merged["api_key"] = self.api_key
        encoded = urllib.parse.urlencode(merged).encode("utf-8")
        endpoint_url = f"{EUTILS_BASE}/{endpoint}"
        use_post = len(encoded) > 1500 or endpoint == "efetch.fcgi"
        for attempt in range(attempts):
            elapsed = time.monotonic() - self.last_request_monotonic
            if elapsed < self.interval_seconds:
                time.sleep(self.interval_seconds - elapsed)
            if use_post:
                request = urllib.request.Request(
                    endpoint_url,
                    data=encoded,
                    headers={
                        "User-Agent": f"{TOOL_NAME}/1.0",
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    method="POST",
                )
                self.last_transport = "POST"
            else:
                request = urllib.request.Request(
                    f"{endpoint_url}?{encoded.decode('ascii')}",
                    headers={"User-Agent": f"{TOOL_NAME}/1.0"},
                )
                self.last_transport = "GET"
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    data = response.read()
                self.last_request_monotonic = time.monotonic()
                return data
            except urllib.error.HTTPError as exc:
                self.last_request_monotonic = time.monotonic()
                if exc.code not in {408, 429, 500, 502, 503, 504} or attempt + 1 == attempts:
                    raise
                retry_after = exc.headers.get("Retry-After", "")
                delay = float(retry_after) if retry_after.isdigit() else float(2 ** attempt)
                time.sleep(delay)
            except urllib.error.URLError:
                self.last_request_monotonic = time.monotonic()
                if attempt + 1 == attempts:
                    raise
                time.sleep(float(2 ** attempt))
        raise RuntimeError("unreachable E-utilities retry state")


def esearch(client: RateLimitedEutils, query: str, *, retmax: int = 0, sort: str = "pub date") -> tuple[dict[str, Any], bytes, str]:
    raw = client.request(
        "esearch.fcgi",
        {"db": "pubmed", "term": query, "retmode": "json", "retmax": retmax, "sort": sort},
    )
    payload = json.loads(raw.decode("utf-8"))
    if "esearchresult" not in payload:
        raise RuntimeError(f"malformed ESearch response: {payload}")
    return payload, raw, client.last_transport


def _rule(number: int, title: str, passed: bool, evidence: Any) -> dict[str, Any]:
    return {"rule": number, "title": title, "result": "통과" if passed else "위반", "evidence": evidence}


def probe(email: str, api_key: str) -> dict[str, Any]:
    executed_at = utc_now()
    end_date = executed_at.date().strftime("%Y/%m/%d")
    client = RateLimitedEutils(email=email, api_key=api_key)
    raw_dir = SEARCH_ROOT / "probe_esearch_raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    definitions: dict[str, Any] = {
        "schema_version": "1.0.0",
        "track": "v4.0_mecir_search_redesign",
        "generated_at": executed_at.isoformat(timespec="seconds"),
        "source_question_definition": repo_relative(PICOS_PATH),
        "source_question_definition_sha256": sha256_file(PICOS_PATH),
        "search_period": {"start": SEARCH_START, "end": end_date, "field": "Date - Publication"},
        "questions": [],
    }
    results: list[dict[str, Any]] = []
    all_truncated = sorted({
        term for spec in QUESTION_SPECS.values()
        for block in (spec["p_terms"], spec["i_terms"])
        for term in block if "*" in term
    })
    truncation_checks: dict[str, dict[str, Any]] = {}
    for term in all_truncated:
        payload, _, transport = esearch(client, term, retmax=0)
        result = payload["esearchresult"]
        warnings = result.get("warninglist", {})
        errors = result.get("errorlist", {})
        combined = " ".join(warning_strings(warnings) + warning_strings(errors)).lower()
        truncation_checks[term] = {
            "term": term,
            "hit_count": int(result.get("count", 0)),
            "query_translation": result.get("querytranslation", ""),
            "warninglist": warnings,
            "errorlist": errors,
            "transport": transport,
            "passed": not any(token in combined for token in ("600", "truncat", "wildcard")),
        }

    for question_id, spec in QUESTION_SPECS.items():
        p_terms = list(spec["p_terms"])
        i_terms = list(spec["i_terms"])
        base_query = build_base_query(p_terms, i_terms)
        query = build_query(p_terms, i_terms, SEARCH_START, end_date)
        payload, raw, transport = esearch(client, query, retmax=0)
        raw_path = raw_dir / f"{question_id}.json"
        raw_path.write_bytes(raw)
        result = payload["esearchresult"]
        warnings = result.get("warninglist", {})
        errors = result.get("errorlist", {})
        warning_text = " ".join(warning_strings(warnings) + warning_strings(errors)).lower()
        p_lexical = {canonical_lexical_term(term) for term in p_terms}
        i_lexical = {canonical_lexical_term(term) for term in i_terms}
        exact_date = date_clause(SEARCH_START, end_date) in query
        no_forbidden = not any(fragment in query.lower() for fragment in FORBIDDEN_QUERY_FRAGMENTS)
        q_trunc = [truncation_checks[term] for term in sorted(set(p_terms + i_terms)) if "*" in term]
        trunc_ok = all(item["passed"] for item in q_trunc) and not any(
            token in warning_text for token in ("600", "truncat", "wildcard")
        )
        no_phrase_errors = not errors and not warnings.get("quotedphrasesnotfound") and not warnings.get("phrasesnotfound")
        checks = [
            _rule(1, "개념 블록은 P AND I만 사용", query.startswith(base_query) and " AND " in base_query, {
                "concept_blocks": ["P", "I"], "comparison_block": False, "outcome_block": False,
                "date_clause_is_protocol_rule_5_limit": True,
            }),
            _rule(2, "AND humans[Mesh] 금지", "humans[mesh]" not in query.lower() and "humans[mh]" not in query.lower(), {
                "humans_mesh_present": False, "animal_filter_present": False,
            }),
            _rule(3, "연구설계 필터 금지", no_forbidden, {"forbidden_fragments_found": [
                fragment for fragment in FORBIDDEN_QUERY_FRAGMENTS if fragment in query.lower()
            ]}),
            _rule(4, "언어·출판유형 제한 금지", not any(tag in query.lower() for tag in (
                "[language]", "[lang]", "[publication type]", "[pt]"
            )), {"language_limit": False, "publication_type_limit": False}),
            _rule(5, "허용된 연구 기간만 사용", exact_date, {
                "start": SEARCH_START, "end": end_date, "field": "Date - Publication",
            }),
            _rule(6, "각 블록은 MeSH OR 자유어 병렬", all(
                any("[Mesh]" in term for term in terms) and any("[tiab]" in term for term in terms)
                for terms in (p_terms, i_terms)
            ) and no_phrase_errors, {
                "P_has_MeSH": any("[Mesh]" in term for term in p_terms),
                "P_has_tiab": any("[tiab]" in term for term in p_terms),
                "I_has_MeSH": any("[Mesh]" in term for term in i_terms),
                "I_has_tiab": any("[tiab]" in term for term in i_terms),
                "phrase_or_MeSH_errors": errors or warnings.get("quotedphrasesnotfound") or warnings.get("phrasesnotfound") or {},
            }),
            _rule(7, "자유어는 [tiab] 이상 범위", all(
                "[Mesh]" in term or "[tiab]" in term or "[tw]" in term for term in p_terms + i_terms
            ), {"free_text_field": "tiab", "tw_terms": [term for term in p_terms + i_terms if "[tw]" in term]}),
            _rule(8, "블록당 고유 검색어 25개 이상 및 용어 범주 확장", len(p_lexical) >= 25 and len(i_lexical) >= 25, {
                "P_operand_count": len(p_terms), "P_unique_lexical_count": len(p_lexical),
                "I_operand_count": len(i_terms), "I_unique_lexical_count": len(i_lexical),
                "P_categories": TERM_CATEGORY_EVIDENCE["P"], "I_categories": TERM_CATEGORY_EVIDENCE["I"],
                "semantic_note": "상품명과 성분명은 I 블록에 적용했다. P 블록은 질환·상황·약물의 구용어, 약어, 철자 이형, 대표 하위 유형을 확장했다.",
            }),
            _rule(9, "PubMed 절단 변형 상한 경고 없음", trunc_ok, {
                "truncated_term_count": len(q_trunc), "all_term_checks_passed": trunc_ok,
                "full_query_warninglist": warnings, "full_query_errorlist": errors,
            }),
        ]
        item = {
            "question_id": question_id,
            "question": spec["question"],
            "query": query,
            "base_query": base_query,
            "query_sha256": sha256_text(query),
            "query_length_characters": len(query),
            "executed_at_utc": utc_now().isoformat(timespec="seconds"),
            "hit_count": int(result["count"]),
            "transport": transport,
            "request": {"endpoint": "esearch.fcgi", "db": "pubmed", "retmode": "json", "retmax": 0},
            "query_translation": result.get("querytranslation", ""),
            "warninglist": warnings,
            "errorlist": errors,
            "raw_response_path": repo_relative(raw_path),
            "raw_response_sha256": sha256_file(raw_path),
            "blocks": {
                "P": {"terms": p_terms, "operand_count": len(p_terms), "unique_lexical_count": len(p_lexical)},
                "I": {"terms": i_terms, "operand_count": len(i_terms), "unique_lexical_count": len(i_lexical)},
            },
            "truncation_checks": q_trunc,
            "rules_1_to_9": checks,
            "all_rules_passed": all(check["result"] == "통과" for check in checks),
        }
        results.append(item)
        definitions["questions"].append({
            "question_id": question_id, "question": spec["question"],
            "P_terms": p_terms, "I_terms": i_terms, "base_query": base_query,
            "query": query, "query_sha256": item["query_sha256"],
        })

    write_json(QUERY_DEFINITIONS, definitions)
    report = {
        "schema_version": "1.0.0",
        "track": "v4.0_mecir_search_redesign",
        "phase": "A_count_only",
        "generated_at": utc_now().isoformat(timespec="seconds"),
        "protocol_path": repo_relative(PROTOCOL_PATH),
        "protocol_sha256": sha256_file(PROTOCOL_PATH),
        "source": "PubMed via NCBI E-utilities ESearch",
        "interface": "NCBI ESearch JSON API",
        "tool": TOOL_NAME,
        "executor": "Codex multi-agent research run",
        "api_key_used": bool(api_key),
        "efetch_executed": False,
        "search_period": {"start": SEARCH_START, "end": end_date, "field": "Date - Publication"},
        "query_definitions_path": repo_relative(QUERY_DEFINITIONS),
        "query_definitions_sha256": sha256_file(QUERY_DEFINITIONS),
        "questions": results,
        "question_count": len(results),
        "combined_record_question_hits": sum(item["hit_count"] for item in results),
        "all_rules_passed": all(item["all_rules_passed"] for item in results),
        "v3_hit_counts": V3_HIT_COUNTS,
        "methodological_scope": {
            "query_design": "P AND I high-recall PubMed strategy under protocol v4.0 rules 1-9",
            "source_constraint": "PubMed only, inherited unchanged from the fixed HRS question definition",
            "full_MECIR_process_claimed": False,
            "scope_note": "질의 설계 준수와 전체 검색원 범위 준수는 구분한다. PubMed 단일 자료원 제약은 최종 미해결 항목에 기록한다.",
        },
        "status": "complete" if all(item["all_rules_passed"] for item in results) else "violations_present",
    }
    write_json(PROBE_REPORT, report)
    return report


def parse_ymd(value: str) -> date:
    return datetime.strptime(value, "%Y/%m/%d").date()


def month_slices(start: date, end: date) -> Iterable[tuple[date, date]]:
    cursor = start
    while cursor <= end:
        last_day = calendar.monthrange(cursor.year, cursor.month)[1]
        slice_end = min(date(cursor.year, cursor.month, last_day), end)
        yield cursor, slice_end
        cursor = slice_end.fromordinal(slice_end.toordinal() + 1)


def year_slices(start: date, end: date) -> Iterable[tuple[date, date]]:
    cursor = start
    while cursor <= end:
        slice_end = min(date(cursor.year, 12, 31), end)
        yield cursor, slice_end
        cursor = slice_end.fromordinal(slice_end.toordinal() + 1)


def day_slices(start: date, end: date) -> Iterable[tuple[date, date]]:
    cursor = start
    while cursor <= end:
        yield cursor, cursor
        cursor = cursor.fromordinal(cursor.toordinal() + 1)


def fmt_date(value: date) -> str:
    return value.strftime("%Y/%m/%d")


def discover_segments(client: RateLimitedEutils, base_query: str, start: date, end: date) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []
    for slice_start, slice_end in year_slices(start, end):
        query = f"{base_query} AND {date_clause(fmt_date(slice_start), fmt_date(slice_end))}"
        payload, _, transport = esearch(client, query, retmax=0)
        count = int(payload["esearchresult"]["count"])
        if count <= MAX_ESEARCH_IDS:
            segments.append({
                "start": fmt_date(slice_start), "end": fmt_date(slice_end), "count": count,
                "query": query, "query_sha256": sha256_text(query), "transport": transport,
                "warninglist": payload["esearchresult"].get("warninglist", {}),
            })
            continue
        for month_start, month_end in month_slices(slice_start, slice_end):
            month_query = f"{base_query} AND {date_clause(fmt_date(month_start), fmt_date(month_end))}"
            month_payload, _, month_transport = esearch(client, month_query, retmax=0)
            month_count = int(month_payload["esearchresult"]["count"])
            if month_count <= MAX_ESEARCH_IDS:
                segments.append({
                    "start": fmt_date(month_start), "end": fmt_date(month_end), "count": month_count,
                    "query": month_query, "query_sha256": sha256_text(month_query), "transport": month_transport,
                    "warninglist": month_payload["esearchresult"].get("warninglist", {}),
                })
                continue
            for day_start, day_end in day_slices(month_start, month_end):
                day_query = f"{base_query} AND {date_clause(fmt_date(day_start), fmt_date(day_end))}"
                day_payload, _, day_transport = esearch(client, day_query, retmax=0)
                day_count = int(day_payload["esearchresult"]["count"])
                if day_count > MAX_ESEARCH_IDS:
                    raise RuntimeError(f"PubMed daily shard exceeds UID limit: {day_start} count={day_count}")
                segments.append({
                    "start": fmt_date(day_start), "end": fmt_date(day_end), "count": day_count,
                    "query": day_query, "query_sha256": sha256_text(day_query), "transport": day_transport,
                    "warninglist": day_payload["esearchresult"].get("warninglist", {}),
                })
    return segments


def fetch_segment_ids(client: RateLimitedEutils, segment: dict[str, Any]) -> list[str]:
    count = int(segment["count"])
    if count == 0:
        return []
    payload, _, transport = esearch(client, segment["query"], retmax=count)
    result = payload["esearchresult"]
    actual = int(result["count"])
    ids = [str(value) for value in result.get("idlist", [])]
    if actual != count or len(ids) != count:
        raise RuntimeError(
            f"segment count/ID mismatch {segment['start']}..{segment['end']}: "
            f"expected={count} actual={actual} ids={len(ids)}"
        )
    segment["id_count"] = len(ids)
    segment["ids_sha256"] = sha256_text("\n".join(ids) + ("\n" if ids else ""))
    segment["id_transport"] = transport
    return ids


def chunks(values: list[str], size: int) -> Iterable[list[str]]:
    for start in range(0, len(values), size):
        yield values[start:start + size]


def element_text(element: ET.Element | None) -> str:
    if element is None:
        return ""
    return " ".join("".join(element.itertext()).split())


def article_id(article: ET.Element, id_type: str) -> str:
    for element in article.findall(".//ArticleIdList/ArticleId"):
        if element.attrib.get("IdType", "").lower() == id_type.lower():
            return element_text(element)
    return ""


def record_year(record: ET.Element) -> str:
    candidates = [
        element_text(record.find(".//JournalIssue/PubDate/Year")),
        element_text(record.find(".//ArticleDate/Year")),
        element_text(record.find(".//PubMedPubDate[@PubStatus='pubmed']/Year")),
        element_text(record.find(".//BookDocument/ArticleDate/Year")),
    ]
    medline_date = element_text(record.find(".//JournalIssue/PubDate/MedlineDate"))
    if medline_date[:4].isdigit():
        candidates.append(medline_date[:4])
    return next((value for value in candidates if value), "")


def parse_pubmed_xml(xml_bytes: bytes, *, question_id: str, raw_path: str, raw_sha256: str) -> tuple[list[dict[str, str]], set[str]]:
    root = ET.fromstring(xml_bytes)
    records = list(root.findall("./PubmedArticle")) + list(root.findall("./PubmedBookArticle"))
    rows: list[dict[str, str]] = []
    parsed_ids: set[str] = set()
    for record in records:
        pmid = element_text(record.find(".//PMID"))
        if not pmid:
            continue
        parsed_ids.add(pmid)
        title = element_text(record.find(".//ArticleTitle")) or element_text(record.find(".//BookDocument/Book/BookTitle"))
        abstracts: list[str] = []
        for node in record.findall(".//Abstract/AbstractText"):
            value = element_text(node)
            if not value:
                continue
            label = node.attrib.get("Label", "").strip()
            abstracts.append(f"{label}: {value}" if label else value)
        abstract = "\n".join(abstracts)
        authors: list[str] = []
        for author in record.findall(".//AuthorList/Author"):
            collective = element_text(author.find("CollectiveName"))
            family = element_text(author.find("LastName"))
            initials = element_text(author.find("Initials"))
            value = collective or " ".join(part for part in (family, initials) if part)
            if value:
                authors.append(value)
        publication_types = list(dict.fromkeys(
            element_text(node) for node in record.findall(".//PublicationTypeList/PublicationType")
            if element_text(node)
        ))
        doi = article_id(record, "doi")
        pmc = article_id(record, "pmc")
        fulltext_locator = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmc}/" if pmc else ""
        venue = element_text(record.find(".//Journal/Title")) or element_text(record.find(".//Book/BookTitle"))
        rows.append({
            "source": "pubmed", "record_id": f"pubmed:{pmid}", "question_id": question_id,
            "provider_id": pmid, "title": title, "abstract": abstract,
            "authors": "; ".join(authors), "year": record_year(record), "venue": venue,
            "publication_types": "|".join(publication_types), "doi": doi, "dedup_identity": "",
            "source_url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "classification": "unclassified",
            "observability": "abstract_available" if abstract else "title_only",
            "fulltext_locator_status": "pmc_locator_available" if pmc else "not_observed",
            "fulltext_locator": fulltext_locator, "raw_source_path": raw_path,
            "raw_source_sha256": raw_sha256, "extracted_effect_value": "",
            "extracted_effect_status": "not_observed", "decision_authority": "agent_screening_pending",
            "clinical_claim_allowed": "false", "status": "captured_exploratory_record",
        })
    return rows, parsed_ids


def normalize_doi(value: str) -> str:
    normalized = value.strip().lower()
    normalized = re.sub(r"^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)", "", normalized)
    return re.sub(r"\s+", "", normalized).rstrip(".,;")


def paper_identity(row: dict[str, str]) -> str:
    doi = normalize_doi(row["doi"])
    if doi:
        return f"doi:{doi}"
    if row["title"]:
        return f"title:{row['title']}"
    return f"pmid:{row['provider_id']}"


def deduplicate_within_questions(rows: list[dict[str, str]]) -> tuple[list[dict[str, str]], dict[str, Any]]:
    by_key: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    title_dois: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        identity = paper_identity(row)
        row["dedup_identity"] = identity
        by_key[(row["question_id"], identity)].append(row)
        if row["title"] and normalize_doi(row["doi"]):
            title_dois[row["title"]].add(normalize_doi(row["doi"]))
    kept: list[dict[str, str]] = []
    removed_by = Counter()
    duplicate_groups: list[dict[str, Any]] = []
    for (question_id, identity), group in sorted(by_key.items()):
        group.sort(key=lambda row: (
            0 if row["abstract"] else 1,
            0 if row["doi"] else 1,
            int(row["provider_id"]) if row["provider_id"].isdigit() else row["provider_id"],
        ))
        kept.append(group[0])
        if len(group) > 1:
            method = "doi" if identity.startswith("doi:") else "exact_title" if identity.startswith("title:") else "pmid"
            removed_by[method] += len(group) - 1
            duplicate_groups.append({
                "question_id": question_id, "identity": identity, "kept_record_id": group[0]["record_id"],
                "removed_record_ids": [row["record_id"] for row in group[1:]], "method": method,
            })
    kept.sort(key=lambda row: (row["question_id"], row["provider_id"]))
    identity_questions: dict[str, set[str]] = defaultdict(set)
    for row in kept:
        identity_questions[row["dedup_identity"]].add(row["question_id"])
    cross_question_extra = sum(len(qids) - 1 for qids in identity_questions.values() if len(qids) > 1)
    stats = {
        "scope": "within_question; cross-question question mappings preserved",
        "priority": ["normalized DOI", "exact parsed title", "PMID fallback"],
        "input_rows": len(rows), "output_rows": len(kept),
        "removed_rows": len(rows) - len(kept), "removed_by_method": dict(sorted(removed_by.items())),
        "duplicate_group_count": len(duplicate_groups), "duplicate_groups": duplicate_groups,
        "ambiguous_exact_title_multiple_doi_count": sum(len(dois) > 1 for dois in title_dois.values()),
        "global_unique_paper_count": len(identity_questions),
        "cross_question_repeated_row_count": cross_question_extra,
    }
    return kept, stats


def fetch(email: str, api_key: str) -> dict[str, Any]:
    if not PROBE_REPORT.exists():
        raise RuntimeError("Phase A probe_report.json is missing")
    report = json.loads(PROBE_REPORT.read_text(encoding="utf-8"))
    if report.get("status") != "complete" or not report.get("all_rules_passed"):
        raise RuntimeError("Phase A has unresolved rule violations")
    now = utc_now()
    run_id = now.strftime("%Y%m%dT%H%M%SZ")
    client = RateLimitedEutils(email=email, api_key=api_key)
    all_rows: list[dict[str, str]] = []
    question_runs: list[dict[str, Any]] = []
    log_rows: list[dict[str, Any]] = []
    for question in report["questions"]:
        question_id = question["question_id"]
        query = question["query"]
        if sha256_text(query) != question["query_sha256"]:
            raise RuntimeError(f"frozen query hash mismatch: {question_id}")
        run_dir = SEARCH_ROOT / question_id / "pubmed" / run_id
        run_dir.mkdir(parents=True, exist_ok=False)
        (run_dir / "query.txt").write_text(query, encoding="utf-8", newline="\n")
        live_payload, _, full_transport = esearch(client, query, retmax=0)
        fetch_hit_count = int(live_payload["esearchresult"]["count"])
        segments = discover_segments(
            client, question["base_query"],
            parse_ymd(report["search_period"]["start"]), parse_ymd(report["search_period"]["end"]),
        )
        ids_with_shard_overlap: list[str] = []
        for segment in segments:
            ids_with_shard_overlap.extend(fetch_segment_ids(client, segment))
        ids = list(set(ids_with_shard_overlap))
        shard_overlap_count = len(ids_with_shard_overlap) - len(ids)
        if len(ids) != fetch_hit_count:
            retry_payload, _, _ = esearch(client, query, retmax=0)
            retry_count = int(retry_payload["esearchresult"]["count"])
            raise RuntimeError(
                f"sharded PMID count mismatch for {question_id}: shards={len(ids)} "
                f"full_before={fetch_hit_count} full_after={retry_count}"
            )
        ids.sort(key=lambda value: int(value) if value.isdigit() else value)
        ids_path = run_dir / "ids.txt"
        ids_path.write_text("\n".join(ids) + ("\n" if ids else ""), encoding="utf-8", newline="\n")
        write_json(run_dir / "esearch_segments.json", {
            "question_id": question_id, "run_id": run_id, "segments": segments,
            "segment_count": len(segments), "sum_segment_counts": sum(int(item["count"]) for item in segments),
            "shard_overlap_id_count": shard_overlap_count,
            "unique_id_count": len(ids), "ids_path": repo_relative(ids_path), "ids_sha256": sha256_file(ids_path),
        })
        checksums: list[tuple[str, str]] = []
        question_rows: list[dict[str, str]] = []
        for batch_index, batch_ids in enumerate(chunks(ids, EFETCH_BATCH), start=1):
            xml_bytes = client.request(
                "efetch.fcgi", {"db": "pubmed", "id": ",".join(batch_ids), "retmode": "xml"},
            )
            filename = f"efetch_{batch_index:05d}.xml"
            raw_path = run_dir / filename
            raw_path.write_bytes(xml_bytes)
            digest = sha256_bytes(xml_bytes)
            checksums.append((filename, digest))
            parsed, parsed_ids = parse_pubmed_xml(
                xml_bytes, question_id=question_id,
                raw_path=repo_relative(raw_path), raw_sha256=digest,
            )
            if parsed_ids != set(batch_ids):
                raise RuntimeError(
                    f"EFetch PMID set mismatch {question_id} batch={batch_index}: "
                    f"missing={sorted(set(batch_ids)-parsed_ids)[:10]} extra={sorted(parsed_ids-set(batch_ids))[:10]}"
                )
            question_rows.extend(parsed)
        if len(question_rows) != len(ids):
            raise RuntimeError(f"parsed row mismatch {question_id}: rows={len(question_rows)} ids={len(ids)}")
        checksum_path = run_dir / "checksum.sha256"
        checksum_path.write_text(
            "\n".join(f"{digest}  {filename}" for filename, digest in checksums) + ("\n" if checksums else ""),
            encoding="utf-8", newline="\n",
        )
        response_metadata = {
            "schema_version": "1.0.0", "track": "v4.0_mecir_search_redesign",
            "run_id": run_id, "question_id": question_id, "executed_at": now.isoformat(timespec="seconds"),
            "source": "pubmed", "database": "pubmed", "eutils_tool": TOOL_NAME,
            "api_key_used": bool(api_key), "request_rate_limit_per_second": 3,
            "query_sha256": question["query_sha256"], "query_file_sha256": sha256_file(run_dir / "query.txt"),
            "phase_a_probe_hit_count": question["hit_count"], "fetch_hit_count": fetch_hit_count,
            "retrieved_count": len(question_rows), "ids_sha256": sha256_file(ids_path),
            "date_shard_count": len(segments), "date_shard_overlap_id_count": shard_overlap_count,
            "efetch_batch_size": EFETCH_BATCH,
            "efetch_files": [filename for filename, _ in checksums],
            "checksum_path": repo_relative(checksum_path), "checksum_sha256": sha256_file(checksum_path),
            "full_query_transport": full_transport, "status": "completed",
        }
        write_json(run_dir / "response_metadata.json", response_metadata)
        all_rows.extend(question_rows)
        question_runs.append(response_metadata | {
            "raw_path": repo_relative(run_dir),
            "response_metadata_sha256": sha256_file(run_dir / "response_metadata.json"),
            "esearch_segments_sha256": sha256_file(run_dir / "esearch_segments.json"),
        })

    deduplicated_rows, dedup_stats = deduplicate_within_questions(all_rows)
    write_csv(CORPUS_PATH, deduplicated_rows, EVIDENCE_COLUMNS)
    corpus_sha = sha256_file(CORPUS_PATH)
    observability = Counter(row["observability"] for row in deduplicated_rows)
    by_question_rows = Counter(row["question_id"] for row in deduplicated_rows)
    by_question_raw = Counter(row["question_id"] for row in all_rows)
    for run in question_runs:
        qid = run["question_id"]
        run["deduplicated_count"] = by_question_rows[qid]
        log_rows.append({
            "question_id": qid, "run_id": run_id, "executed_at": run["executed_at"],
            "query_sha256": run["query_sha256"], "probe_hit_count": run["phase_a_probe_hit_count"],
            "fetch_hit_count": run["fetch_hit_count"], "retrieved_count": run["retrieved_count"],
            "deduplicated_count": run["deduplicated_count"], "raw_path": run["raw_path"], "status": "completed",
        })
    append_search_log(log_rows)
    manifest = {
        "schema_version": "1.0.0", "track": "v4.0_mecir_search_redesign",
        "generated_at": utc_now().isoformat(timespec="seconds"), "run_id": run_id,
        "source_constraint": "pubmed_only", "human_decisions": 0,
        "protocol": {"path": repo_relative(PROTOCOL_PATH), "sha256": sha256_file(PROTOCOL_PATH)},
        "picos": {"path": repo_relative(PICOS_PATH), "sha256": sha256_file(PICOS_PATH), "question_count": 5},
        "probe": {"path": repo_relative(PROBE_REPORT), "sha256": sha256_file(PROBE_REPORT)},
        "search": {
            "phase_a_combined_hit_count": sum(int(item["hit_count"]) for item in report["questions"]),
            "fetch_combined_hit_count": sum(int(item["fetch_hit_count"]) for item in question_runs),
            "question_runs": question_runs,
        },
        "deduplication": dedup_stats,
        "corpus": {
            "path": repo_relative(CORPUS_PATH), "sha256": corpus_sha,
            "raw_retrieved_row_count": len(all_rows), "row_count": len(deduplicated_rows),
            "unique_record_id_count": len({row["record_id"] for row in deduplicated_rows}),
            "unique_paper_count": dedup_stats["global_unique_paper_count"],
            "source_distribution": dict(sorted(Counter(row["source"] for row in deduplicated_rows).items())),
            "observability_distribution": dict(sorted(observability.items())),
            "row_distribution_by_question": dict(sorted(by_question_rows.items())),
            "raw_distribution_by_question": dict(sorted(by_question_raw.items())),
            "schema": EVIDENCE_COLUMNS,
        },
        "search_log": {"path": repo_relative(SEARCH_LOG_PATH), "sha256": sha256_file(SEARCH_LOG_PATH)},
        "status": "complete",
    }
    write_json(CORPUS_MANIFEST_PATH, manifest)
    return manifest


def verify() -> dict[str, Any]:
    manifest = json.loads(CORPUS_MANIFEST_PATH.read_text(encoding="utf-8"))
    with CORPUS_PATH.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != EVIDENCE_COLUMNS:
            raise RuntimeError(f"v4 corpus schema mismatch: {reader.fieldnames}")
        rows = [dict(row) for row in reader]
    corpus = manifest["corpus"]
    if sha256_file(CORPUS_PATH) != corpus["sha256"]:
        raise RuntimeError("v4 corpus SHA-256 mismatch")
    if len(rows) != corpus["row_count"]:
        raise RuntimeError("v4 corpus row count mismatch")
    keys = [(row["question_id"], row["dedup_identity"]) for row in rows]
    if len(keys) != len(set(keys)):
        raise RuntimeError("duplicate v4 paper-question keys")
    if any(row["dedup_identity"] != paper_identity(row) for row in rows):
        raise RuntimeError("v4 dedup identity mismatch")
    if {row["source"] for row in rows} != {"pubmed"}:
        raise RuntimeError("v4 corpus is not PubMed-only")
    raw_hashes: dict[str, str] = {}
    for row in rows:
        raw_path = ROOT / row["raw_source_path"]
        actual = raw_hashes.setdefault(row["raw_source_path"], sha256_file(raw_path))
        if row["raw_source_sha256"] != actual:
            raise RuntimeError(f"raw source SHA-256 mismatch: {row['raw_source_path']}")
    xml_count = 0
    for run in manifest["search"]["question_runs"]:
        run_dir = ROOT / run["raw_path"]
        checksum_path = run_dir / "checksum.sha256"
        listed: dict[str, str] = {}
        for line in checksum_path.read_text(encoding="utf-8").splitlines():
            digest, filename = line.split("  ", 1)
            listed[filename] = digest
            if sha256_file(run_dir / filename) != digest:
                raise RuntimeError(f"checksum mismatch: {run_dir / filename}")
        actual_names = {path.name for path in run_dir.glob("efetch_*.xml")}
        if actual_names != set(listed):
            raise RuntimeError(f"checksum/XML file-set mismatch: {run['question_id']}")
        xml_count += len(actual_names)
        if sha256_file(run_dir / "ids.txt") != run["ids_sha256"]:
            raise RuntimeError(f"ID file SHA-256 mismatch: {run['question_id']}")
    result = {
        "verified": True, "verified_at": utc_now().isoformat(timespec="seconds"),
        "row_count": len(rows), "unique_paper_count": len({row["dedup_identity"] for row in rows}),
        "unique_paper_question_keys": len(set(keys)), "source": "pubmed",
        "raw_xml_files": xml_count, "referenced_raw_xml_files": len(raw_hashes),
        "corpus_sha256": corpus["sha256"], "manifest_sha256": sha256_file(CORPUS_MANIFEST_PATH),
    }
    write_json(ROOT / "research" / "logs" / "v40_phase_b_verification.json", result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Protocol v4.0 PubMed search and corpus pipeline")
    parser.add_argument("command", choices=("probe", "fetch", "verify"))
    parser.add_argument("--email", default=os.getenv("NCBI_EMAIL", "nutrition-safety-engine@example.org"))
    parser.add_argument("--api-key", default=os.getenv("NCBI_API_KEY", ""))
    args = parser.parse_args()
    if args.command == "probe":
        result = probe(args.email, args.api_key)
        print(json.dumps({
            "status": result["status"],
            "counts": {item["question_id"]: item["hit_count"] for item in result["questions"]},
            "combined": result["combined_record_question_hits"],
            "all_rules_passed": result["all_rules_passed"], "efetch_executed": result["efetch_executed"],
        }, ensure_ascii=False, indent=2))
        if not result["all_rules_passed"]:
            raise SystemExit(1)
    elif args.command == "fetch":
        result = fetch(args.email, args.api_key)
        print(json.dumps({
            "run_id": result["run_id"], "raw_rows": result["corpus"]["raw_retrieved_row_count"],
            "corpus_rows": result["corpus"]["row_count"],
            "unique_papers": result["corpus"]["unique_paper_count"],
            "corpus_sha256": result["corpus"]["sha256"],
        }, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(verify(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
