from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[2]
PICOS_PATH = ROOT / "research" / "searches_v3" / "ai_picos" / "picos_definition.json"
PROMPT_PATH = ROOT / "research" / "searches_v3" / "ai_picos" / "prompt.txt"
SEARCH_ROOT = ROOT / "research" / "searches_v3"
CORPUS_PATH = ROOT / "data" / "curated_v3" / "evidence_map.csv"
CORPUS_MANIFEST_PATH = ROOT / "data" / "curated_v3" / "corpus_manifest.json"
SEARCH_LOG_PATH = SEARCH_ROOT / "search_log.csv"
EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
TOOL_NAME = "nutrition_safety_engine_v30"
MAX_TOTAL_ROWS = 10_000
REQUEST_INTERVAL_SECONDS = 0.36

EVIDENCE_COLUMNS = [
    "source", "record_id", "question_id", "provider_id", "title", "abstract",
    "authors", "year", "venue", "publication_types", "doi", "source_url",
    "classification", "observability", "fulltext_locator_status", "fulltext_locator",
    "raw_source_path", "raw_source_sha256", "extracted_effect_value",
    "extracted_effect_status", "decision_authority", "clinical_claim_allowed", "status",
]
SEARCH_LOG_COLUMNS = [
    "question_id", "run_id", "executed_at", "query_sha256", "hit_count",
    "retrieved_count", "raw_path", "status",
]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repo_relative(path: Path) -> str:
    return path.resolve().relative_to(ROOT.resolve()).as_posix()


def load_picos() -> dict[str, Any]:
    with PICOS_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    questions = payload.get("questions")
    if not isinstance(questions, list) or not 3 <= len(questions) <= 6:
        raise ValueError("PICOS questions must contain 3 to 6 entries")
    ids = [str(question.get("question_id", "")) for question in questions]
    if len(set(ids)) != len(ids) or any(not value for value in ids):
        raise ValueError("question_id values must be non-empty and unique")
    for question in questions:
        validate_query(str(question.get("pubmed_query", "")))
        for field in ("P", "I", "C", "O", "S", "rationale"):
            if not str(question.get(field, "")).strip():
                raise ValueError(f"{question['question_id']} missing {field}")
    return payload


def validate_query(query: str) -> None:
    if not query.strip():
        raise ValueError("PubMed query is empty")
    concept_query = query.replace("humans[Mesh]", "")
    if "[Mesh]" not in concept_query or "[tiab]" not in query:
        raise ValueError("Each query must combine MeSH and title/abstract terms")
    if "humans[Mesh]" not in query:
        raise ValueError("Each query must explicitly limit to humans")


class RateLimitedEutils:
    def __init__(self, email: str, interval_seconds: float = REQUEST_INTERVAL_SECONDS) -> None:
        self.email = email
        self.interval_seconds = interval_seconds
        self.last_request_monotonic = 0.0

    def request(self, endpoint: str, params: dict[str, str | int], attempts: int = 3) -> bytes:
        merged = {"tool": TOOL_NAME, "email": self.email, **params}
        url = f"{EUTILS_BASE}/{endpoint}?{urllib.parse.urlencode(merged)}"
        for attempt in range(attempts):
            elapsed = time.monotonic() - self.last_request_monotonic
            if elapsed < self.interval_seconds:
                time.sleep(self.interval_seconds - elapsed)
            request = urllib.request.Request(url, headers={"User-Agent": f"{TOOL_NAME}/1.0"})
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    data = response.read()
                self.last_request_monotonic = time.monotonic()
                return data
            except urllib.error.HTTPError as exc:
                self.last_request_monotonic = time.monotonic()
                if exc.code not in {429, 500, 502, 503, 504} or attempt + 1 == attempts:
                    raise
                retry_after = exc.headers.get("Retry-After", "")
                delay = float(retry_after) if retry_after.isdigit() else float(2**attempt)
                time.sleep(delay)
            except urllib.error.URLError:
                self.last_request_monotonic = time.monotonic()
                if attempt + 1 == attempts:
                    raise
                time.sleep(float(2**attempt))
        raise RuntimeError("unreachable E-utilities retry state")


def probe_counts(client: RateLimitedEutils, picos: dict[str, Any]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for question in picos["questions"]:
        raw = client.request(
            "esearch.fcgi",
            {"db": "pubmed", "term": question["pubmed_query"], "retmode": "json", "retmax": 0},
        )
        payload = json.loads(raw.decode("utf-8"))
        counts[question["question_id"]] = int(payload["esearchresult"]["count"])
    if sum(counts.values()) > MAX_TOTAL_ROWS:
        raise RuntimeError(
            f"combined PubMed hits {sum(counts.values())} exceed cap {MAX_TOTAL_ROWS}; narrow before EFetch"
        )
    return counts


def fetch_ids(client: RateLimitedEutils, query: str, expected_count: int) -> list[str]:
    raw = client.request(
        "esearch.fcgi",
        {
            "db": "pubmed", "term": query, "retmode": "json",
            "retmax": expected_count, "sort": "pub date",
        },
    )
    payload = json.loads(raw.decode("utf-8"))
    actual_count = int(payload["esearchresult"]["count"])
    ids = [str(value) for value in payload["esearchresult"].get("idlist", [])]
    if actual_count != expected_count:
        raise RuntimeError(f"ESearch count changed during run: expected={expected_count}, actual={actual_count}")
    if len(ids) != expected_count:
        raise RuntimeError(f"ESearch returned {len(ids)} IDs for {expected_count} hits")
    return ids


def chunks(values: list[str], size: int) -> Iterable[list[str]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


def element_text(element: ET.Element | None) -> str:
    if element is None:
        return ""
    return " ".join("".join(element.itertext()).split())


def article_year(article: ET.Element) -> str:
    candidates = [
        element_text(article.find(".//JournalIssue/PubDate/Year")),
        element_text(article.find(".//ArticleDate/Year")),
        element_text(article.find(".//PubMedPubDate[@PubStatus='pubmed']/Year")),
    ]
    medline_date = element_text(article.find(".//JournalIssue/PubDate/MedlineDate"))
    if medline_date[:4].isdigit():
        candidates.append(medline_date[:4])
    return next((value for value in candidates if value), "")


def article_id(article: ET.Element, id_type: str) -> str:
    for element in article.findall(".//ArticleIdList/ArticleId"):
        if element.attrib.get("IdType", "").lower() == id_type.lower():
            return element_text(element)
    return ""


def parse_pubmed_xml(
    xml_bytes: bytes,
    *,
    question_id: str,
    raw_source_path: str,
    raw_source_sha256: str,
) -> list[dict[str, str]]:
    root = ET.fromstring(xml_bytes)
    rows: list[dict[str, str]] = []
    for article in root.findall(".//PubmedArticle"):
        pmid = element_text(article.find(".//MedlineCitation/PMID"))
        if not pmid:
            continue
        title = element_text(article.find(".//ArticleTitle"))
        abstracts: list[str] = []
        for node in article.findall(".//Abstract/AbstractText"):
            value = element_text(node)
            if not value:
                continue
            label = node.attrib.get("Label", "").strip()
            abstracts.append(f"{label}: {value}" if label else value)
        abstract = "\n".join(abstracts)
        authors: list[str] = []
        for author in article.findall(".//AuthorList/Author"):
            collective = element_text(author.find("CollectiveName"))
            family = element_text(author.find("LastName"))
            initials = element_text(author.find("Initials"))
            value = collective or " ".join(part for part in (family, initials) if part)
            if value:
                authors.append(value)
        publication_types = [
            element_text(node) for node in article.findall(".//PublicationTypeList/PublicationType")
            if element_text(node)
        ]
        doi = article_id(article, "doi")
        pmc = article_id(article, "pmc")
        fulltext_locator = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmc}/" if pmc else ""
        rows.append({
            "source": "pubmed",
            "record_id": f"pubmed:{pmid}",
            "question_id": question_id,
            "provider_id": pmid,
            "title": title,
            "abstract": abstract,
            "authors": "; ".join(authors),
            "year": article_year(article),
            "venue": element_text(article.find(".//Journal/Title")),
            "publication_types": "|".join(publication_types),
            "doi": doi,
            "source_url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "classification": "unclassified",
            "observability": "abstract_available" if abstract else "title_only",
            "fulltext_locator_status": "pmc_locator_available" if pmc else "not_observed",
            "fulltext_locator": fulltext_locator,
            "raw_source_path": raw_source_path,
            "raw_source_sha256": raw_source_sha256,
            "extracted_effect_value": "",
            "extracted_effect_status": "not_observed",
            "decision_authority": "ai_screening_pending",
            "clinical_claim_allowed": "false",
            "status": "captured_exploratory_record",
        })
    return rows


def write_csv(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="raise")
        writer.writeheader()
        writer.writerows(rows)


def append_search_log(rows: list[dict[str, Any]]) -> None:
    SEARCH_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    exists = SEARCH_LOG_PATH.exists() and SEARCH_LOG_PATH.stat().st_size > 0
    with SEARCH_LOG_PATH.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=SEARCH_LOG_COLUMNS, extrasaction="raise")
        if not exists:
            writer.writeheader()
        writer.writerows(rows)


def execute(client: RateLimitedEutils, picos: dict[str, Any], counts: dict[str, int]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    run_id = now.strftime("%Y%m%dT%H%M%SZ")
    rows: list[dict[str, str]] = []
    log_rows: list[dict[str, Any]] = []
    question_runs: list[dict[str, Any]] = []
    for question in picos["questions"]:
        question_id = question["question_id"]
        query = question["pubmed_query"]
        run_dir = SEARCH_ROOT / question_id / "pubmed" / run_id
        run_dir.mkdir(parents=True, exist_ok=False)
        (run_dir / "query.txt").write_text(query + "\n", encoding="utf-8")
        ids = fetch_ids(client, query, counts[question_id])
        checksums: list[tuple[str, str]] = []
        question_rows: list[dict[str, str]] = []
        for batch_index, batch_ids in enumerate(chunks(ids, 200), start=1):
            xml_bytes = client.request(
                "efetch.fcgi",
                {"db": "pubmed", "id": ",".join(batch_ids), "retmode": "xml"},
            )
            filename = f"efetch_{batch_index:03d}.xml"
            raw_path = run_dir / filename
            raw_path.write_bytes(xml_bytes)
            digest = sha256_bytes(xml_bytes)
            checksums.append((filename, digest))
            question_rows.extend(parse_pubmed_xml(
                xml_bytes,
                question_id=question_id,
                raw_source_path=repo_relative(raw_path),
                raw_source_sha256=digest,
            ))
        if len(question_rows) != len(ids):
            raise RuntimeError(
                f"{question_id}: parsed {len(question_rows)} records for {len(ids)} PubMed IDs"
            )
        keys = [(row["record_id"], row["question_id"]) for row in question_rows]
        if len(keys) != len(set(keys)):
            raise RuntimeError(f"{question_id}: duplicate record-question keys")
        checksum_lines = [f"{digest}  {filename}" for filename, digest in checksums]
        (run_dir / "checksum.sha256").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")
        response_metadata = {
            "schema_version": "1.0.0",
            "run_id": run_id,
            "question_id": question_id,
            "executed_at": now.isoformat(timespec="seconds"),
            "source": "pubmed",
            "database": "pubmed",
            "eutils_tool": TOOL_NAME,
            "api_key_used": False,
            "request_rate_limit_per_second": 3,
            "query_sha256": sha256_bytes(query.encode("utf-8")),
            "hit_count": counts[question_id],
            "retrieved_count": len(question_rows),
            "efetch_batch_size": 200,
            "efetch_files": [filename for filename, _ in checksums],
            "status": "completed",
        }
        (run_dir / "response_metadata.json").write_text(
            json.dumps(response_metadata, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        rows.extend(question_rows)
        question_runs.append(response_metadata | {"raw_path": repo_relative(run_dir)})
        log_rows.append({
            "question_id": question_id,
            "run_id": run_id,
            "executed_at": now.isoformat(timespec="seconds"),
            "query_sha256": response_metadata["query_sha256"],
            "hit_count": counts[question_id],
            "retrieved_count": len(question_rows),
            "raw_path": repo_relative(run_dir),
            "status": "completed",
        })
    all_keys = [(row["record_id"], row["question_id"]) for row in rows]
    if len(all_keys) != len(set(all_keys)):
        raise RuntimeError("duplicate record-question keys in combined v3 corpus")
    if any(row["source"] != "pubmed" for row in rows):
        raise RuntimeError("non-PubMed row detected in v3 corpus")
    rows.sort(key=lambda row: (row["question_id"], row["provider_id"]))
    write_csv(CORPUS_PATH, rows, EVIDENCE_COLUMNS)
    append_search_log(log_rows)
    evidence_sha = sha256_file(CORPUS_PATH)
    observability = Counter(row["observability"] for row in rows)
    manifest = {
        "schema_version": "1.0.0",
        "track": "v3.0_full_ai_autonomy",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source_constraint": "pubmed_only",
        "human_decisions": 0,
        "picos": {
            "path": repo_relative(PICOS_PATH),
            "sha256": sha256_file(PICOS_PATH),
            "prompt_path": repo_relative(PROMPT_PATH),
            "prompt_sha256": sha256_file(PROMPT_PATH),
            "question_count": len(picos["questions"]),
        },
        "search": {
            "combined_hit_count": sum(counts.values()),
            "cap": MAX_TOTAL_ROWS,
            "question_runs": question_runs,
        },
        "corpus": {
            "path": repo_relative(CORPUS_PATH),
            "sha256": evidence_sha,
            "row_count": len(rows),
            "unique_record_count": len({row["record_id"] for row in rows}),
            "source_distribution": dict(Counter(row["source"] for row in rows)),
            "observability_distribution": dict(observability),
            "schema": EVIDENCE_COLUMNS,
        },
        "status": "complete",
    }
    CORPUS_MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    CORPUS_MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest


def validate_outputs() -> dict[str, Any]:
    with CORPUS_MANIFEST_PATH.open(encoding="utf-8") as handle:
        manifest = json.load(handle)
    with CORPUS_PATH.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != EVIDENCE_COLUMNS:
            raise RuntimeError(f"v3 corpus schema mismatch: {reader.fieldnames}")
        rows = [dict(row) for row in reader]
    corpus = manifest["corpus"]
    if sha256_file(CORPUS_PATH) != corpus["sha256"]:
        raise RuntimeError("v3 corpus SHA-256 mismatch")
    if len(rows) != corpus["row_count"]:
        raise RuntimeError("v3 corpus row count mismatch")
    keys = [(row["record_id"], row["question_id"]) for row in rows]
    if len(keys) != len(set(keys)):
        raise RuntimeError("duplicate v3 record-question keys")
    if {row["source"] for row in rows} != {"pubmed"}:
        raise RuntimeError("v3 corpus is not PubMed-only")
    raw_hashes: dict[str, str] = {}
    for row in rows:
        raw_path = ROOT / row["raw_source_path"]
        expected = raw_hashes.setdefault(row["raw_source_path"], sha256_file(raw_path))
        if row["raw_source_sha256"] != expected:
            raise RuntimeError(f"raw source SHA-256 mismatch: {row['raw_source_path']}")
    for question_run in manifest["search"]["question_runs"]:
        run_dir = ROOT / question_run["raw_path"]
        checksum_path = run_dir / "checksum.sha256"
        for line in checksum_path.read_text(encoding="utf-8").splitlines():
            digest, filename = line.split("  ", 1)
            if sha256_file(run_dir / filename) != digest:
                raise RuntimeError(f"checksum file mismatch: {run_dir / filename}")
    return {
        "row_count": len(rows),
        "unique_keys": len(set(keys)),
        "source": "pubmed",
        "raw_xml_files": len(raw_hashes),
        "corpus_sha256": corpus["sha256"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the independent v3.0 PubMed track")
    parser.add_argument("command", choices=("probe", "fetch", "validate"))
    parser.add_argument("--email", default=os.getenv("NCBI_EMAIL", "nutrition-safety-engine@example.org"))
    args = parser.parse_args()
    if args.command == "validate":
        print(json.dumps(validate_outputs(), ensure_ascii=False, indent=2))
        return
    picos = load_picos()
    client = RateLimitedEutils(args.email)
    counts = probe_counts(client, picos)
    if args.command == "probe":
        print(json.dumps({"counts": counts, "combined": sum(counts.values())}, ensure_ascii=False, indent=2))
        return
    manifest = execute(client, picos, counts)
    print(json.dumps({
        "corpus_rows": manifest["corpus"]["row_count"],
        "corpus_sha256": manifest["corpus"]["sha256"],
        "observability": manifest["corpus"]["observability_distribution"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
