#!/usr/bin/env python3
"""Profile live legacy research tables and document duplicates without promoting them."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_csv(path: Path) -> tuple[str, list[dict[str, str]]]:
    for encoding in ("utf-8-sig", "utf-8", "cp949"):
        try:
            with path.open("r", encoding=encoding, newline="") as handle:
                return encoding, list(csv.DictReader(handle))
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Unable to decode {path}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path("."))
    parser.add_argument("--source", type=Path, required=True)
    args = parser.parse_args()
    repo = args.repo.resolve()
    source = args.source.resolve()
    csv_profiles = []
    hash_groups: dict[str, list[str]] = defaultdict(list)
    selected_tokens = (
        "review", "decision", "status", "verify", "human", "screen", "include", "exclude",
        "판정", "검토", "선별", "포함", "제외", "검증", "상태", "승인", "담당",
    )

    for path in sorted(item for item in source.rglob("*") if item.is_file()):
        digest = sha256(path)
        hash_groups[digest].append(path.relative_to(source).as_posix())
        if path.suffix.lower() != ".csv":
            continue
        encoding, rows = read_csv(path)
        headers = list(rows[0].keys()) if rows else []
        selected = {}
        for header in headers:
            lowered = header.lower()
            if any(token in lowered for token in selected_tokens):
                values = sorted({str(row.get(header, "")).strip() for row in rows})
                selected[header] = values[:30]
        csv_profiles.append(
            {
                "path": path.relative_to(source).as_posix(),
                "sha256": digest,
                "encoding": encoding,
                "rows": len(rows),
                "headers": headers,
                "selected_values": selected,
                "sample_rows": rows[:2],
            }
        )

    unique_hashes = {
        digest: paths for digest, paths in sorted(hash_groups.items()) if len(paths) > 1
    }
    report = {
        "source_root": str(source),
        "csv_file_count": len(csv_profiles),
        "unique_csv_hashes": len({item["sha256"] for item in csv_profiles}),
        "csv_profiles": csv_profiles,
        "duplicate_hash_groups": unique_hashes,
    }
    output = repo / "research/audit/live_research_profiles.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"csv_files": len(csv_profiles), "unique_csv_hashes": report["unique_csv_hashes"], "duplicate_groups": len(unique_hashes)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
