#!/usr/bin/env python3
"""Recompute PubMed record and duplicate-candidate lineage from raw XML."""

import csv
import hashlib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTERIM = ROOT / "data/interim"
OUTPUT = ROOT / "research/searches/phase03_lineage_validation.json"


def rows(name: str) -> list[dict[str, str]]:
    with (INTERIM / name).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def text(node: ET.Element | None) -> str:
    return "" if node is None else " ".join("".join(node.itertext()).split())


def title_key(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).lower()
    return " ".join(re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE).split())


def doi_key(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"^(https?://(dx\.)?doi\.org/|doi:\s*)", "", value).rstrip(" .")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def parse_raw(relative: str) -> dict[str, tuple[str, str]]:
    root = ET.parse(ROOT / relative).getroot()
    found: dict[str, tuple[str, str]] = {}
    for item in root.findall("PubmedArticle"):
        pmid = text(item.find("MedlineCitation/PMID"))
        title = text(item.find("MedlineCitation/Article/ArticleTitle"))
        dois = [text(node) for node in item.findall("PubmedData/ArticleIdList/ArticleId")
                if (node.attrib.get("IdType") or "").lower() == "doi"]
        found[pmid] = (title_key(title), doi_key(dois[0]) if dois else "")
    for item in root.findall("PubmedBookArticle"):
        pmid = text(item.find("BookDocument/PMID"))
        title = text(item.find("BookDocument/ArticleTitle")) or text(item.find("BookDocument/Book/BookTitle"))
        dois = [text(node) for node in item.findall("BookDocument/ArticleIdList/ArticleId")
                if (node.attrib.get("IdType") or "").lower() == "doi"]
        found[pmid] = (title_key(title), doi_key(dois[0]) if dois else "")
    return found


def main() -> int:
    errors: list[str] = []
    records_list = rows("records.csv")
    retrievals = rows("record_retrievals.csv")
    candidates = rows("duplicate_candidates.csv")
    decisions = rows("deduplication_decisions.csv")
    reports = rows("report_candidates.csv")
    records = {row["record_id"]: row for row in records_list}
    raw_paths = sorted({row["raw_file"] for row in records_list} | {row["raw_file"] for row in retrievals})
    if any("legacy_unverified" in path for path in raw_paths):
        errors.append("legacy source entered Phase 03 lineage")
    raw_index = {path: parse_raw(path) for path in raw_paths}

    for row in records_list:
        source = raw_index.get(row["raw_file"], {}).get(row["pmid"])
        if source is None:
            errors.append(f"record PMID absent from raw XML: {row['record_id']}")
        elif source != (row["normalized_title"], row["doi"]):
            errors.append(f"record title/DOI differs from raw XML: {row['record_id']}")
    for row in retrievals:
        record = records.get(row["record_id"])
        if record is None or record["pmid"] != row["pmid"]:
            errors.append(f"retrieval-record mismatch: {row['retrieval_id']}")
        if row["pmid"] not in raw_index.get(row["raw_file"], {}):
            errors.append(f"retrieval PMID absent from raw XML: {row['retrieval_id']}")

    expected: dict[tuple[str, str], set[str]] = defaultdict(set)
    for field, reason in (("doi", "exact_doi"), ("normalized_title", "exact_normalized_title")):
        groups: dict[str, list[str]] = defaultdict(list)
        for row in records_list:
            if row[field]:
                groups[row[field]].append(row["record_id"])
        for members in groups.values():
            for i, left in enumerate(sorted(members)):
                for right in sorted(members)[i + 1:]:
                    expected[(left, right)].add(reason)
    observed = {(row["record_id_a"], row["record_id_b"]): set(row["candidate_reasons"].split("|"))
                for row in candidates}
    if observed != expected:
        errors.append("duplicate candidate set differs from independent recomputation")

    candidate_ids = {row["candidate_id"] for row in candidates}
    if {row["candidate_id"] for row in decisions} != candidate_ids:
        errors.append("dedup decision queue does not cover candidate IDs exactly")
    protected = ("decision", "canonical_record_id", "duplicate_cluster_id", "duplicate_reason", "verified_by", "verified_at")
    decision_complete = 0
    for row in decisions:
        any_human = any(row[field].strip() for field in protected)
        base_complete = all(row[field].strip() for field in ("decision", "verified_by", "verified_at"))
        duplicate_complete = row["decision"] != "duplicate" or all(row[field].strip() for field in ("canonical_record_id", "duplicate_cluster_id", "duplicate_reason"))
        complete = base_complete and duplicate_complete and row["decision"] in {"duplicate", "not_duplicate", "uncertain"}
        expected_status = "complete_candidate_requires_validation" if complete else "in_progress_external_human_review" if any_human else "pending_external_human_review"
        if row["status"] != expected_status:
            errors.append(f"dedup decision progress mismatch: {row['candidate_id']}")
        decision_complete += int(complete)
    if {row["record_id"] for row in reports} != set(records):
        errors.append("report queue coverage/linkage boundary failed")
    link_complete = 0
    for row in reports:
        any_human = any(row[field].strip() for field in ("study_id", "linked_by", "linked_at"))
        complete = all(row[field].strip() for field in ("study_id", "linked_by", "linked_at"))
        expected_linkage_status = "complete_candidate_requires_validation" if complete else "in_progress_external_human_review" if any_human else "pending_external_human_review"
        if row.get("linkage_status") != expected_linkage_status:
            errors.append(f"report linkage progress mismatch: {row['report_id']}")
        link_complete += int(complete)

    # Contract mutations prove the same boundary rejects plausible corruptions.
    sample_record = records_list[0]
    sample_source = raw_index[sample_record["raw_file"]][sample_record["pmid"]]
    mutated_candidate_map = dict(observed)
    mutated_candidate_map.pop(next(iter(mutated_candidate_map)))
    mutated_decision = {**decisions[0], "decision": "duplicate"}
    mutated_report = {**reports[0], "study_id": "STUDY-UNVERIFIED"}
    mutation_tests = {
        "wrong_raw_pmid_rejected": "PMID-NOT-IN-RAW" not in raw_index[sample_record["raw_file"]],
        "wrong_normalized_title_rejected": sample_source != ("mutated title", sample_record["doi"]),
        "missing_duplicate_candidate_rejected": mutated_candidate_map != expected,
        "partial_decision_status_mismatch_rejected": any(mutated_decision[field].strip() for field in protected) and mutated_decision["status"] == "pending_external_human_review",
        "filled_study_link_rejected": bool(mutated_report["study_id"].strip()),
    }
    if not all(mutation_tests.values()):
        errors.append("one or more lineage contract mutations escaped detection")

    artifacts = []
    for name in ("records.csv", "record_retrievals.csv", "duplicate_candidates.csv",
                 "deduplication_decisions.csv", "report_candidates.csv"):
        path = INTERIM / name
        artifacts.append({"path": path.relative_to(ROOT).as_posix(), "sha256": sha256(path),
                          "size_bytes": path.stat().st_size})
    result = {"schema_version": "1.0.0", "status": "proxy_lineage_verified_human_gates_open",
              "errors": errors, "raw_xml_files_reparsed": len(raw_paths),
              "records_verified": len(records_list), "retrievals_verified": len(retrievals),
              "duplicate_candidates_recomputed": len(expected), "human_dedup_decisions": decision_complete,
              "human_study_links": link_complete, "final_search_claim_allowed": False,
              "mutation_tests": mutation_tests,
              "artifacts": artifacts}
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
