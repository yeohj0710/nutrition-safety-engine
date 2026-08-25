"""원장이 기록한 산출물 경로의 SHA-256 을 다시 계산해 대조한다.

`research/logs/v40_run_report.json` 은 297 경로의 해시를 담은 봉인 원장이고
재생성이 불가능하다(`finalize_run_report_v4.py` 가 커밋 후 실행을 거부한다).
따라서 이 스크립트는 **읽기만 한다.** 어떤 파일도 쓰지 않는다.

대용량 원자료는 설계상 저장소에 없다(efetch XML 242개, evidence_map.csv 114.5 MiB 등).
체크아웃에 없는 경로는 실패로 세지 않고 건너뛴 수로 보고하므로, CI 에서도
있는 것만 대조할 수 있다. 해시가 어긋나면 종료 코드 1 로 끝난다.

사용:
    python tools/v40/verify_ledger_artifacts.py
    python tools/v40/verify_ledger_artifacts.py --require-all   # 로컬 전용까지 전부 요구
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
LEDGER = ROOT / "research" / "logs" / "v40_run_report.json"

PATH_KEYS = ("path", "raw_source_path")
HASH_KEYS = ("sha256", "raw_source_sha256")


def collect(node: Any, out: dict[str, str]) -> None:
    """원장 어디에 있든 (경로, 해시) 짝을 모은다."""
    if isinstance(node, dict):
        path_key = next((k for k in PATH_KEYS if isinstance(node.get(k), str)), None)
        hash_key = next((k for k in HASH_KEYS if isinstance(node.get(k), str)), None)
        if path_key and hash_key:
            out[node[path_key]] = node[hash_key].lower()
        for value in node.values():
            collect(value, out)
    elif isinstance(node, list):
        for value in node:
            collect(value, out)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--require-all",
        action="store_true",
        help="로컬 전용 대용량 파일까지 전부 있어야 통과로 본다",
    )
    args = parser.parse_args()

    if not LEDGER.is_file():
        raise SystemExit(f"원장이 없습니다: {LEDGER}")

    recorded: dict[str, str] = {}
    collect(json.loads(LEDGER.read_text(encoding="utf-8")), recorded)

    matched: list[str] = []
    mismatched: list[tuple[str, str, str]] = []
    missing: list[str] = []

    for rel, expected in sorted(recorded.items()):
        # 원장의 경로는 항상 "/" 구분자다. pathlib 이 두 OS 모두에서 알아서 처리한다.
        target = ROOT.joinpath(*rel.split("/"))
        if not target.is_file():
            missing.append(rel)
            continue
        actual = sha256_file(target)
        if actual == expected:
            matched.append(rel)
        else:
            mismatched.append((rel, expected, actual))

    print(f"원장 경로 {len(recorded)}개")
    print(f"  해시 일치 {len(matched)}")
    print(f"  해시 불일치 {len(mismatched)}")
    print(f"  체크아웃에 없음 {len(missing)} (로컬 전용 대용량 파일)")

    for rel, expected, actual in mismatched:
        print(f"    불일치 {rel}\n      원장 {expected}\n      현재 {actual}")

    if mismatched:
        raise SystemExit(1)
    if args.require_all and missing:
        for rel in missing[:20]:
            print(f"    없음 {rel}")
        raise SystemExit(1)
    if not matched:
        raise SystemExit("대조한 파일이 하나도 없습니다. 원장 구조를 확인하세요.")


if __name__ == "__main__":
    main()
