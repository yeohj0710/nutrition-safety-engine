#!/usr/bin/env python3
"""Profile a legacy research folder and flag common methodological risks."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Iterable

TEXT_SUFFIXES = {".md", ".txt", ".csv", ".json", ".yaml", ".yml"}
PATTERNS = {
    "relevance_truncation": re.compile(r"sort\s*=\s*relevance|max_records\s*[,=:]\s*(?:20|40|100)\b", re.I),
    "retrieval_cap": re.compile(r"retrieved_(?:pmids|records)\s*=\s*\d+", re.I),
    "unverified_rule": re.compile(r"seed_requires_human_source_check|legacy_unverified", re.I),
    "future_full_text": re.compile(r"후속\s*원문\s*검토|원문\s*검토가?\s*(?:필요|남아)", re.I),
    "narrative_review_label": re.compile(r"종설논문"),
    "year_parse_failure": re.compile(r"year_missing[^\n]*100(?:\.0)?%|year_missing[^\n]*236", re.I),
    "completion_language": re.compile(r"완전\s*종료|최종\s*통합\s*검증|최종\s*산출물", re.I),
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read_text(path: Path) -> str:
    for enc in ("utf-8-sig", "utf-8", "cp949"):
        try:
            return path.read_text(encoding=enc)
        except UnicodeDecodeError:
            continue
        except OSError:
            return ""
    return ""


def csv_profile(path: Path) -> dict:
    text = read_text(path)
    if not text:
        return {"file": str(path), "error": "unreadable"}
    try:
        rows = list(csv.reader(text.splitlines()))
        header = rows[0] if rows else []
        return {
            "file": str(path),
            "rows": max(0, len(rows) - 1),
            "columns": len(header),
            "header": header,
        }
    except csv.Error as exc:
        return {"file": str(path), "error": str(exc)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", type=Path)
    ap.add_argument("--out", type=Path, default=Path("audit_output"))
    args = ap.parse_args()
    root = args.root.resolve()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)

    files = []
    csvs = []
    findings = []
    ext_counts: Counter[str] = Counter()

    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = str(path.relative_to(root))
        ext_counts[path.suffix.lower()] += 1
        files.append({"path": rel, "size_bytes": path.stat().st_size, "sha256": sha256(path)})
        if path.suffix.lower() == ".csv":
            csvs.append(csv_profile(path))
        if path.suffix.lower() in TEXT_SUFFIXES and path.stat().st_size <= 20_000_000:
            text = read_text(path)
            for label, pattern in PATTERNS.items():
                for match in pattern.finditer(text):
                    line = text.count("\n", 0, match.start()) + 1
                    snippet = text[max(0, match.start()-80):match.end()+120].replace("\n", " ")
                    findings.append({"type": label, "file": rel, "line": line, "snippet": snippet[:400]})

    report = {
        "root": str(root),
        "file_count": len(files),
        "extension_counts": dict(sorted(ext_counts.items())),
        "csv_profiles": csvs,
        "findings": findings,
        "files": files,
    }
    (out / "audit_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# Legacy artifact audit",
        "",
        f"- Root: `{root}`",
        f"- Files: {len(files)}",
        f"- CSV files: {len(csvs)}",
        f"- Flagged occurrences: {len(findings)}",
        "",
        "## Extension counts",
        "",
    ]
    lines += [f"- `{k or '[no suffix]'}`: {v}" for k, v in sorted(ext_counts.items())]
    lines += ["", "## Findings", ""]
    for f in findings:
        lines.append(f"- **{f['type']}** — `{f['file']}:{f['line']}` — {f['snippet']}")
    if not findings:
        lines.append("- No configured risk patterns found.")
    (out / "audit_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"files": len(files), "csvs": len(csvs), "findings": len(findings), "out": str(out)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
