#!/usr/bin/env python3
"""Persist live CENTRAL hit-count observations without claiming a full export."""

import csv
import hashlib
import json
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS = "design_pilot_hit_count_only_export_blocked_authentication"
OBSERVATIONS = {
    "A1": {
        "query": '(warfarin OR "vitamin K antagonist" OR acenocoumarol OR phenprocoumon) AND ("vitamin K" OR phylloquinone OR menaquinone OR MK-7)',
        "hits": 1664,
    },
    "A2": {
        "query": '(anticoagulant OR anticoagulation OR warfarin OR apixaban OR rivaroxaban OR edoxaban OR dabigatran) AND ("omega-3" OR "fish oil" OR EPA OR DHA OR icosapent)',
        "hits": 111,
    },
    "B1": {
        "query": '("kidney stone" OR "renal stone" OR nephrolithiasis OR urolithiasis OR hypercalciuria) AND ("calcium supplement" OR "supplemental calcium" OR "calcium carbonate" OR "calcium citrate")',
        "hits": 111,
    },
    "B2": {
        "query": '("kidney stone" OR "renal stone" OR nephrolithiasis OR urolithiasis OR hypercalciuria) AND ("vitamin D" OR cholecalciferol OR ergocalciferol OR calcifediol)',
        "hits": 333,
    },
    "B3": {
        "query": '("kidney stone" OR "renal stone" OR nephrolithiasis OR urolithiasis OR hyperoxaluria) AND ("vitamin C" OR "ascorbic acid" OR ascorbate)',
        "hits": 45,
    },
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def result_url(query: str) -> str:
    params = {
        "searchBy": "6",
        "searchText": query,
        "isWordVariations": "",
        "resultPerPage": "25",
        "searchType": "basic",
        "forceTypeSelection": "true",
        "selectedType": "central",
        "displayText": "",
        "orderBy": "relevancy",
        "p_p_id": "scolarissearchresultsportlet_WAR_scolarissearchresults",
        "p_p_lifecycle": "0",
        "p_p_state": "normal",
        "p_p_mode": "view",
        "p_p_col_id": "column-1",
        "p_p_col_count": "1",
    }
    return "https://www.cochranelibrary.com/en/search?" + urllib.parse.urlencode(params)


def main() -> int:
    log_rows = []
    for question, observation in OBSERVATIONS.items():
        run_id = f"central_{question.lower()}_hitcount_designpilot_20260710"
        run_dir = ROOT / f"research/searches/{question}/central/{run_id}"
        run_dir.mkdir(parents=True, exist_ok=True)
        query_path = run_dir / "query.txt"
        query_path.write_text(observation["query"] + "\n", encoding="utf-8")
        metadata = {
            "schema_version": "1.0.0",
            "run_id": run_id,
            "question_id": question,
            "database": "CENTRAL",
            "platform": "Cochrane Library",
            "observed_at": "2026-07-10",
            "query_sha256": sha256(query_path),
            "trials_hits_observed": observation["hits"],
            "records_exported": 0,
            "full_export_complete": False,
            "status": STATUS,
            "result_url": result_url(observation["query"]),
            "browser_evidence": {
                "public_search_box": True,
                "trial_count_link_observed": True,
                "representative_trial_page_question": "B3",
                "representative_authentication_message": "Authenticate to get access to full CENTRAL content",
                "representative_issue": "Issue 6 of 12, June 2026",
            },
            "limitation": "Hit count only. No top-N sample is treated as an export, screening set, or final search.",
            "peer_review_status": "pending_external_PRESS",
            "final_search_claim_allowed": False,
        }
        metadata_path = run_dir / "response_metadata.json"
        metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        checksum_path = run_dir / "checksum.sha256"
        checksum_path.write_text(
            f"{sha256(query_path)}  query.txt\n{sha256(metadata_path)}  response_metadata.json\n",
            encoding="utf-8",
        )
        log_rows.append({
            "search_run_id": run_id,
            "question_id": question,
            "database": "CENTRAL",
            "platform": "Cochrane Library",
            "search_date": "2026-07-10",
            "query_file": query_path.relative_to(ROOT).as_posix(),
            "query_sha256": sha256(query_path),
            "hits_observed": observation["hits"],
            "records_exported": 0,
            "status": STATUS,
            "final_search_claim_allowed": False,
        })
    log_path = ROOT / "research/searches/central_hitcount_log.csv"
    with log_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(log_rows[0]))
        writer.writeheader()
        writer.writerows(log_rows)
    print(json.dumps({"runs": 5, "hits_observed": sum(x["hits"] for x in OBSERVATIONS.values()), "records_exported": 0, "status": STATUS}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
