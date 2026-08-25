"""번역 초안을 파트 파일에 옮기고, 옮기기 전에 규칙으로 걸러낸다.

`translation_drafts_v41.py` 의 75줄을 읽어 질문별 파트 파일 다섯 개로 쓴다.
쓰기 전에 base_builder 의 검사 두 개를 그대로 돌린다. 한 줄이라도 걸리면 아무
파일도 건드리지 않고 무엇이 왜 걸렸는지 찍는다. 파트 파일이 반쯤 바뀐 채로
남는 상태를 만들지 않기 위해서다.

유료 호출 없음. 같은 입력에 같은 출력이다.

    python -m tools.v41.apply_translation_drafts_v41
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from tools.v41 import base_builder as base
from tools.v41.translation_drafts_v41 import DRAFTS

ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "research" / "systematic_review_v41" / "core_evidence.csv"
PARTS = ROOT / "research" / "systematic_review_v41" / "etc" / "translation_parts"
AUTHOR = "Claude"


def read_core() -> dict[str, dict[str, str]]:
    with CORE.open(encoding="utf-8-sig", newline="") as handle:
        return {
            f"{row['question_id']}|{row['record_id']}": row
            for row in csv.DictReader(handle)
        }


def main() -> None:
    core = read_core()
    missing = sorted(set(core) - set(DRAFTS))
    extra = sorted(set(DRAFTS) - set(core))
    if missing or extra:
        raise SystemExit(f"draft keys do not match core: missing={missing}, extra={extra}")

    problems: list[str] = []
    for key, line in DRAFTS.items():
        source = core[key]["key_finding"]
        if not base.translation_is_valid(source, line):
            problems.append(
                f"{key}\n  숫자·단위: 번역에만 있는 값이 있다\n"
                f"  원문 수치={base.normalized_number_tokens(source)}\n"
                f"  번역 수치={base.normalized_number_tokens(line)}\n"
                f"  원문 단위={base.normalized_unit_tokens(source)}\n"
                f"  번역 단위={base.normalized_unit_tokens(line)}"
            )
        if not base.direction_is_valid(source, line):
            problems.append(f"{key}\n  방향: 원문이 말한 방향이 번역에 없다\n  {line}")
        if "·" in line:
            problems.append(f"{key}\n  가운뎃점을 쓰지 않는다\n  {line}")

    if problems:
        raise SystemExit("\n\n".join(problems) + f"\n\n걸린 줄 {len(problems)}개. 아무것도 쓰지 않았다.")

    by_question: dict[str, dict[str, str]] = {}
    for key, line in DRAFTS.items():
        by_question.setdefault(key.split("|", 1)[0], {})[key] = line

    for question_id, translations in sorted(by_question.items()):
        path = PARTS / f"{question_id.lower()}.json"
        payload = {
            "question_id": question_id,
            "translation_authorship": "ai_generated",
            "author": AUTHOR,
            "translations": dict(sorted(translations.items())),
        }
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=1) + "\n",
            encoding="utf-8",
            newline="",
        )
        print(f"{path.name} rows={len(translations)}")

    print(f"총 {len(DRAFTS)}줄, author={AUTHOR}")


if __name__ == "__main__":
    main()
