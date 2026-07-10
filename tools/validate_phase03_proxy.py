#!/usr/bin/env python3
"""Validate full-export PubMed proxy artifacts while keeping final human gates open."""

from __future__ import annotations

import csv
import hashlib
import json
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


def csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    errors: list[str] = []
    manifest_files: list[dict[str, Any]] = []
    exported_total = 0

    for question in QUESTIONS:
        run_id = f"pubmed_{question.lower()}_designpilot_{RUN_DATE}"
        run_dir = REPO / "research" / "searches" / question / "pubmed" / run_id
        metadata_path = run_dir / "response_metadata.json"
        if not metadata_path.is_file():
            errors.append(f"missing metadata: {question}")
            continue
        metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig"))
        ids = [
            value.strip()
            for value in (run_dir / "ids.txt").read_text(encoding="utf-8").splitlines()
            if value.strip()
        ]
        if len(ids) != len(set(ids)):
            errors.append(f"duplicate PMID in raw ID export: {question}")
        if len(ids) != metadata.get("records_exported"):
            errors.append(f"metadata/ID count mismatch: {question}")
        if metadata.get("total_hits_reported") != metadata.get("records_exported"):
            errors.append(f"reported/exported count mismatch: {question}")
        if metadata.get("top_n_truncation") is not False:
            errors.append(f"top-N truncation not prohibited: {question}")
        if metadata.get("status") != "design_pilot_full_export_not_final_search":
            errors.append(f"proxy status missing: {question}")
        expected_batches = (len(ids) + 199) // 200
        xml_files = sorted(run_dir.glob("efetch_*.xml"))
        if len(xml_files) != expected_batches:
            errors.append(f"EFetch batch count mismatch: {question}")

        checksum_lines = (run_dir / "checksum.sha256").read_text(encoding="utf-8").splitlines()
        checksum_names = set()
        for line in checksum_lines:
            if not line.strip():
                continue
            expected, name = line.split("  ", 1)
            checksum_names.add(name)
            file_path = run_dir / name
            if not file_path.is_file() or sha256(file_path) != expected:
                errors.append(f"checksum mismatch: {question}/{name}")
        expected_names = {
            path.name for path in run_dir.iterdir() if path.is_file() and path.name != "checksum.sha256"
        }
        if checksum_names != expected_names:
            errors.append(f"checksum coverage mismatch: {question}")
        exported_total += len(ids)
        for file_path in sorted(path for path in run_dir.iterdir() if path.is_file()):
            manifest_files.append(
                {
                    "path": file_path.relative_to(REPO).as_posix(),
                    "size_bytes": file_path.stat().st_size,
                    "sha256": sha256(file_path),
                    "distribution": "local_raw" if file_path.suffix == ".xml" else "tracked_metadata",
                }
            )

    interim = REPO / "data" / "interim"
    required_outputs = [
        interim / "records.csv",
        interim / "record_retrievals.csv",
        interim / "duplicate_candidates.csv",
        interim / "deduplication_decisions.csv",
        interim / "report_candidates.csv",
        interim / "dedup_summary.json",
        REPO / "research/searches/search_log.csv",
        REPO / "research/searches/search_recall_check.md",
        REPO / "research/searches/phase_03_exit_criteria.md",
    ]
    for path in required_outputs:
        if not path.is_file():
            errors.append(f"missing normalized output: {path.relative_to(REPO)}")
        else:
            manifest_files.append(
                {
                    "path": path.relative_to(REPO).as_posix(),
                    "size_bytes": path.stat().st_size,
                    "sha256": sha256(path),
                    "distribution": "local_generated" if path.name == "records.csv" else "tracked_generated",
                }
            )

    if not errors:
        records = csv_rows(interim / "records.csv")
        retrievals = csv_rows(interim / "record_retrievals.csv")
        candidates = csv_rows(interim / "duplicate_candidates.csv")
        decisions = csv_rows(interim / "deduplication_decisions.csv")
        reports = csv_rows(interim / "report_candidates.csv")
        summary = json.loads((interim / "dedup_summary.json").read_text(encoding="utf-8-sig"))
        search_log = csv_rows(REPO / "research/searches/search_log.csv")
        if exported_total != 19961 or len(retrievals) != exported_total:
            errors.append("retrieval total differs from five reconciled pilots")
        if len(records) != 19609 or len(reports) != len(records):
            errors.append("normalized record/report count mismatch")
        if len(candidates) != 342 or len(decisions) != len(candidates):
            errors.append("duplicate candidate/decision queue count mismatch")
        if any(row["status"] not in {"pending_external_human_review", "in_progress_external_human_review", "complete_candidate_requires_validation"} for row in decisions):
            errors.append("human dedup queue contains an invalid progress state")
        if any(row.get("linkage_status") not in {"pending_external_human_review", "in_progress_external_human_review", "complete_candidate_requires_validation"} for row in reports):
            errors.append("report candidates contain an invalid linkage state")
        if len(search_log) != 5 or any(
            row["status"] != "design_pilot_full_export_not_final_search" for row in search_log
        ):
            errors.append("search log is incomplete or overstated")
        if not all(item["retrieved"] for item in summary["sentinel_checks"]):
            errors.append("one or more sentinels were not retrieved")

    manifest = {
        "schema_version": "1.0.0",
        "status": "synthetic_proxy_unreviewed",
        "generated_at": "2026-07-10",
        "file_count": len(manifest_files),
        "files": sorted(manifest_files, key=lambda item: item["path"]),
        "errors": errors,
        "final_search_claim_allowed": False,
    }
    manifest_path = REPO / "research/searches/proxy_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "errors": errors,
                "phase_status": "blocked_external",
                "proxy_pipeline_status": "complete_verified" if not errors else "failed_quality_gate",
                "raw_and_output_manifest_files": len(manifest_files),
                "retrieval_instances": exported_total,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
