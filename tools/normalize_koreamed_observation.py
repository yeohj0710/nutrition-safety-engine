#!/usr/bin/env python3
"""Normalize the complete displayed KoreaMed design-pilot result set."""

import csv
import hashlib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "research/searches/koreamed_designpilot_20260710"
OBS = RUN / "browser_observation.json"
STATUS = "design_pilot_complete_display_native_export_server_error_not_final_search"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalized_title(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).lower()
    return re.sub(r"[^a-z0-9가-힣]+", " ", value).strip()


def write_csv(path: Path, fields: list[str], rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    observation = json.loads(OBS.read_text(encoding="utf-8"))
    queries_dir = RUN / "queries"
    queries_dir.mkdir(exist_ok=True)
    log = []
    for row in observation["runs"]:
        path = queries_dir / f"{row['question_id']}.txt"
        path.write_text(row["query"] + "\n", encoding="utf-8")
        log.append({
            "search_run_id": f"koreamed_{row['question_id'].lower()}_designpilot_20260710",
            "question_id": row["question_id"],
            "database": "KoreaMed",
            "search_date": "2026-07-10",
            "query_file": path.relative_to(ROOT).as_posix(),
            "query_sha256": sha256(path),
            "hits_observed": row["hits"],
            "records_captured": row["displayed_records"],
            "native_records_exported": row["records_exported"],
            "status": STATUS,
        })
    write_csv(RUN / "search_log.csv", list(log[0]), log)

    records = []
    for item in observation["a1_records"]:
        records.append({
            "record_id": f"REC-KOREAMED-{item['kmid']}",
            "kmid": item["kmid"],
            "title": item["title"],
            "normalized_title": normalized_title(item["title"]),
            "url": f"https://www.koreamed.org/SearchBasic.php?RID={item['kmid']}",
            "source_status": STATUS,
            "human_eligibility_decision": "",
        })
    write_csv(
        ROOT / "data/interim/koreamed_records.csv",
        ["record_id", "kmid", "title", "normalized_title", "url", "source_status", "human_eligibility_decision"],
        records,
    )
    retrievals = [{
        "retrieval_id": f"RET-A1-KOREAMED-{row['kmid']}",
        "record_id": row["record_id"],
        "question_id": "A1",
        "search_run_id": "koreamed_a1_designpilot_20260710",
        "database": "KoreaMed",
        "provider_id": row["kmid"],
        "status": STATUS,
    } for row in records]
    write_csv(
        ROOT / "data/interim/koreamed_retrievals.csv",
        ["retrieval_id", "record_id", "question_id", "search_run_id", "database", "provider_id", "status"],
        retrievals,
    )
    review_queue = [{
        "record_id": row["record_id"],
        "kmid": row["kmid"],
        "question_id": "A1",
        "title": row["title"],
        "source_status": STATUS,
        "reviewer_1_id": "",
        "reviewer_1_decision": "",
        "reviewer_2_id": "",
        "reviewer_2_decision": "",
        "adjudicator_id": "",
        "final_decision": "",
        "notes": "Awaiting human screening; browser capture is not an eligibility decision.",
    } for row in records]
    write_csv(
        ROOT / "data/interim/koreamed_review_queue.csv",
        ["record_id", "kmid", "question_id", "title", "source_status", "reviewer_1_id", "reviewer_1_decision", "reviewer_2_id", "reviewer_2_decision", "adjudicator_id", "final_decision", "notes"],
        review_queue,
    )

    with (ROOT / "data/interim/records.csv").open(encoding="utf-8-sig", newline="") as handle:
        pubmed = list(csv.DictReader(handle))
    by_title = {}
    for row in pubmed:
        by_title.setdefault(normalized_title(row["title"]), []).append(row)
    links = []
    for row in records:
        for candidate in by_title.get(row["normalized_title"], []):
            links.append({
                "koreamed_record_id": row["record_id"],
                "kmid": row["kmid"],
                "pubmed_record_id": candidate["record_id"],
                "pmid": candidate["pmid"],
                "match_basis": "exact_normalized_title",
                "human_link_decision": "",
                "status": "candidate_requires_human_review",
            })
    write_csv(
        ROOT / "data/interim/koreamed_pubmed_link_candidates.csv",
        ["koreamed_record_id", "kmid", "pubmed_record_id", "pmid", "match_basis", "human_link_decision", "status"],
        links,
    )
    outputs = [
        OBS, RUN / "search_log.csv", ROOT / "data/interim/koreamed_records.csv",
        ROOT / "data/interim/koreamed_retrievals.csv", ROOT / "data/interim/koreamed_review_queue.csv",
        ROOT / "data/interim/koreamed_pubmed_link_candidates.csv",
        *sorted(queries_dir.glob("*.txt")),
    ]
    checksum = RUN / "checksum.sha256"
    checksum.write_text("".join(f"{sha256(path)}  {path.relative_to(ROOT).as_posix()}\n" for path in outputs), encoding="utf-8")
    summary = {
        "schema_version": "1.0.0",
        "status": STATUS,
        "runs": 5,
        "hits_observed": 62,
        "records_captured": len(records),
        "unique_kmids": len({row["kmid"] for row in records}),
        "native_records_exported": 0,
        "exact_title_link_candidates": len(links),
        "human_eligibility_decisions": 0,
        "human_link_decisions": 0,
        "final_search_claim_allowed": False,
        "export_error": observation["export_observation"]["server_error"],
        "checksum_manifest_sha256": sha256(checksum),
    }
    (RUN / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
