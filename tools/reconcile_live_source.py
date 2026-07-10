#!/usr/bin/env python3
"""Re-hash the live G: research root and reconcile it with the preserved audit."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path("."))
    parser.add_argument("--source", type=Path, required=True)
    args = parser.parse_args()
    repo = args.repo.resolve()
    source = args.source.resolve()
    snapshot_path = repo / "research/audit/legacy_source_audit/audit_report.json"
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8-sig"))

    live = []
    extensions: Counter[str] = Counter()
    for path in sorted(item for item in source.rglob("*") if item.is_file()):
        relative = path.relative_to(source).as_posix()
        live.append(
            {
                "path": relative,
                "size_bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
        )
        extensions[path.suffix.lower() or "[no suffix]"] += 1

    old = {str(item["path"]).replace("\\", "/"): item for item in snapshot["files"]}
    new = {item["path"]: item for item in live}
    missing = sorted(set(old) - set(new))
    added = sorted(set(new) - set(old))
    mismatches = []
    for relative in sorted(set(old) & set(new)):
        if old[relative]["size_bytes"] != new[relative]["size_bytes"] or old[relative]["sha256"] != new[relative]["sha256"]:
            mismatches.append(
                {
                    "path": relative,
                    "snapshot_size": old[relative]["size_bytes"],
                    "live_size": new[relative]["size_bytes"],
                    "snapshot_sha256": old[relative]["sha256"],
                    "live_sha256": new[relative]["sha256"],
                }
            )

    report = {
        "schema_version": "1.0.0",
        "verified_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "verification_mode": "live_filesystem_hash",
        "source_root": str(source),
        "snapshot_report": snapshot_path.relative_to(repo).as_posix(),
        "snapshot_report_sha256": sha256(snapshot_path),
        "snapshot_file_count": len(old),
        "live_file_count": len(new),
        "live_total_size_bytes": sum(item["size_bytes"] for item in live),
        "extension_counts": dict(sorted(extensions.items())),
        "missing_from_live": missing,
        "added_since_snapshot": added,
        "content_mismatches": mismatches,
        "exact_match": not missing and not added and not mismatches,
        "files": live,
    }
    output = repo / "research/audit/live_source_reconciliation.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "snapshot": len(old),
                "live": len(new),
                "missing": len(missing),
                "added": len(added),
                "mismatches": len(mismatches),
                "exact_match": report["exact_match"],
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
