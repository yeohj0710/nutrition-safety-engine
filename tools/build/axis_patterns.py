"""연령과 용량 조건 표현의 판정식(2026-10-21 정정).

조회 결과 적합성 평가(research/retrieval_eval)에서 두 판정자가 초록에 연령이나
투여량이 없다고 본 결과가 많았다. 원인은 둘이었다.

- 연령: `age[sd]?\\b` 앞에 단어 경계가 없어 percentage, dosage, stage, average,
  hemorrhage 같은 낱말 끝에서도 걸렸다.
- 용량: %, ml, mmol 단위와 검사 농도(mg/dL), 출생 체중(2,500 g), 약물 용량까지
  용량으로 셌다.

정정한 판정식은 연령을 사람의 나이나 연령대 표현으로, 용량을 보충제나 투여를
말하는 문장 안의 양 표기로 좁힌다. 언어모델은 쓰지 않는다.
"""

from __future__ import annotations

import re

AGE_RE = re.compile(
    r"\b(?:"
    r"child(?:ren|hood)?|infan(?:t|ts|cy)|neonat\w*|newborns?|toddlers?|preterm\s+infants?|"
    r"adolescen\w*|teenagers?|pediatric|paediatric|schoolchildren|"
    r"elderly|geriatric|older\s+(?:adults?|patients?|people|persons?|subjects?|individuals?|women|men|population)|"
    r"adults?|young\s+(?:women|men|people)|middle-aged|"
    r"(?:mean|median|average)\s+(?:\(\w+\)\s+)?age|"
    r"aged\s+(?:\d|between|over|under|from|older|younger|[≥≤<>])|"
    r"ages?\s+(?:of\s+)?\d|age\s+(?:range|group|groups|category|categories|between|stratified)|"
    r"(?:reproductive|childbearing|gestational)\s+age|"
    r"\d+\s*(?:-|–|to)\s*\d+\s*(?:years?|yrs?|months?)\b|"
    r"\d+(?:\.\d+)?[\s-]*(?:years?|yrs?)[\s-]*(?:old|of\s+age)|years?[\s-]old|"
    r"(?:post|pre|peri)menopausal"
    r")",
    re.IGNORECASE,
)

# 문장이 보충제나 투여를 말할 때만 그 안의 양 표기를 용량으로 본다.
DOSE_CONTEXT_RE = re.compile(
    r"supplement|vitamin|mineral|micronutrient|folic|folate|iron|ferrous|ferric|calcium|magnesium|zinc|"
    r"selenium|iodine|potassium|omega|fish oil|eicosapent|docosahex|probiotic|herb|botanical|extract|"
    r"ginkgo|ginseng|garlic|curcumin|turmeric|green tea|catechin|silymarin|milk thistle|kava|"
    r"amino acid|arginine|glutamine|carnitine|choline|creatine|coenzyme|antioxidant|multivitamin|"
    r"ascorb|tocopherol|retinol|cholecalciferol|ergocalciferol|vitamin d|calcitriol|"
    r"\bdose[sd]?\b|\bdosage|\bdosing|\bdaily\b|per\s+day|/\s*d(?:ay)?\b|\bgiven\b|\breceived\b|"
    r"administ|\bintake\b|randomi[sz]ed\s+to|assigned\s+to|\bconsum",
    re.IGNORECASE,
)
DOSE_AMOUNT_RE = re.compile(
    r"(?<![\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?"
    r"(?:\s*(?:-|–|to)\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)?\s*"
    r"(?P<unit>mg|g|gs|grams?|milligrams?|micrograms?|µg|μg|mcg|iu)\b"
    r"(?!\s*/\s*(?:dl|l|ml|mmol|g\b|kg\s+(?:creat|body\s+weight\s+gain)))"
    r"(?P<per>\s*(?:/\s*(?:kg(?:/(?:day|d))?|day|d|week|wk)\b|per\s+(?:day|week|kg)|daily|once|twice|three\s+times))?",
    re.IGNORECASE,
)
SENTENCE_RE = re.compile(r"(?<=[.!?;])\s+(?=[A-Z0-9(])")


def _plausible(match: re.Match[str]) -> bool:
    """출생 체중(2,500 g)이나 그램 단위의 큰 수처럼 투여량이 아닌 값을 뺀다."""
    unit = match.group("unit").lower()
    if unit not in ("g", "gs", "gram", "grams"):
        return True
    if match.group("per"):
        return True
    number = match.group(0)[: match.start("unit") - match.start()].replace(",", "").strip()
    try:
        value = float(re.split(r"\s*(?:-|–|to)\s*", number)[0])
    except ValueError:
        return False
    return value <= 60


def dose_mentions(text: str) -> list[str]:
    found: list[str] = []
    for sentence in SENTENCE_RE.split(text or ""):
        if not DOSE_CONTEXT_RE.search(sentence):
            continue
        for match in DOSE_AMOUNT_RE.finditer(sentence):
            if _plausible(match):
                found.append(match.group(0).strip())
    return list(dict.fromkeys(found))


def has_age(text: str) -> bool:
    return bool(AGE_RE.search(text or ""))


def has_dose(text: str) -> bool:
    return bool(dose_mentions(text))
