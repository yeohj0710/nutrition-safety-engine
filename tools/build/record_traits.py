"""문헌마다 성분과 대상 나이를 미리 뽑아 둔다(2026-10-21).

조회 화면이 적어 주신 성분, 나이, 양과 문헌을 대조할 때 쓴다. 조회 경로에서
초록 전체를 읽지 않도록 빌드 때 한 번 계산한다. 언어모델은 쓰지 않는다.

    입력  research/systematic_review/extended_evidence/*.json (제목)
          research/systematic_review/etc/candidate_abstracts.json (PubMed 초록)
          research/systematic_review/core_evidence.csv (핵심 문헌 초록)
          src/lib/ingredient-terms.json (성분 사전, 화면과 공유)
    출력  research/systematic_review/record_traits/<상황>.json
          {record_id: {"i": [성분 열쇠], "a": [[하한, 상한], ...]}}

    python -m tools.build.record_traits
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SR = ROOT / "research" / "systematic_review"
OUT = SR / "record_traits"
QUESTIONS = [
    "HRS1_PERIOPERATIVE",
    "HRS2_KIDNEY_DISEASE",
    "HRS3_PREGNANCY",
    "HRS4_LIVER_DISEASE",
    "HRS5_ANTICOAGULATION",
]
TERMS = json.loads((ROOT / "src" / "lib" / "ingredient-terms.json").read_text(encoding="utf-8"))["ingredients"]
INGREDIENT_RE = [(t["key"], re.compile(t["en"], re.IGNORECASE)) for t in TERMS]

NUM = r"(\d{1,3}(?:\.\d+)?)"
DASH = r"\s*(?:-|–|to|and)\s*"
RANGE_RE = re.compile(
    r"(?:\baged?|\bages?|age\s+range(?:\s+of)?)\s*(?:of\s*|from\s*|between\s*)?" + NUM + DASH + NUM
    + r"(?!\s*(?:months?|weeks?|days?|%|mg|g\b|kg))",
    re.IGNORECASE,
)
YEARS_RANGE_RE = re.compile(NUM + DASH + NUM + r"\s*(?:years?|yrs?)\s*(?:old|of\s+age)", re.IGNORECASE)
CENTRE_RE = re.compile(
    r"(?:mean|median|average)\s+(?:\(\s*(?:sd|iqr|range)\s*\)\s+)?age\s*(?:of|was|were|:|=|,)?\s*(?:the\s+\w+\s+)?(?:was\s+)?" + NUM,
    re.IGNORECASE,
)
ONE_AGE_RE = re.compile(NUM + r"[\s-]*(?:years?|yrs?)[\s-]*old", re.IGNORECASE)
OVER_RE = re.compile(r"(?:aged?|ages?)\s*(?:≥|>=|>|over|above|older than|at least)\s*" + NUM, re.IGNORECASE)
UNDER_RE = re.compile(r"(?:aged?|ages?)\s*(?:≤|<=|<|under|below|younger than)\s*" + NUM, re.IGNORECASE)
GROUPS = [
    (re.compile(r"\b(?:neonat\w*|newborns?|preterm infants?|infants?)\b", re.IGNORECASE), (0, 2)),
    (re.compile(r"\b(?:children|child|paediatric|pediatric|schoolchildren|toddlers?)\b", re.IGNORECASE), (0, 17)),
    (re.compile(r"\badolescen\w*\b", re.IGNORECASE), (10, 19)),
    (re.compile(r"\b(?:elderly|geriatric|older\s+(?:adults?|patients?|people|persons?|women|men|individuals?|subjects?))\b", re.IGNORECASE), (65, 120)),
    (re.compile(r"\bpostmenopausal\b", re.IGNORECASE), (45, 120)),
    (re.compile(r"\b(?:young\s+(?:adults?|women|men))\b", re.IGNORECASE), (18, 35)),
]
ADULT_RE = re.compile(r"\badults?\b", re.IGNORECASE)


def ages(text: str) -> list[list[float]]:
    spans: list[tuple[float, float]] = []
    for pattern in (RANGE_RE, YEARS_RANGE_RE):
        for m in pattern.finditer(text):
            lo, hi = float(m.group(1)), float(m.group(2))
            if 0 <= lo < hi <= 110:
                spans.append((lo, hi))
    for m in CENTRE_RE.finditer(text):
        c = float(m.group(1))
        if 0 < c <= 105:
            spans.append((max(0, c - 10), c + 10))
    for m in ONE_AGE_RE.finditer(text):
        c = float(m.group(1))
        if 0 < c <= 105:
            spans.append((max(0, c - 5), c + 5))
    for m in OVER_RE.finditer(text):
        spans.append((float(m.group(1)), 120))
    for m in UNDER_RE.finditer(text):
        spans.append((0, float(m.group(1))))
    if not spans:
        for pattern, span in GROUPS:
            if pattern.search(text):
                spans.append(span)
    if not spans and ADULT_RE.search(text):
        spans.append((18, 120))
    return [list(s) for s in dict.fromkeys(spans)]


def ingredients(text: str) -> list[str]:
    return [key for key, pattern in INGREDIENT_RE if pattern.search(text)]


def main() -> None:
    abstracts = json.loads((SR / "etc" / "candidate_abstracts.json").read_text(encoding="utf-8"))
    with (SR / "core_evidence.csv").open(encoding="utf-8", newline="") as handle:
        core = {(r["question_id"], r["record_id"]): r["abstract"] for r in csv.DictReader(handle)}
    OUT.mkdir(parents=True, exist_ok=True)
    totals = {}
    for q in QUESTIONS:
        data = json.loads((SR / "extended_evidence" / f"{q}.json").read_text(encoding="utf-8"))
        traits = {}
        for item in data["evidence"]:
            rid = item["record_id"]
            abstract = core.get((q, rid)) or abstracts.get(rid.split(":", 1)[1], "")
            text = f"{item['title']} {abstract}"
            entry = {"i": ingredients(text), "a": ages(text)}
            traits[rid] = entry
        with (OUT / f"{q}.json").open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(traits, handle, ensure_ascii=False, separators=(",", ":"))
        totals[q] = {
            "records": len(traits),
            "with_ingredient": sum(1 for t in traits.values() if t["i"]),
            "with_age": sum(1 for t in traits.values() if t["a"]),
        }
    print(json.dumps(totals, ensure_ascii=False))


if __name__ == "__main__":
    main()
