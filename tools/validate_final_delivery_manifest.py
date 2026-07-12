from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(r"G:\내 드라이브\여형준님\24 전공심화실습(1)\여형준")
MANIFEST = ROOT / "FINAL_MANIFEST.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
errors: list[str] = []
rows = payload.get("files", [])
if payload.get("file_count") != len(rows):
    errors.append("file_count does not match manifest rows")
listed = {row.get("path") for row in rows}
actual = {path.relative_to(ROOT).as_posix() for path in ROOT.rglob("*") if path.is_file() and path != MANIFEST}
for missing in sorted(actual - listed):
    errors.append(f"unlisted file: {missing}")
for stale in sorted(listed - actual):
    errors.append(f"missing file: {stale}")
for row in rows:
    path = ROOT / str(row["path"])
    if not path.is_file():
        continue
    if path.stat().st_size != row.get("bytes"):
        errors.append(f"size mismatch: {row['path']}")
    if sha256(path) != row.get("sha256"):
        errors.append(f"SHA-256 mismatch: {row['path']}")
result = {"status": "valid" if not errors else "invalid", "errors": errors, "file_count": len(rows), "root": str(ROOT)}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(1 if errors else 0)
