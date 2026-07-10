#!/usr/bin/env python3
"""Capture full-text XML for PMC-located sentinels without making eligibility claims."""

from __future__ import annotations

import csv
import gzip
import hashlib
import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CANDIDATES = REPO / "data/interim/pmc_fulltext_candidates.csv"
SENTINELS = REPO / "research/searches/sentinel_set.csv"
OUT = REPO / "research/fulltext/pmc_sentinel_fulltext_designpilot_20260710"
ENDPOINT = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
XLINK = "{http://www.w3.org/1999/xlink}href"
ALI_LICENSE_REF = ".//{http://www.niso.org/schemas/ali/1.0/}license_ref"


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def text(element: ET.Element | None) -> str:
    return " ".join("".join(element.itertext()).split()) if element is not None else ""


def main() -> int:
    with SENTINELS.open(encoding="utf-8-sig", newline="") as handle:
        sentinels = {row["pmid"]: row for row in csv.DictReader(handle)}
    with CANDIDATES.open(encoding="utf-8-sig", newline="") as handle:
        candidate_rows = [row for row in csv.DictReader(handle) if row["pmid"] in sentinels]
    if len(candidate_rows) != 3:
        raise SystemExit(f"expected 3 PMC-located sentinels, got {len(candidate_rows)}")
    candidate_rows.sort(key=lambda row: int(row["pmid"]))
    numeric_ids = [row["pmcid"].removeprefix("PMC") for row in candidate_rows]
    query = urllib.parse.urlencode({"db": "pmc", "id": ",".join(numeric_ids), "retmode": "xml", "tool": "nutrition_safety_thesis"})
    request = urllib.request.Request(
        f"{ENDPOINT}?{query}",
        headers={"User-Agent": "nutrition-safety-thesis/1.0 (research design pilot)"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
        http_status = response.status
        content_type = response.headers.get("Content-Type", "")
    root = ET.fromstring(raw)
    articles = root.findall(".//article") if root.tag != "article" else [root]
    if len(articles) != 3:
        raise SystemExit(f"expected 3 article nodes, got {len(articles)}")

    OUT.mkdir(parents=True, exist_ok=True)
    stored = gzip.compress(raw, compresslevel=9, mtime=0)
    raw_name = "pmc_sentinel_batch.xml.gz"
    (OUT / raw_name).write_bytes(stored)
    expected = {row["pmcid"]: row for row in candidate_rows}
    article_rows = []
    locator_rows = []
    for article in articles:
        ids = {node.get("pub-id-type", ""): text(node) for node in article.findall(".//article-id")}
        pmcid = ids.get("pmcid") or ids.get("pmc") or ids.get("pmcaid")
        if pmcid and not pmcid.startswith("PMC"):
            pmcid = f"PMC{pmcid}"
        candidate = expected.get(pmcid or "")
        if candidate is None:
            raise SystemExit(f"unexpected article PMCID: {pmcid}")
        body = article.find("body")
        license_node = article.find(".//license")
        custom = {
            node.findtext("meta-name", default=""): node.findtext("meta-value", default="")
            for node in article.findall(".//custom-meta")
        }
        license_ref = article.find(ALI_LICENSE_REF)
        ext_license = article.find(".//license//ext-link")
        open_access = custom.get("pmc-prop-open-access", "")
        retrieval_status = (
            "retrieved_open_access_fulltext_xml_unassessed"
            if body is not None and open_access == "yes"
            else "retrieved_pmc_metadata_only_non_open_access_unassessed"
        )
        article_rows.append(
            {
                "record_id": candidate["record_id"],
                "question_ids": ";".join(sorted({row["question_id"] for row in [sentinels[candidate["pmid"]]]})),
                "pmid": candidate["pmid"],
                "pmcid": pmcid,
                "doi": ids.get("doi") or candidate["doi"],
                "title": text(article.find(".//article-title")),
                "body_present": body is not None,
                "body_paragraphs": len(body.findall(".//p")) if body is not None else 0,
                "tables": len(article.findall(".//table-wrap")),
                "figures": len(article.findall(".//fig")),
                "pmc_open_access": open_access,
                "pmc_has_pdf": custom.get("pmc-prop-has-pdf", ""),
                "pmc_license_ref": custom.get("pmc-license-ref", ""),
                "license_type": license_node.get("license-type", "") if license_node is not None else "",
                "license_href": (
                    text(license_ref)
                    or (ext_license.get(XLINK, "") if ext_license is not None else "")
                    or (license_node.get(XLINK, "") if license_node is not None else "")
                ),
                "license_text": text(license_node),
                "retrieval_status": retrieval_status,
                "human_fulltext_verified": "",
                "human_eligibility_decision": "",
            }
        )
        if body is not None:
            for position, section in enumerate(body.findall(".//sec"), start=1):
                section_id = section.get("id", "")
                locator_rows.append(
                    {
                        "pmcid": pmcid,
                        "section_position": position,
                        "section_id": section_id,
                        "section_title": text(section.find("title")),
                        "paragraph_count": len(section.findall("./p")),
                        "xml_locator": f"article[pmcid='{pmcid}']/body//sec[{position}]" + (f"[@id='{section_id}']" if section_id else ""),
                        "human_locator_verified": "",
                    }
                )

    article_fields = list(article_rows[0])
    with (OUT / "articles.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=article_fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(sorted(article_rows, key=lambda row: int(row["pmid"])))
    locator_fields = list(locator_rows[0]) if locator_rows else ["pmcid", "section_position", "section_id", "section_title", "paragraph_count", "xml_locator", "human_locator_verified"]
    with (OUT / "section_locators.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=locator_fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(locator_rows)
    manifest = {
        "schema_version": "1.0.0",
        "status": "sentinel_fulltext_retrieval_design_pilot_not_eligibility_assessment",
        "observed_at": "2026-07-10",
        "endpoint": ENDPOINT,
        "official_documentation": "https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.EFetch",
        "request_ids": numeric_ids,
        "http_status": http_status,
        "content_type": content_type,
        "raw_file": raw_name,
        "raw_stored_bytes": len(stored),
        "raw_gzip_sha256": sha256(stored),
        "raw_uncompressed_bytes": len(raw),
        "raw_xml_sha256": sha256(raw),
        "articles": len(article_rows),
        "open_access_fulltext_xml": sum(row["retrieval_status"].startswith("retrieved_open_access") for row in article_rows),
        "metadata_only_non_open_access": sum("metadata_only" in row["retrieval_status"] for row in article_rows),
        "section_locators": len(locator_rows),
        "human_fulltext_verified": 0,
        "human_eligibility_decisions": 0,
        "final_inclusion_claim_allowed": False,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"articles": len(article_rows), "section_locators": len(locator_rows), "raw_xml_sha256": manifest["raw_xml_sha256"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
