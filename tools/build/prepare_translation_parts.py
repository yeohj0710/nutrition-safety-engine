"""v41 핵심 근거의 번역 파트 입력을 준비한다.

유료 번역 API를 호출하지 않는다. 이미 있는 v41 번역을 먼저 살리고, 없으면 v40의
같은 record 번역을 검증해 재사용하며, 그것도 없을 때만 원문 수치와 단위, 방향을
보존하는 중립 표지로 채운다.

중립 표지는 사람이 읽을 문장이 아니라 빈자리 표시다. 남아 있으면 화면이 번역
없음으로 보고 조회 한 번에 모델을 12번 부른다. 이 스크립트가 표지를 하나라도
남기면 그 키를 찍으니, tools/build/translation_drafts.py 에 문장을 쓰고
apply_translation_drafts 로 덮어써야 한다.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

from tools.build import base_builder as base


ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "research" / "systematic_review" / "core_evidence.csv"
OLD_PARTS = ROOT / "_보관" / "research" / "systematic_review_v40" / "etc" / "translation_parts"
OUT = ROOT / "research" / "systematic_review" / "etc" / "translation_parts"
PLACEHOLDER = "원문에서 관찰된 결과를 확인합니다"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def part_translations(directory: Path) -> dict[tuple[str, str], str]:
    result: dict[tuple[str, str], str] = {}
    for path in sorted(directory.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        question_id = payload.get("question_id", "")
        for translation_id, value in payload.get("translations", {}).items():
            if translation_id.startswith(f"{question_id}|"):
                result[tuple(translation_id.split("|", 1))] = str(value)
    return result


def neutral_translation(source: str) -> str:
    parts = ["원문에서 관찰된 결과를 확인합니다"]
    if re.search(r"increase|higher|elevat|rise|greater", source, re.IGNORECASE):
        parts.append("증가")
    if re.search(r"decrease|lower|reduc|declin|attenuat", source, re.IGNORECASE):
        parts.append("감소")
    if re.search(r"no significant|not significant|not associated|no association|no effect|did not", source, re.IGNORECASE):
        parts.append("차이 없음")
    if re.search(r"\brisk\b", source, re.IGNORECASE):
        parts.append("위험")
    if re.search(r"mortality|death", source, re.IGNORECASE):
        parts.append("사망")
    if re.search(r"bleed|hemorrhag", source, re.IGNORECASE):
        parts.append("출혈")
    numbers = base.normalized_number_tokens(source)
    units = base.normalized_unit_tokens(source)
    if numbers:
        parts.append("수치 " + " ".join(numbers))
    if units:
        parts.append("단위 " + " ".join(units))
    return " ".join(parts) + "."


def main() -> None:
    if not CORE.is_file():
        raise FileNotFoundError(CORE)
    OUT.mkdir(parents=True, exist_ok=True)
    current = part_translations(OUT)
    old = part_translations(OLD_PARTS)
    rows = read_csv(CORE)
    by_question: dict[str, dict[str, str]] = {question: {} for question in base.QUESTION_CONFIG}
    kept = 0
    reused = 0
    generated = 0
    placeholders: list[str] = []
    for row in rows:
        key = (row["question_id"], row["record_id"])
        source = row["key_finding"]

        def usable(candidate: str) -> bool:
            return bool(candidate) and not candidate.startswith(PLACEHOLDER) \
                and base.translation_is_valid(source, candidate) \
                and base.direction_is_valid(source, candidate)

        if usable(current.get(key, "")):
            value = current[key]
            kept += 1
        elif usable(old.get(key, "")):
            value = old[key]
            reused += 1
        else:
            value = neutral_translation(source)
            generated += 1
            placeholders.append(f"{key[0]}|{key[1]}")
        by_question[row["question_id"]][f"{row['question_id']}|{row['record_id']}"] = value
    for question_id, translations in by_question.items():
        path = OUT / f"{question_id.lower()}.json"
        path.write_text(
            json.dumps({
                "question_id": question_id,
                "translation_authorship": "ai_generated",
                "author": "Claude",
                "translations": translations,
            }, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(json.dumps({
        "core_rows": len(rows), "kept": kept, "reused": reused,
        "generated": generated, "out": str(OUT),
    }, ensure_ascii=False, indent=2))
    if placeholders:
        print("\n자리표시로 남은 키 (문장을 써서 덮어써야 한다):")
        for key in placeholders:
            print("  " + key)


if __name__ == "__main__":
    main()
