#!/usr/bin/env python3
"""Generate a truthful non-final manifest including tracked and required local payloads."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUTPUT = REPO / "research/checkpoint_manifest.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=REPO, text=True, encoding="utf-8").strip()


def main() -> int:
    tracked = [REPO / value for value in git("ls-files").splitlines() if value]
    local = sorted((REPO / "research/searches").glob("*/pubmed/*/efetch_*.xml"))
    records = REPO / "data/interim/records.csv"
    if records.is_file():
        local.append(records)
    files = []
    for path in sorted({path.resolve() for path in tracked + local}):
        if path == OUTPUT.resolve() or not path.is_file():
            continue
        files.append(
            {
                "path": path.relative_to(REPO).as_posix(),
                "size_bytes": path.stat().st_size,
                "sha256": sha256(path),
                "distribution": "tracked" if path in tracked else "local_required",
            }
        )
    manifest = {
        "schema_version": "1.0.0",
        "status": "checkpoint_not_final_release",
        "generated_at": "2026-07-10",
        "implementation_head": git("rev-parse", "HEAD"),
        "branch": git("branch", "--show-current"),
        "project_complete": False,
        "validated_claims": 0,
        "validated_thesis_rules": 0,
        "final_docx": None,
        "final_pdf": None,
        "public_validated_deployment": None,
        "file_count": len(files),
        "local_required_file_count": sum(item["distribution"] == "local_required" for item in files),
        "files": files,
    }
    OUTPUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: manifest[key] for key in ("status", "implementation_head", "file_count", "local_required_file_count")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
