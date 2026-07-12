#!/usr/bin/env python3
"""Validate the source-bound external-review workbook manifest."""

import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = ROOT / "research/review_queue/external_review_handoff.xlsx"
MANIFEST = ROOT / "research/review_queue/external_review_handoff_manifest.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors = []
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("status") != "external_human_handoff_copy_not_research_results":
        errors.append("workbook authority boundary missing")
    if manifest.get("workbook_sha256") != sha(WORKBOOK):
        errors.append("workbook hash mismatch")
    for relative, expected in manifest.get("sources", {}).items():
        path = ROOT / relative
        if not path.is_file() or sha(path) != expected:
            errors.append(f"source hash mismatch: {relative}")
    if manifest.get("sheets") != {"README": 9, "PRESS_Main": 8, "PRESS_Korean": 40,
                                  "Dedup_Context": 342, "Registry_Links": 500, "Registry_Decisions": 500,
                                  "KoreaMed_Links": 35,
                                  "Screening_Pilot": 50, "Pilot_Decisions": 50}:
        errors.append("workbook sheet row-count contract mismatch")
    if manifest.get("visual_qa") != {"rendered_sheets": ["README", "PRESS Main", "PRESS Korean", "Dedup Context", "Registry Links", "Registry Decisions", "KoreaMed Links", "Screening Pilot", "Pilot Decisions"],
                                      "inspected_sheets": 9, "defects_open": 0}:
        errors.append("nine-sheet visual QA evidence missing")
    try:
        with zipfile.ZipFile(WORKBOOK) as archive:
            workbook_xml = archive.read("xl/workbook.xml").decode("utf-8")
            if any(name not in workbook_xml for name in ("README", "PRESS Main", "PRESS Korean", "Dedup Context", "Registry Links", "Registry Decisions", "KoreaMed Links", "Screening Pilot", "Pilot Decisions")):
                errors.append("one or more workbook sheets missing")
    except (zipfile.BadZipFile, KeyError):
        errors.append("invalid XLSX package")
    if len(manifest.get("sources", {})) != 9:
        errors.append("expected nine canonical workbook sources")
    result = {"errors": errors, "workbook_sha256": sha(WORKBOOK), "sources": len(manifest.get("sources", {})),
              "sheets": len(manifest.get("sheets", {})), "status": "valid" if not errors else "invalid"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
