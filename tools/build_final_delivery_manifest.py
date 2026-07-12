from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path

ROOT = Path(r"G:\내 드라이브\여형준님\24 전공심화실습(1)\여형준")
OUTPUT = ROOT / "FINAL_MANIFEST.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


files = []
for path in sorted(ROOT.rglob("*"), key=lambda item: item.as_posix().lower()):
    if not path.is_file() or path == OUTPUT:
        continue
    files.append(
        {
            "path": path.relative_to(ROOT).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
    )

payload = {
    "package": "여형준 졸업논문 최종 연구본",
    "schema": "recursive-sha256-v1",
    "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
    "file_count": len(files),
    "files": files,
}
OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"output": str(OUTPUT), "file_count": len(files)}, ensure_ascii=False))
