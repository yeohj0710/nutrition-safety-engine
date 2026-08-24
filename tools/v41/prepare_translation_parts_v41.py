"""v41 핵심 근거의 번역 파트 입력을 준비한다.

유료 번역 API를 호출하지 않는다. v40에 이미 있는 동일 record의 번역은 검증 후
재사용하고, 새 record는 원문 수치·단위와 방향을 보존하는 중립 표지로 만든다.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

from tools.v41 import base_builder as base


ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "research" / "systematic_review_v41" / "core_evidence.csv"
OLD_PARTS = ROOT / "research" / "systematic_review_v40" / "etc" / "translation_parts"
OUT = ROOT / "research" / "systematic_review_v41" / "etc" / "translation_parts"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def old_translations() -> dict[tuple[str, str], str]:
    result: dict[tuple[str, str], str] = {}
    for path in sorted(OLD_PARTS.glob("*.json")):
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
    old = old_translations()
    rows = read_csv(CORE)
    by_question: dict[str, dict[str, str]] = {question: {} for question in base.QUESTION_CONFIG}
    reused = 0
    generated = 0
    for row in rows:
        key = (row["question_id"], row["record_id"])
        candidate = old.get(key, "")
        if candidate and base.translation_is_valid(row["key_finding"], candidate) and base.direction_is_valid(row["key_finding"], candidate):
            value = candidate
            reused += 1
        else:
            value = neutral_translation(row["key_finding"])
            generated += 1
        by_question[row["question_id"]][f"{row['question_id']}|{row['record_id']}"] = value
    for question_id, translations in by_question.items():
        path = OUT / f"{question_id.lower()}.json"
        path.write_text(
            json.dumps({
                "question_id": question_id,
                "translation_authorship": "ai_generated",
                "author": "Codex",
                "translations": translations,
            }, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(json.dumps({"core_rows": len(rows), "reused": reused, "generated": generated, "out": str(OUT)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
