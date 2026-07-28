"""v4.0 로컬 전용 산출물의 크기와 SHA-256을 기록한다.

`.gitignore`가 제외하는 v4.0 경로는 용량 때문이지 폐기 때문이 아니다. 제외된
파일이 무엇이었고 어떤 바이트였는지를 남기지 않으면 추적 체인이 끊기므로,
`research/searches/`의 `checksum.sha256`과 같은 역할을 하는 목록을 만든다.

`research/logs/v40_local_only_manifest.json`을 덮어쓴다.
"""

from __future__ import annotations

import fnmatch
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "logs" / "v40_local_only_manifest.json"

# (설명, 루트 상대 glob) — .gitignore의 v4.0 블록과 같은 대상을 가리켜야 한다.
PATTERNS: list[tuple[str, str]] = [
    ("efetch_xml", "research/searches_v4/*/pubmed/*/efetch_*.xml"),
    ("corpus", "data/curated_v4/evidence_map.csv"),
    ("screening_batches", "research/screening/v40_agent/batches/*"),
    # 실패 작업기 산출물은 audit/ decisions/ 아래에 한 단계 더 들어가 있다.
    ("failed_classifiers", "research/screening/v40_agent/etc/failed_classifier_*/**/*"),
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        # 코퍼스 CSV가 114 MiB라 통째로 읽지 않는다.
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def collect(pattern: str) -> list[Path]:
    matched = [
        path
        for path in ROOT.glob(pattern.replace("/", "/"))
        if path.is_file()
    ]
    if not matched:
        # glob이 디렉토리 단위 패턴이면 하위 전체를 훑는다.
        base = pattern.split("*")[0]
        root = ROOT / base
        if root.is_dir():
            matched = [
                path
                for path in root.rglob("*")
                if path.is_file() and fnmatch.fnmatch(path.relative_to(ROOT).as_posix(), pattern)
            ]
    return sorted(matched)


def main() -> None:
    groups = []
    total_bytes = 0
    total_files = 0
    for label, pattern in PATTERNS:
        files = collect(pattern)
        entries = []
        for path in files:
            size = path.stat().st_size
            entries.append(
                {
                    "path": path.relative_to(ROOT).as_posix(),
                    "bytes": size,
                    "sha256": sha256(path),
                }
            )
            total_bytes += size
        total_files += len(entries)
        groups.append(
            {
                "group": label,
                "gitignore_pattern": pattern,
                "file_count": len(entries),
                "bytes": sum(entry["bytes"] for entry in entries),
                "files": entries,
            }
        )

    manifest = {
        "schema_version": "1.0.0",
        "track": "v4.0_mecir_search_redesign",
        "purpose": (
            "git에서 제외한 v4.0 대용량 산출물의 바이트 단위 기록. 제외 사유는 용량이며 "
            "폐기가 아니다. 재현 시 이 해시로 로컬 사본의 동일성을 확인한다."
        ),
        "total_file_count": total_files,
        "total_bytes": total_bytes,
        "groups": groups,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"files": total_files, "bytes": total_bytes, "out": OUT.relative_to(ROOT).as_posix()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
