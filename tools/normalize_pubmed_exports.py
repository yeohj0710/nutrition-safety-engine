#!/usr/bin/env python3
"""Normalize checksum-verified PubMed final-search exports without making screening decisions."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from typing import Any


REPO = Path(__file__).resolve().parents[1]
QUESTIONS = ("A1", "A2", "B1", "B2", "B3")
RUN_DATE = "20260713"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def element_text(element: ET.Element | None) -> str:
    if element is None:
        return ""
    return " ".join("".join(element.itertext()).split())


def normalize_doi(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"^(https?://(dx\.)?doi\.org/|doi:\s*)", "", value)
    return value.rstrip(" .")


def normalize_title(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).lower()
    value = re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE)
    return " ".join(value.split())


def article_record(article: ET.Element, raw_file: str) -> dict[str, str]:
    citation = article.find("MedlineCitation")
    if citation is None:
        raise ValueError(f"Missing MedlineCitation in {raw_file}")
    pmid = element_text(citation.find("PMID"))
    article_node = citation.find("Article")
    if not pmid or article_node is None:
        raise ValueError(f"Missing PMID/Article in {raw_file}")

    title = element_text(article_node.find("ArticleTitle"))
    abstract_parts = []
    for item in article_node.findall("Abstract/AbstractText"):
        label = (item.attrib.get("Label") or "").strip()
        text = element_text(item)
        if text:
            abstract_parts.append(f"{label}: {text}" if label else text)

    authors = []
    for author in article_node.findall("AuthorList/Author"):
        collective = element_text(author.find("CollectiveName"))
        if collective:
            authors.append(collective)
            continue
        family = element_text(author.find("LastName"))
        initials = element_text(author.find("Initials"))
        name = " ".join(value for value in (family, initials) if value)
        if name:
            authors.append(name)

    journal = element_text(article_node.find("Journal/Title"))
    pub_date = article_node.find("Journal/JournalIssue/PubDate")
    year = element_text(pub_date.find("Year")) if pub_date is not None else ""
    if not year and pub_date is not None:
        match = re.search(r"(?:17|18|19|20)\d{2}", element_text(pub_date.find("MedlineDate")))
        year = match.group(0) if match else ""
    if not year:
        year = element_text(article_node.find("ArticleDate/Year"))

    article_ids = {
        (node.attrib.get("IdType") or "").lower(): element_text(node)
        for node in article.findall("PubmedData/ArticleIdList/ArticleId")
    }
    publication_types = sorted(
        {
            element_text(node)
            for node in article_node.findall("PublicationTypeList/PublicationType")
            if element_text(node)
        }
    )
    return {
        "record_id": f"REC-PUBMED-{pmid}",
        "source": "PubMed",
        "pmid": pmid,
        "doi": normalize_doi(article_ids.get("doi", "")),
        "pmcid": article_ids.get("pmc", ""),
        "title": title,
        "normalized_title": normalize_title(title),
        "abstract": "\n".join(abstract_parts),
        "authors": "; ".join(authors),
        "first_author": authors[0] if authors else "",
        "year": year,
        "journal": journal,
        "publication_types": "|".join(publication_types),
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        "raw_file": raw_file,
        "status": "final_search_unreviewed",
    }


def book_record(article: ET.Element, raw_file: str) -> dict[str, str]:
    document = article.find("BookDocument")
    if document is None:
        raise ValueError(f"Missing BookDocument in {raw_file}")
    pmid = element_text(document.find("PMID"))
    book_title = element_text(document.find("Book/BookTitle"))
    title = element_text(document.find("ArticleTitle")) or book_title
    if not pmid or not title:
        raise ValueError(f"Missing book PMID/title in {raw_file}")
    abstract_parts = [
        element_text(item) for item in document.findall("Abstract/AbstractText") if element_text(item)
    ]
    article_ids = {
        (node.attrib.get("IdType") or "").lower(): element_text(node)
        for node in document.findall("ArticleIdList/ArticleId")
    }
    year = element_text(document.find("Book/PubDate/Year"))
    publication_types = sorted(
        {
            element_text(node)
            for node in document.findall("PublicationType")
            if element_text(node)
        }
    )
    return {
        "record_id": f"REC-PUBMED-{pmid}",
        "source": "PubMed",
        "pmid": pmid,
        "doi": normalize_doi(article_ids.get("doi", "")),
        "pmcid": article_ids.get("pmc", ""),
        "title": title,
        "normalized_title": normalize_title(title),
        "abstract": "\n".join(abstract_parts),
        "authors": "",
        "first_author": "",
        "year": year,
        "journal": book_title,
        "publication_types": "|".join(publication_types),
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        "raw_file": raw_file,
        "status": "final_search_unreviewed",
    }


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_or_preserve_human_queue(path: Path, generated: list[dict[str, Any]], fields: list[str],
                                  key: str, human_fields: list[str], static_fields: list[str]) -> str:
    if path.exists():
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            existing = list(reader)
            if reader.fieldnames != fields:
                # Header migration is allowed only while every existing human field is blank or absent.
                if any(any(row.get(field, "").strip() for field in human_fields) for row in existing):
                    raise ValueError(f"human queue header mismatch; refusing overwrite: {path}")
            elif any(any(row.get(field, "").strip() for field in human_fields) for row in existing):
                old, new = {row[key]: row for row in existing}, {str(row[key]): row for row in generated}
                if set(old) != set(new) or any(any(old[item][field] != str(new[item][field]) for field in static_fields) for item in old):
                    raise ValueError(f"human queue lineage changed; refusing overwrite: {path}")
                return "preserved_existing_human_data"
    write_csv(path, generated, fields)
    return "generated_no_human_data"


def verify_checksum_file(run_dir: Path) -> int:
    checked = 0
    for line in (run_dir / "checksum.sha256").read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        expected, name = line.split("  ", 1)
        path = run_dir / name
        if not path.is_file() or sha256(path) != expected:
            raise ValueError(f"Raw checksum mismatch: {path}")
        checked += 1
    return checked


def main() -> int:
    records_by_pmid: dict[str, dict[str, str]] = {}
    retrievals: list[dict[str, str]] = []
    search_log: list[dict[str, Any]] = []
    raw_files_checked = 0
    question_pmids: dict[str, set[str]] = {}

    for question in QUESTIONS:
        run_id = f"pubmed_{question.lower()}_final_{RUN_DATE}"
        run_dir = REPO / "research" / "searches" / question / "pubmed" / run_id
        metadata = json.loads((run_dir / "response_metadata.json").read_text(encoding="utf-8"))
        raw_files_checked += verify_checksum_file(run_dir)
        expected_ids = {
            value.strip()
            for value in (run_dir / "ids.txt").read_text(encoding="utf-8").splitlines()
            if value.strip()
        }
        parsed_pmids: set[str] = set()
        for xml_path in sorted(run_dir.glob("efetch_*.xml")):
            root = ET.parse(xml_path).getroot()
            article_nodes = [
                *((node, article_record) for node in root.findall("PubmedArticle")),
                *((node, book_record) for node in root.findall("PubmedBookArticle")),
            ]
            for article, parser in article_nodes:
                relative_raw = xml_path.relative_to(REPO).as_posix()
                record = parser(article, relative_raw)
                pmid = record["pmid"]
                parsed_pmids.add(pmid)
                existing = records_by_pmid.get(pmid)
                if existing and existing["title"] != record["title"]:
                    raise ValueError(f"Conflicting title for PMID {pmid}")
                records_by_pmid.setdefault(pmid, record)
                retrievals.append(
                    {
                        "retrieval_id": f"RET-{question}-PUBMED-{pmid}",
                        "record_id": record["record_id"],
                        "question_id": question,
                        "search_run_id": run_id,
                        "database": "PubMed",
                        "pmid": pmid,
                        "raw_file": relative_raw,
                        "status": "final_search_pending_screening",
                    }
                )
        if parsed_pmids != expected_ids:
            raise ValueError(
                f"PMID export/parse mismatch {question}: expected={len(expected_ids)} parsed={len(parsed_pmids)}"
            )
        if len(parsed_pmids) != int(metadata["records_exported"]):
            raise ValueError(f"Metadata/export mismatch {question}")
        question_pmids[question] = parsed_pmids
        query_path = run_dir / "query.txt"
        search_log.append(
            {
                "search_run_id": run_id,
                "question_id": question,
                "database": "PubMed",
                "platform": "NCBI E-utilities",
                "coverage_notes": "full PubMed final-search export after protocol and PRESS approval",
                "search_datetime_iso": metadata["search_datetime_iso"],
                "timezone": metadata["timezone"],
                "query_file": query_path.relative_to(REPO).as_posix(),
                "query_sha256": metadata["query_sha256"],
                "limits": "none; A1 partitioned by publication year ranges solely for API cap",
                "total_hits_reported": metadata["total_hits_reported"],
                "records_exported": metadata["records_exported"],
                "export_format": "PubMed XML batches",
                "raw_file": run_dir.relative_to(REPO).as_posix(),
                "raw_sha256": sha256(run_dir / "checksum.sha256"),
                "incremental_from_date": "",
                "operator": "codex_public_api_proxy",
                "peer_review_status": metadata["peer_review_status"],
                "status": metadata["status"],
                "notes": metadata["notes"],
            }
        )

    memberships: dict[str, list[str]] = defaultdict(list)
    for row in retrievals:
        memberships[row["pmid"]].append(row["question_id"])
    records = []
    for pmid, row in sorted(records_by_pmid.items(), key=lambda item: int(item[0])):
        records.append({**row, "question_ids": "|".join(sorted(set(memberships[pmid])))})

    candidate_pairs: dict[tuple[str, str], set[str]] = defaultdict(set)
    for field, reason in (("doi", "exact_doi"), ("normalized_title", "exact_normalized_title")):
        groups: dict[str, list[dict[str, str]]] = defaultdict(list)
        for row in records:
            if row[field]:
                groups[row[field]].append(row)
        for group in groups.values():
            if len(group) < 2:
                continue
            ordered = sorted(group, key=lambda row: row["record_id"])
            for index, left in enumerate(ordered):
                for right in ordered[index + 1 :]:
                    candidate_pairs[(left["record_id"], right["record_id"])].add(reason)

    duplicate_candidates = []
    decisions = []
    for number, ((left, right), reasons) in enumerate(sorted(candidate_pairs.items()), start=1):
        candidate_id = f"DUPC-{number:06d}"
        duplicate_candidates.append(
            {
                "candidate_id": candidate_id,
                "record_id_a": left,
                "record_id_b": right,
                "candidate_reasons": "|".join(sorted(reasons)),
                "generator": "exact_identifier_or_title",
                "status": "needs_human_review",
            }
        )
        decisions.append(
            {
                "candidate_id": candidate_id,
                "decision": "",
                "canonical_record_id": "",
                "duplicate_cluster_id": "",
                "duplicate_reason": "",
                "verified_by": "",
                "verified_at": "",
                "status": "pending_external_human_review",
            }
        )

    reports = [
        {
            "report_id": f"RPT-PUBMED-{row['pmid']}",
            "record_id": row["record_id"],
            "study_id": "",
            "report_type": "bibliographic_record",
            "linkage_evidence": "PMID exact",
            "status": "needs_human_study_linkage",
            "linked_by": "",
            "linked_at": "",
            "linkage_status": "pending_external_human_review",
        }
        for row in records
    ]

    interim = REPO / "data" / "interim"
    write_csv(interim / "records.csv", records, list(records[0].keys()))
    write_csv(interim / "record_retrievals.csv", retrievals, list(retrievals[0].keys()))
    write_csv(
        interim / "duplicate_candidates.csv",
        duplicate_candidates,
        ["candidate_id", "record_id_a", "record_id_b", "candidate_reasons", "generator", "status"],
    )
    write_or_preserve_human_queue(
        interim / "deduplication_decisions.csv",
        decisions,
        [
            "candidate_id",
            "decision",
            "canonical_record_id",
            "duplicate_cluster_id",
            "duplicate_reason",
            "verified_by",
            "verified_at",
            "status",
        ], "candidate_id", ["decision", "canonical_record_id", "duplicate_cluster_id", "duplicate_reason", "verified_by", "verified_at"], ["candidate_id"],
    )
    write_or_preserve_human_queue(interim / "report_candidates.csv", reports, list(reports[0].keys()), "report_id",
                                  ["study_id", "linked_by", "linked_at"],
                                  ["report_id", "record_id", "report_type", "linkage_evidence"])
    write_csv(
        REPO / "research" / "searches" / "search_log.csv",
        search_log,
        list(search_log[0].keys()),
    )

    sentinel_rows = []
    with (REPO / "research/searches/sentinel_set.csv").open(
        "r", encoding="utf-8-sig", newline=""
    ) as handle:
        sentinel_rows = list(csv.DictReader(handle))
    sentinel_results = [
        {
            "question_id": row["question_id"],
            "pmid": row["pmid"],
            "retrieved": row["pmid"] in question_pmids[row["question_id"]],
        }
        for row in sentinel_rows
    ]

    legacy_path = (
        REPO
        / "data/legacy_unverified/baseline-33658e3/systematic_search/retrieved_records.csv"
    )
    with legacy_path.open("r", encoding="utf-8-sig", newline="") as handle:
        legacy_rows = list(csv.DictReader(handle))
    legacy_pmids = {row["pmid"].strip() for row in legacy_rows if row.get("pmid", "").strip()}
    current_pmids = set(records_by_pmid)
    legacy_overlap = legacy_pmids & current_pmids

    summary = {
        "schema_version": "1.0.0",
        "status": "final_search_normalized_pending_human_screening",
        "raw_files_checksum_verified": raw_files_checked,
        "retrieval_instances": len(retrievals),
        "unique_pubmed_records": len(records),
        "cross_question_duplicate_instances": len(retrievals) - len(records),
        "exact_duplicate_candidate_pairs": len(duplicate_candidates),
        "human_dedup_decisions_completed": 0,
        "report_candidates": len(reports),
        "human_study_links_completed": 0,
        "sentinel_checks": sentinel_results,
        "legacy_unique_pmids": len(legacy_pmids),
        "legacy_pmids_retrieved_by_current_drafts": len(legacy_overlap),
        "legacy_pmids_not_retrieved_by_current_drafts": len(legacy_pmids - current_pmids),
        "limitation": "No human duplicate, study-linkage, or eligibility-screening decision has been made; licensed databases remain outstanding.",
    }
    (interim / "dedup_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    recall_lines = [
        "# Search recall check — PubMed final search",
        "",
        "Status: `final_search_normalized_pending_human_screening`; not a PRISMA result.",
        "",
        f"- Sentinel retrieval: {sum(item['retrieved'] for item in sentinel_results)}/{len(sentinel_results)}",
        f"- Legacy unique PMIDs: {len(legacy_pmids)}",
        f"- Retrieved legacy PMIDs: {len(legacy_overlap)}",
        f"- Legacy PMIDs not retrieved: {len(legacy_pmids - current_pmids)}",
        "- Interpretation: legacy searches used different broad questions and relevance-capped exports; non-overlap is a review signal, not proof of current-search failure.",
        "",
        "## Sentinel details",
        "",
        "| Question | PMID | Retrieved |",
        "|---|---:|---|",
        *[
            f"| {item['question_id']} | {item['pmid']} | {'yes' if item['retrieved'] else 'no'} |"
            for item in sentinel_results
        ],
        "",
        "Final recall assessment requires approved searches and human review of missing known studies.",
    ]
    (REPO / "research/searches/search_recall_check.md").write_text(
        "\n".join(recall_lines) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
