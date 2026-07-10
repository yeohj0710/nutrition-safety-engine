#!/usr/bin/env python3
"""Resolve PMC identifier candidates for every normalized PubMed record."""

from __future__ import annotations

import csv
import hashlib
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data/interim/records.csv"
RAW = ROOT / "research/fulltext/pmc_idconv_designpilot_20260710"
OUTPUT = ROOT / "data/interim/pmc_fulltext_candidates.csv"
BATCH_SIZE = 200
BASE = "https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def fetch(url: str, attempts: int = 4) -> bytes:
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "nutrition-safety-engine/0.1"})
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except Exception:
            if attempt + 1 == attempts:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    with INPUT.open(encoding="utf-8-sig", newline="") as handle:
        records = list(csv.DictReader(handle))
    by_pmid = {row["pmid"]: row["record_id"] for row in records}
    pmids = sorted(by_pmid, key=int)
    responses = []
    warnings = set()
    batches = [pmids[i:i + BATCH_SIZE] for i in range(0, len(pmids), BATCH_SIZE)]
    for index, batch in enumerate(batches, start=1):
        params = urllib.parse.urlencode({
            "ids": ",".join(batch),
            "idtype": "pmid",
            "format": "json",
            "tool": "nutrition_safety_engine",
        })
        payload = fetch(f"{BASE}?{params}")
        path = RAW / f"batch_{index:03d}.json"
        path.write_bytes(payload)
        parsed = json.loads(payload)
        warnings.update(parsed.get("request", {}).get("warnings", []))
        responses.extend(parsed.get("records", []))
        if index % 10 == 0 or index == len(batches):
            print(f"resolved batch {index}/{len(batches)}", flush=True)
        time.sleep(0.5)

    resolved = {}
    for item in responses:
        requested = str(item.get("requested-id", ""))
        if requested in by_pmid and item.get("pmcid"):
            resolved[requested] = item
    fields = [
        "record_id", "pmid", "pmcid", "doi", "is_live", "release_date",
        "pmc_article_url", "locator_status", "human_fulltext_verified",
        "human_eligibility_decision", "notes",
    ]
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for pmid in pmids:
            item = resolved.get(pmid)
            if not item:
                continue
            pmcid = item["pmcid"]
            writer.writerow({
                "record_id": by_pmid[pmid],
                "pmid": pmid,
                "pmcid": pmcid,
                "doi": item.get("doi", ""),
                "is_live": item.get("live", ""),
                "release_date": item.get("release-date", ""),
                "pmc_article_url": f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/",
                "locator_status": "public_pmc_identifier_candidate",
                "human_fulltext_verified": "",
                "human_eligibility_decision": "",
                "notes": "Identifier resolution only; not full-text review or inclusion.",
            })

    raw_files = sorted(RAW.glob("batch_*.json"))
    checksum_path = RAW / "checksum.sha256"
    checksum_path.write_text(
        "".join(f"{sha256(path)}  {path.name}\n" for path in raw_files), encoding="utf-8"
    )
    manifest = {
        "schema_version": "1.0.0",
        "status": "public_locator_proxy_not_human_fulltext_assessment",
        "api": BASE,
        "official_documentation": "https://pmc.ncbi.nlm.nih.gov/tools/id-converter-api/",
        "input_records_sha256": sha256(INPUT),
        "input_pmids": len(pmids),
        "batch_size": BATCH_SIZE,
        "batches": len(batches),
        "raw_files": len(raw_files),
        "raw_checksum_manifest_sha256": sha256(checksum_path),
        "pmc_identifier_candidates": len(resolved),
        "human_fulltext_verified": 0,
        "human_eligibility_decisions": 0,
        "request_warnings": sorted(warnings),
        "privacy_note": "Maintainer email omitted to avoid persisting personal data; API warning retained; requests throttled to <=2/second.",
        "output_path": OUTPUT.relative_to(ROOT).as_posix(),
        "output_sha256": sha256(OUTPUT),
    }
    (RAW / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
