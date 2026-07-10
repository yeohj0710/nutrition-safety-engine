#!/usr/bin/env python3
"""Generate a deterministic SHA-256 manifest for a directory."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", type=Path)
    ap.add_argument("--output", type=Path)
    args = ap.parse_args()
    root = args.root.resolve()
    output = (args.output or (root / "manifest.json")).resolve()
    rows = []
    for p in sorted(root.rglob("*")):
        if not p.is_file() or p.resolve() == output:
            continue
        rows.append({
            "path": str(p.relative_to(root)).replace("\\", "/"),
            "size_bytes": p.stat().st_size,
            "sha256": digest(p),
        })
    manifest = {
        "root_name": root.name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "file_count": len(rows),
        "files": rows,
    }
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output} with {len(rows)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
