"""확장 근거 1,899행에 축 색인을 붙인다.

배경. `personalized_rules.json` 의 축 규칙은 질문당 핵심 근거 15건의 부분집합으로만
계산돼 있다. 그래서 확장 보기(질문당 152~715건)에서는 조건 필터를 걸 수 없었고,
조건을 자세히 적을수록 결과가 좁아지는데 넓은 근거는 걸러지지 않은 채로만 볼 수
있었다.

이 도구는 v3.0 `build_site_v3.extract_observed_axes` 와 **같은 판정식**을 확장 근거
전체에 적용한다. 새 판단을 넣지 않는다 — 같은 정규식을 넓은 입력에 돌리는 것뿐이다.
원본은 2026-07-28 단일 트랙 정리(`fc3f022`)에서 삭제됐으므로 판정식을 여기 옮겨 적고,
핵심 근거 75건에 대해 규칙 파일이 기록한 축 소속과 대조해 동치인지 검증한다.

**봉인 산출물을 고치지 않는다.** 읽기만 하고 새 파일 하나를 쓴다.

    입력  research/systematic_review_v40/picos_extraction.csv   (1,899행, abstract 포함)
          research/systematic_review_v40/personalized_rules.json (대조용, 읽기만)
    출력  research/systematic_review_v40/extended_axis_index_v40.json
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PICOS = ROOT / "research" / "systematic_review_v40" / "picos_extraction.csv"
RULES = ROOT / "research" / "systematic_review_v40" / "personalized_rules.json"
OUT = ROOT / "research" / "systematic_review_v40" / "extended_axis_index_v40.json"

# v3.0 build_site_v3.py 의 판정식 원문. 한 글자도 바꾸지 않는다.
DOSE_RE = re.compile(
    r"\b\d+(?:[.,]\d+)?(?:\s*(?:-|–|to)\s*\d+(?:[.,]\d+)?)?\s*"
    r"(?:mg|g|µg|μg|mcg|iu|units?|ml|mmol|%)\b(?:\s*/\s*(?:d|day|week))?",
    re.IGNORECASE,
)

AXIS_PATTERNS: list[tuple[str, re.Pattern[str] | None]] = [
    ("age_group", re.compile(r"child|adolesc|adult|elder|older|aged|years? old|age[sd]?\b", re.IGNORECASE)),
    ("sex", re.compile(r"\bmen\b|\bwomen\b|\bmale\b|\bfemale\b|\bsex\b|\bgender\b", re.IGNORECASE)),
    ("concomitant_medication", re.compile(r"warfarin|anticoag|aspirin|heparin|medication|drug|therapy", re.IGNORECASE)),
    ("underlying_condition", re.compile(r"kidney|renal|dialysis|pregnan|liver|hepatic|cirrho|surg|diabet|hypertens|cancer", re.IGNORECASE)),
    ("dose_range", None),  # DOSE_RE
]


def extract_observed_axes(title: str, abstract: str) -> list[str]:
    """v3.0 원본과 동치. 원본은 row['title'] 과 row['abstract'] 를 이어 붙였다."""
    text = f"{title} {abstract}"
    axes: list[str] = []
    for axis, pattern in AXIS_PATTERNS:
        if pattern is None:
            if DOSE_RE.search(text):
                axes.append(axis)
        elif pattern.search(text):
            axes.append(axis)
    return axes


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="파일을 쓰지 않고 대조 결과만 보고한다",
    )
    args = parser.parse_args()

    if not PICOS.is_file():
        raise SystemExit(f"확장 근거가 없습니다: {PICOS}")

    with PICOS.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    by_question: dict[str, dict[str, list[str]]] = {}
    axis_counts: Counter[str] = Counter()
    computed: dict[tuple[str, str], set[str]] = {}

    for row in rows:
        question = row["question_id"]
        record = row["record_id"]
        found = extract_observed_axes(row.get("title", ""), row.get("abstract", ""))
        computed[(question, record)] = set(found)
        bucket = by_question.setdefault(question, {})
        for axis in found:
            bucket.setdefault(axis, []).append(record)
            axis_counts[axis] += 1

    for bucket in by_question.values():
        for axis in bucket:
            bucket[axis].sort()

    # 핵심 근거 75건에 대해 규칙 파일이 기록한 축 소속과 같은지 대조한다.
    rules = json.loads(RULES.read_text(encoding="utf-8"))
    rule_list = rules if isinstance(rules, list) else rules.get("rules", [])
    agree = 0
    disagree: list[dict[str, object]] = []
    checked = 0
    for rule in rule_list:
        axis = rule.get("personalization_axis")
        if axis in (None, "base", "compatibility_alias"):
            continue
        question = rule["question_id"]
        recorded = {entry["record_id"] for entry in rule.get("all_evidence", [])}
        base_rule = next(
            (r for r in rule_list
             if r["question_id"] == question and r.get("personalization_axis") == "base"),
            None,
        )
        if base_rule is None:
            continue
        for entry in base_rule.get("all_evidence", []):
            record = entry["record_id"]
            key = (question, record)
            if key not in computed:
                continue
            checked += 1
            expected = record in recorded
            actual = axis in computed[key]
            if expected == actual:
                agree += 1
            else:
                disagree.append(
                    {"question_id": question, "record_id": record, "axis": axis,
                     "rules_file": expected, "recomputed": actual}
                )

    total_axis_rows = sum(len(v) for b in by_question.values() for v in b.values())
    payload = {
        "schema_version": "1.0.0",
        "track": "v4.0_mecir_search_redesign",
        "purpose": (
            "확장 근거에 축 색인을 붙여 조건 필터가 핵심 근거 15건 밖에서도 걸리게 한다. "
            "판정식은 v3.0 build_site_v3.extract_observed_axes 와 동일하다."
        ),
        "derivation": {
            "function": "extract_observed_axes",
            "origin": "tools/v30/build_site_v3.py (fc3f022 에서 삭제, git 히스토리 6234d0e 에 보존)",
            "input_fields": ["title", "abstract"],
            "deterministic": True,
            "language_model_calls": 0,
        },
        "inputs": {
            "picos_extraction": {
                "path": "research/systematic_review_v40/picos_extraction.csv",
                "rows": len(rows),
                "sha256": sha256_file(PICOS),
            },
            "personalized_rules": {
                "path": "research/systematic_review_v40/personalized_rules.json",
                "sha256": sha256_file(RULES),
                "role": "대조 전용. 수정하지 않는다",
            },
        },
        "parity_check": {
            "note": "규칙 파일이 핵심 근거 75건에 기록한 축 소속과 재계산 결과를 대조한다",
            "comparisons": checked,
            "agree": agree,
            "disagree": len(disagree),
            "disagree_detail": disagree[:20],
        },
        "axis_totals": dict(sorted(axis_counts.items())),
        "records_total": len(rows),
        "axis_membership_rows": total_axis_rows,
        "questions": by_question,
        "scope_note": (
            "축은 그 항목을 *보고한* 문헌을 고른다. 입력한 값과 문헌을 대조하지 않는다. "
            "clinical_recommendation false · decision_authority none 은 그대로다."
        ),
    }

    print(f"확장 근거 {len(rows)}행")
    for axis, count in sorted(axis_counts.items()):
        print(f"  {axis:24s} {count:>6,}")
    print(f"핵심 근거 대조 {checked}건: 일치 {agree} / 불일치 {len(disagree)}")
    for item in disagree[:5]:
        print(f"    {item}")

    if args.check:
        return 0 if not disagree else 1

    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"→ {OUT.relative_to(ROOT)}  ({OUT.stat().st_size:,} bytes)")
    return 0 if not disagree else 1


if __name__ == "__main__":
    sys.exit(main())
