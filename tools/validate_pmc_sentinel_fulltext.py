#!/usr/bin/env python3
"""Validate sentinel PMC XML retrieval, provenance, locators, and empty human fields."""

from __future__ import annotations

import csv
import gzip
import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / "research/fulltext/pmc_sentinel_fulltext_designpilot_20260710"


def digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def main() -> int:
    errors: list[str] = []
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    stored = (ROOT / manifest["raw_file"]).read_bytes()
    raw = gzip.decompress(stored)
    root = ET.fromstring(raw)
    with (ROOT / "articles.csv").open(encoding="utf-8-sig", newline="") as handle:
        articles = list(csv.DictReader(handle))
    with (ROOT / "section_locators.csv").open(encoding="utf-8-sig", newline="") as handle:
        locators = list(csv.DictReader(handle))
    with (ROOT / "paragraph_locators.csv").open(encoding="utf-8-sig", newline="") as handle:
        paragraphs = list(csv.DictReader(handle))
    with (ROOT / "non_oa_access_queue.csv").open(encoding="utf-8-sig", newline="") as handle:
        non_oa_queue = list(csv.DictReader(handle))
    if manifest.get("status") != "sentinel_fulltext_retrieval_design_pilot_not_eligibility_assessment":
        errors.append("unsafe status")
    if len(stored) != manifest.get("raw_stored_bytes") or digest(stored) != manifest.get("raw_gzip_sha256"):
        errors.append("stored raw checksum/size mismatch")
    if len(raw) != manifest.get("raw_uncompressed_bytes") or digest(raw) != manifest.get("raw_xml_sha256"):
        errors.append("uncompressed raw checksum/size mismatch")
    xml_articles = root.findall(".//article") if root.tag != "article" else [root]
    if len(xml_articles) != 3 or len(articles) != 3 or manifest.get("articles") != 3:
        errors.append("expected exactly 3 PMC-located sentinel articles")
    expected_pmcids = {"PMC3069236", "PMC3127502", "PMC5037562"}
    if {row["pmcid"] for row in articles} != expected_pmcids:
        errors.append("sentinel PMCID set mismatch")
    fulltext = [row for row in articles if row["retrieval_status"] == "retrieved_open_access_fulltext_xml_unassessed"]
    metadata_only = [row for row in articles if row["retrieval_status"] == "retrieved_pmc_metadata_only_non_open_access_unassessed"]
    if len(fulltext) != 1 or fulltext[0]["pmcid"] != "PMC5037562" or fulltext[0]["body_present"] != "True" or int(fulltext[0]["body_paragraphs"]) <= 0:
        errors.append("OA full-text classification mismatch")
    if len(metadata_only) != 2 or {row["pmcid"] for row in metadata_only} != {"PMC3069236", "PMC3127502"}:
        errors.append("metadata-only PMCID classification mismatch")
    if any(row["body_present"] != "False" or row["pmc_open_access"] != "no" for row in metadata_only):
        errors.append("non-OA metadata-only boundary mismatch")
    if fulltext and (fulltext[0]["pmc_open_access"] != "yes" or not fulltext[0]["license_href"]):
        errors.append("OA license metadata missing")
    if any(row["human_fulltext_verified"] or row["human_eligibility_decision"] for row in articles):
        errors.append("human-only article fields were prefilled")
    if len(locators) != manifest.get("section_locators") or not locators:
        errors.append("section locator count mismatch")
    if any(row["human_locator_verified"] for row in locators):
        errors.append("human locator field was prefilled")
    if any(row["pmcid"] not in expected_pmcids or not row["xml_locator"].startswith("article[pmcid=") for row in locators):
        errors.append("invalid locator provenance")
    xml_fulltext = next((article for article in xml_articles if any((node.text or "").strip() == "5037562" for node in article.findall(".//article-id"))), None)
    xml_paragraphs = xml_fulltext.findall("body//p") if xml_fulltext is not None else []
    if len(paragraphs) != len(xml_paragraphs) or len(paragraphs) != 19 or manifest.get("paragraph_locators") != 19:
        errors.append("paragraph locator coverage mismatch")
    for position, (row, paragraph) in enumerate(zip(paragraphs, xml_paragraphs), start=1):
        normalized = " ".join("".join(paragraph.itertext()).split())
        if row["pmcid"] != "PMC5037562" or row["paragraph_position"] != str(position):
            errors.append(f"paragraph {position}: identity/position mismatch")
        if row["xml_locator"] != f"article[pmcid='PMC5037562']/body//p[{position}]":
            errors.append(f"paragraph {position}: locator mismatch")
        if int(row["normalized_text_chars"]) != len(normalized) or row["normalized_text_sha256"] != digest(normalized.encode("utf-8")):
            errors.append(f"paragraph {position}: text hash mismatch")
        if row["human_locator_verified"] or row["human_claim_linked"]:
            errors.append(f"paragraph {position}: human-only field was prefilled")
    if len(non_oa_queue) != 2 or {row["pmcid"] for row in non_oa_queue} != {"PMC3069236", "PMC3127502"}:
        errors.append("non-OA access queue coverage mismatch")
    access_human_fields = ("requester_id", "requested_at", "access_outcome", "obtained_file_sha256")
    if any(any(row[field] for field in access_human_fields) for row in non_oa_queue):
        errors.append("non-OA access queue human fields were prefilled")
    if any(row["status"] != "pending_external_access_after_human_screening" for row in non_oa_queue):
        errors.append("non-OA access status overstated")
    if manifest.get("human_fulltext_verified") != 0 or manifest.get("human_eligibility_decisions") != 0 or manifest.get("final_inclusion_claim_allowed") is not False:
        errors.append("human/final safety boundary violated")
    if manifest.get("open_access_fulltext_xml") != 1 or manifest.get("metadata_only_non_open_access") != 2:
        errors.append("manifest access classification mismatch")
    if manifest.get("non_oa_access_queue_rows") != 2:
        errors.append("manifest non-OA queue count mismatch")
    result = {
        "errors": errors,
        "status": "complete_verified" if not errors else "failed_quality_gate",
        "articles": len(articles),
        "open_access_fulltext_xml": len(fulltext),
        "metadata_only_non_open_access": len(metadata_only),
        "section_locators": len(locators),
        "paragraph_locators": len(paragraphs),
        "non_oa_access_queue_rows": len(non_oa_queue),
        "human_fulltext_verified": 0,
        "human_eligibility_decisions": 0,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
