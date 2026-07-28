"""v4.0 산출물의 커밋·푸시·배포 사실을 기록한다.

`research/logs/v40_run_report.json` 은 연구 실행 시점에 봉인된 원장이며
`commit_created` / `push_performed` / `deployment_performed` 가 전부 false 다.
그 값은 원장 생성 시점 기준으로 맞다. 이후 인계가 이루어졌으므로 원장을
고쳐 쓰는 대신 별도 영수증을 만든다. 원장을 다시 생성하면
`finalize_run_report_v4.py` 의 legacy 경로 가드가 커밋 이후의 깨끗한
작업트리를 변경으로 판정해 거부하며, `DECISIONS_v40.md` 의 기록 해시도
어긋난다.

`research/logs/v40_delivery_receipt.json` 을 덮어쓴다.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEDGER = ROOT / "research" / "logs" / "v40_run_report.json"
OUT = ROOT / "research" / "logs" / "v40_delivery_receipt.json"


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf-8"
    ).stdout.strip()


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("usage: build_delivery_receipt.py <deployment_url> <production_alias>")
    deployment_url, alias = sys.argv[1], sys.argv[2]

    ledger_bytes = LEDGER.read_bytes()
    ledger = json.loads(ledger_bytes.decode("utf-8-sig"))

    receipt = {
        "schema_version": "1.0.0",
        "track": ledger["track"],
        "purpose": (
            "봉인된 원장 v40_run_report.json 이후에 일어난 인계 사실 기록. "
            "원장의 commit_created·push_performed·deployment_performed 가 false 인 것은 "
            "원장 생성 시점 기준이며, 현재 상태는 이 파일이 가리킨다."
        ),
        "ledger": {
            "path": LEDGER.relative_to(ROOT).as_posix(),
            "sha256": hashlib.sha256(ledger_bytes).hexdigest(),
            "run_status": ledger["run_status"],
            "head_at_ledger_generation": ledger["git"]["head_at_end"],
        },
        "git": {
            "branch": git("rev-parse", "--abbrev-ref", "HEAD"),
            "head": git("rev-parse", "HEAD"),
            "remote": git("remote", "get-url", "origin"),
            "pushed": git("rev-parse", "HEAD") == git("rev-parse", "origin/main"),
            "working_tree_clean": git("status", "--porcelain") == "",
            "commits": [
                {"sha": sha, "subject": subject}
                for sha, subject in (
                    line.split(" ", 1)
                    for line in git(
                        "log",
                        "--format=%H %s",
                        f"{ledger['git']['head_at_end']}..HEAD",
                    ).splitlines()
                    if line
                )
            ],
        },
        "deployment": {
            "provider": "vercel",
            "method": "npx vercel --prod --yes",
            "note": "이 저장소는 GitHub 연동이 없어 push 로는 배포되지 않는다.",
            "target": "production",
            "deployment_url": deployment_url,
            "production_alias": alias,
            "site_data_track": "v3.0",
            "site_serves_v40": False,
            "site_note": (
                "사이트는 여전히 v3.0 산출물을 쓴다. v4.0 을 사이트에 반영하는 것은 "
                "이 트랙의 범위가 아니며 DECISIONS_v40.md 하류 산출물 절에 그렇게 적혀 있다."
            ),
        },
        "verification_before_deploy": {
            "typecheck": "npm run typecheck",
            "lint": "npm run lint",
            "test": "npm test",
            "build": "npm run build",
        },
        "release_ready": False,
        "release_ready_note": (
            "사이트 배포는 임상적 공개 승인이 아니다. 사람 독립 선별, 편향 평가, "
            "근거 확실성 평가가 없으므로 false 를 유지한다."
        ),
    }
    OUT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"out": OUT.relative_to(ROOT).as_posix(), "head": receipt["git"]["head"], "pushed": receipt["git"]["pushed"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
