#!/usr/bin/env python3
"""v3.0 산출물을 G 드라이브 제출 폴더로 복사하고 SHA-256 으로 검증한다.

기존 v2.1 자료를 덮어쓰지 않는다. 파일명이 겹치는 매니페스트류는
`03_연구부록/v3.0_완전AI자율트랙/` 하위에 둔다. 이름이 같아 덮어써야 하는
`amendments.csv` 는 먼저 백업본을 만든 뒤 복사한다.

사용법
    python tools/sync_gdrive_v30.py            # 실행 보고서를 제외한 전량 동기화
    python tools/sync_gdrive_v30.py --report   # 실행 보고서만 동기화(보고서 생성 뒤)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GDRIVE = Path(r"G:\내 드라이브\여형준님\24 전공심화실습(1)\여형준")
APPENDIX = GDRIVE / "03_연구부록"
V3DIR = APPENDIX / "v3.0_완전AI자율트랙"
TALKDIR = GDRIVE / "06_발표자료"
THESISDIR = GDRIVE / "02_졸업논문"
SYNC_LOG = ROOT / "research/logs/gdrive_sync_v30.json"

RUN_REPORT = ROOT / "research/logs/v30_run_report.json"

# (저장소 경로, 대상 경로) — 대상 이름은 v2.1 원본과 충돌하지 않도록 접두어를 붙였다.
PLAN: list[tuple[str, Path]] = [
    ("research/searches_v3/ai_picos/picos_definition.json", V3DIR / "picos_definition.json"),
    (
        "research/synthesis/screener_vs_ai_reference_v3.json",
        V3DIR / "screener_vs_ai_reference_v3.json",
    ),
    ("research/synthesis/picos_track_comparison.json", V3DIR / "picos_track_comparison.json"),
    ("research/protocol/protocol-v3.0-full-ai.md", V3DIR / "protocol-v3.0-full-ai.md"),
    ("research/reports/notion_update.md", V3DIR / "notion_update.md"),
    ("data/curated_v3/corpus_manifest.json", V3DIR / "corpus_manifest_v3.json"),
    ("research/screening/v30_agent/manifest.json", V3DIR / "screening_v30_agent_manifest.json"),
    (
        "research/validation/screening_ai_reference_v3/manifest.json",
        V3DIR / "screening_ai_reference_v3_manifest.json",
    ),
    (
        "research/systematic_review_v30/manifest.json",
        V3DIR / "systematic_review_v30_manifest.json",
    ),
    (
        "research/systematic_review_v30/core_manifest.json",
        V3DIR / "systematic_review_v30_core_manifest.json",
    ),
    (
        "research/systematic_review_v30/validation.json",
        V3DIR / "systematic_review_v30_validation.json",
    ),
    ("research/reports/발표원고_v3.0.md", TALKDIR / "발표원고_v3.0.md"),
    ("research/thesis/thesis_v30.docx", THESISDIR / "여형준_졸업논문_최종본.docx"),
    ("research/thesis/thesis_v30.pdf", THESISDIR / "여형준_졸업논문_최종본.pdf"),
    # 이름이 같은 자리에 덮어쓰는 유일한 파일. 저장소본이 기존 8행을 모두 포함한 상위집합이다.
    ("research/protocol/amendments.csv", APPENDIX / "amendments.csv"),
]

BACKUP_BEFORE_OVERWRITE = {
    APPENDIX / "amendments.csv": APPENDIX / "amendments_v21백업.csv",
    THESISDIR / "여형준_졸업논문_최종본.docx": THESISDIR / "여형준_졸업논문_최종본_v21백업.docx",
    THESISDIR / "여형준_졸업논문_최종본.pdf": THESISDIR / "여형준_졸업논문_최종본_v21백업.pdf",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def copy_verified(src: Path, dst: Path) -> dict:
    """복사 후 원본과 사본의 SHA-256 을 비교한 결과를 돌려준다."""
    entry: dict = {
        "source": rel(src),
        "destination": dst.as_posix(),
        "source_sha256": sha256(src),
        "backup_created": None,
        "overwrote_existing": dst.exists(),
    }
    backup = BACKUP_BEFORE_OVERWRITE.get(dst)
    if backup is not None and dst.exists():
        if backup.exists():
            entry["backup_created"] = f"{backup.as_posix()} (이미 존재해 덮어쓰지 않음)"
        else:
            shutil.copy2(dst, backup)
            entry["backup_created"] = backup.as_posix()

    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    entry["destination_sha256"] = sha256(dst)
    entry["sha256_match"] = entry["destination_sha256"] == entry["source_sha256"]
    entry["bytes"] = dst.stat().st_size
    return entry


def load_log() -> dict:
    if SYNC_LOG.exists():
        return json.loads(SYNC_LOG.read_text(encoding="utf-8"))
    return {"schema_version": 1, "track": "v3.0_full_ai_autonomy", "files": []}


def save_log(log: dict) -> None:
    SYNC_LOG.write_text(
        json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n"
    )


def upsert(log: dict, entry: dict) -> None:
    files = [f for f in log["files"] if f["destination"] != entry["destination"]]
    files.append(entry)
    log["files"] = sorted(files, key=lambda f: f["destination"])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true", help="실행 보고서만 동기화한다")
    args = parser.parse_args()

    if not GDRIVE.exists():
        raise SystemExit(f"G 드라이브 경로를 찾을 수 없다: {GDRIVE}")

    log = load_log()
    log["synced_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    log["gdrive_root"] = GDRIVE.as_posix()
    log["policy"] = (
        "기존 v2.1 원본과 90_legacy 는 삭제·재구성하지 않는다. 이름이 겹치는 v3 매니페스트는 "
        "03_연구부록/v3.0_완전AI자율트랙/ 하위에 두고, 유일하게 같은 자리를 덮어쓰는 "
        "amendments.csv 는 백업본을 먼저 만든다."
    )

    plan = (
        [(rel(RUN_REPORT), V3DIR / "v30_run_report.json")]
        if args.report
        else [(src, dst) for src, dst in PLAN]
    )

    failures = []
    for src_rel, dst in plan:
        src = ROOT / src_rel
        if not src.exists():
            raise SystemExit(f"원본이 없다: {src_rel}")
        entry = copy_verified(src, dst)
        upsert(log, entry)
        mark = "OK " if entry["sha256_match"] else "MISMATCH "
        print(f"{mark}{src_rel} -> {dst}")
        if not entry["sha256_match"]:
            failures.append(src_rel)

    log["file_count"] = len(log["files"])
    log["all_sha256_match"] = all(f["sha256_match"] for f in log["files"])
    save_log(log)
    print(f"\n동기화 {len(plan)}건, 누적 {log['file_count']}건, 전체 해시 일치: {log['all_sha256_match']}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
