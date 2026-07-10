#!/usr/bin/env python3
"""Normalize checksum-verified ClinicalTrials.gov design-pilot exports."""

from __future__ import annotations

import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]
QUESTIONS = ("A1", "A2", "B1", "B2", "B3")
RUN_DATE = "20260710"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    records: dict[str, dict[str, str]] = {}
    retrievals: list[dict[str, str]] = []
    memberships: dict[str, set[str]] = defaultdict(set)
    pmid_links: set[tuple[str, str, str]] = set()
    search_log = []
    verified_files = 0

    for question in QUESTIONS:
        run_id = f"ctgov_{question.lower()}_designpilot_{RUN_DATE}"
        run_dir = REPO / "research/searches" / question / "clinicaltrials" / run_id
        metadata = json.loads((run_dir / "response_metadata.json").read_text(encoding="utf-8"))
        for line in (run_dir / "checksum.sha256").read_text(encoding="utf-8").splitlines():
            expected, name = line.split("  ", 1)
            path = run_dir / name
            if not path.is_file() or sha256(path) != expected:
                raise ValueError(f"Checksum mismatch: {path}")
            verified_files += 1

        exported = 0
        for page_path in sorted(run_dir.glob("page_*.json")):
            page = json.loads(page_path.read_text(encoding="utf-8"))
            for study in page.get("studies", []):
                protocol = study.get("protocolSection", {})
                identification = protocol.get("identificationModule", {})
                nct_id = identification.get("nctId", "")
                if not nct_id:
                    raise ValueError(f"Missing NCT ID in {page_path}")
                exported += 1
                memberships[nct_id].add(question)
                status = protocol.get("statusModule", {})
                design = protocol.get("designModule", {})
                arms = protocol.get("armsInterventionsModule", {})
                conditions = protocol.get("conditionsModule", {})
                sponsors = protocol.get("sponsorCollaboratorsModule", {})
                references = protocol.get("referencesModule", {}).get("references", [])
                interventions = arms.get("interventions", [])
                record = {
                    "record_id": f"REC-CTGOV-{nct_id}",
                    "nct_id": nct_id,
                    "brief_title": identification.get("briefTitle", ""),
                    "official_title": identification.get("officialTitle", ""),
                    "overall_status": status.get("overallStatus", ""),
                    "study_type": design.get("studyType", ""),
                    "phases": "|".join(design.get("phases", [])),
                    "enrollment": str(design.get("enrollmentInfo", {}).get("count", "")),
                    "conditions": "|".join(conditions.get("conditions", [])),
                    "interventions": "|".join(
                        f"{item.get('type', '')}:{item.get('name', '')}" for item in interventions
                    ),
                    "lead_sponsor": sponsors.get("leadSponsor", {}).get("name", ""),
                    "start_date": status.get("startDateStruct", {}).get("date", ""),
                    "completion_date": status.get("completionDateStruct", {}).get("date", ""),
                    "has_results": str("resultsSection" in study).lower(),
                    "url": f"https://clinicaltrials.gov/study/{nct_id}",
                    "status": "design_pilot_unreviewed",
                }
                existing = records.get(nct_id)
                if existing and existing != record:
                    raise ValueError(f"Conflicting registry record: {nct_id}")
                records[nct_id] = record
                retrievals.append(
                    {
                        "retrieval_id": f"RET-{question}-CTGOV-{nct_id}",
                        "record_id": record["record_id"],
                        "question_id": question,
                        "search_run_id": run_id,
                        "database": "ClinicalTrials.gov",
                        "provider_id": nct_id,
                        "status": "design_pilot_not_final_search",
                    }
                )
                for reference in references:
                    pmid = str(reference.get("pmid", "")).strip()
                    if pmid:
                        pmid_links.add((nct_id, pmid, reference.get("type", "")))
        if exported != int(metadata["records_exported"]):
            raise ValueError(f"Registry count mismatch {question}: {exported}")
        search_log.append(
            {
                "search_run_id": run_id,
                "question_id": question,
                "database": "ClinicalTrials.gov",
                "platform": "ClinicalTrials.gov API v2",
                "search_datetime_iso": metadata["search_datetime_iso"],
                "query_file": (run_dir / "query.txt").relative_to(REPO).as_posix(),
                "query_sha256": metadata["query_sha256"],
                "total_hits_reported": metadata["total_hits_reported"],
                "records_exported": metadata["records_exported"],
                "raw_file": run_dir.relative_to(REPO).as_posix(),
                "raw_sha256": sha256(run_dir / "checksum.sha256"),
                "peer_review_status": metadata["peer_review_status"],
                "status": metadata["status"],
                "notes": "A1 includes vitamin K antagonist false-positive candidates; human screening required.",
            }
        )

    normalized = []
    for nct_id, record in sorted(records.items()):
        normalized.append({**record, "question_ids": "|".join(sorted(memberships[nct_id]))})
    link_rows = [
        {
            "link_candidate_id": f"LINK-CTGOV-{nct_id}-PMID-{pmid}",
            "registry_record_id": f"REC-CTGOV-{nct_id}",
            "nct_id": nct_id,
            "pubmed_record_id": f"REC-PUBMED-{pmid}",
            "pmid": pmid,
            "reference_type": reference_type,
            "linkage_status": "needs_human_report_study_review",
        }
        for nct_id, pmid, reference_type in sorted(pmid_links)
    ]
    interim = REPO / "data/interim"
    write_csv(interim / "clinicaltrials_records.csv", normalized, list(normalized[0].keys()))
    write_csv(interim / "clinicaltrials_retrievals.csv", retrievals, list(retrievals[0].keys()))
    write_csv(
        interim / "registry_report_link_candidates.csv",
        link_rows,
        ["link_candidate_id", "registry_record_id", "nct_id", "pubmed_record_id", "pmid", "reference_type", "linkage_status"],
    )
    write_csv(
        REPO / "research/searches/clinicaltrials_search_log.csv",
        search_log,
        list(search_log[0].keys()),
    )
    summary = {
        "status": "synthetic_proxy_unreviewed",
        "checksum_verified_files": verified_files,
        "retrieval_instances": len(retrievals),
        "unique_registry_records": len(normalized),
        "cross_question_duplicate_instances": len(retrievals) - len(normalized),
        "registry_to_pubmed_link_candidates": len(link_rows),
        "human_registry_decisions": 0,
        "human_linkage_decisions": 0,
    }
    (interim / "clinicaltrials_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
