"""연령과 용량 조건 표시만 정정한 판정식(axis_patterns)으로 다시 계산한다.

원자료(picos_extraction.csv, evidence_map.csv)는 연구 PC에만 있으므로, 이 도구는
사이트에 실린 파일만으로 일한다.

- 핵심 문헌 44건: core_evidence.csv 의 제목과 초록.
- 문헌 후보 25,747행: extended_evidence 의 제목과 PubMed에서 다시 받은 초록
  (fetch_candidate_abstracts.py 가 만든 etc/candidate_abstracts.json).

다시 받은 초록을 믿을 수 있는지 먼저 본다. 기존 판정식을 받은 초록에 돌려 지금
색인의 다섯 조건과 비교하고, 연령과 용량의 일치율이 99% 아래이면 멈춘다.
병용 약물, 성별, 기저 질환 색인은 바꾸지 않는다. 언어모델은 쓰지 않는다.

    python -m tools.build.refresh_axis_flags          # 대조만
    python -m tools.build.refresh_axis_flags --write  # 파일 갱신
"""

from __future__ import annotations

import argparse
import copy
import csv
import json
from collections import Counter
from datetime import date
from pathlib import Path

from tools.build import base_builder as base
from tools.build import build_site
from tools.build.axis_patterns import dose_mentions, has_age, has_dose

ROOT = Path(__file__).resolve().parents[2]
SR = ROOT / "research" / "systematic_review"
CORE = SR / "core_evidence.csv"
RULES = SR / "personalized_rules.json"
INDEX = SR / "extended_axis_index.json"
EXTENDED = SR / "extended_evidence"
ABSTRACTS = SR / "etc" / "candidate_abstracts.json"
CHANGED = ("age_group", "dose_range")
QUESTIONS = list(base.QUESTION_CONFIG)


def write_crlf(path: Path, text: str) -> None:
    """저장소의 기존 파일이 CRLF 로 고정돼 있어 같은 줄바꿈으로 쓴다."""
    with path.open("w", encoding="utf-8", newline="\r\n") as handle:
        handle.write(text)


def new_axes(text: str) -> set[str]:
    found = set()
    if has_age(text):
        found.add("age_group")
    if has_dose(text):
        found.add("dose_range")
    return found


def legacy_axes(title: str, abstract: str) -> set[str]:
    return set(base.legacy_observed_axes_v41({"title": title, "abstract": abstract}))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    abstracts: dict[str, str] = json.loads(ABSTRACTS.read_text(encoding="utf-8"))
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    extended = {q: json.loads((EXTENDED / f"{q}.json").read_text(encoding="utf-8")) for q in QUESTIONS}

    # 1. 받은 초록의 신뢰성: 기존 판정식이 지금 색인을 그대로 재현하는가
    parity: Counter[str] = Counter()
    mismatch: Counter[str] = Counter()
    for q in QUESTIONS:
        members = {axis: set(ids) for axis, ids in index["questions"][q].items()}
        for item in extended[q]["evidence"]:
            pmid = item["record_id"].split(":", 1)[1]
            got = legacy_axes(item["title"], abstracts.get(pmid, ""))
            for axis in base.AXES:
                parity[axis] += 1
                if (axis in got) != (item["record_id"] in members.get(axis, set())):
                    mismatch[axis] += 1
    rates = {axis: round(100 * (1 - mismatch[axis] / parity[axis]), 3) for axis in parity}
    print("parity with current index (%):", rates)
    if min(rates[a] for a in CHANGED) < 99:
        raise SystemExit("다시 받은 초록이 현재 색인을 재현하지 못한다. 중단.")

    # 2. 문헌 후보 색인과 양 표기
    before = {a: sum(len(index["questions"][q].get(a, [])) for q in QUESTIONS) for a in CHANGED}
    for q in QUESTIONS:
        for axis in CHANGED:
            index["questions"][q][axis] = []
        for item in extended[q]["evidence"]:
            pmid = item["record_id"].split(":", 1)[1]
            text = f"{item['title']} {abstracts.get(pmid, '')}"
            for axis in sorted(new_axes(text)):
                index["questions"][q][axis].append(item["record_id"])
            item["dose"] = " | ".join(dose_mentions(text)[:8])
        for axis in CHANGED:
            index["questions"][q][axis].sort()
            if not index["questions"][q][axis]:
                del index["questions"][q][axis]
    after = {a: sum(len(index["questions"][q].get(a, [])) for q in QUESTIONS) for a in CHANGED}
    print("candidate rows before", before, "after", after)

    # 3. 핵심 문헌 규칙
    with CORE.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = reader.fieldnames or []
        core_rows = list(reader)
    core_axes: dict[tuple[str, str], set[str]] = {}
    core_dose: dict[str, str] = {}
    for row in core_rows:
        text = f"{row['title']} {row['abstract']}"
        core_axes[(row["question_id"], row["record_id"])] = new_axes(text)
        row["dose"] = " | ".join(dose_mentions(text)[:8])
        core_dose[row["record_id"]] = row["dose"]

    rules = json.loads(RULES.read_text(encoding="utf-8"))
    for rule in rules:
        for key in ("evidence", "all_evidence"):
            for entry in rule.get(key, []):
                if entry["record_id"] in core_dose:
                    entry["dose"] = core_dose[entry["record_id"]]
    out: list[dict] = []
    counts: dict[str, dict[str, int]] = {}
    for q in QUESTIONS:
        mine = [r for r in rules if r["question_id"] == q]
        base_rule = next(r for r in mine if r["personalization_axis"] == "base")
        template = next(r for r in mine if r["personalization_axis"] not in ("base",))
        kept = {r["personalization_axis"]: r for r in mine if r["personalization_axis"] not in CHANGED}
        for axis in CHANGED:
            supported = [e for e in base_rule["all_evidence"] if axis in core_axes[(q, e["record_id"])]]
            if not supported:
                continue
            rule = copy.deepcopy(template)
            rule["rule_id"] = f"{q}:{axis}"
            rule["ingredient"] = f"{base.QUESTION_CONFIG[q]['label_ko']} — {axis}"
            rule["personalization_axis"] = axis
            rule["all_evidence"] = supported
            rule["evidence"] = supported[:3]
            kept[axis] = rule
        out.append(kept.pop("base"))
        out.extend(kept[axis] for axis in sorted(kept))
        counts[q] = {axis: len(r["all_evidence"]) for axis, r in sorted(kept.items())}
    out.extend(r for r in rules if r["question_id"] not in QUESTIONS)
    print("core rule counts", json.dumps(counts, ensure_ascii=False))

    if not args.write:
        return

    index["axis_totals"] = {
        axis: sum(len(index["questions"][q].get(axis, [])) for q in QUESTIONS) for axis in base.AXES
    }
    index["axis_membership_rows"] = sum(index["axis_totals"].values())
    index["purpose"] = (
        "문헌 후보에 조건 색인을 붙여 핵심 목록 밖에서도 조건 필터를 적용한다. "
        "연령과 용량은 2026-10-21 정정한 판정식(tools/build/axis_patterns.py)으로, "
        "나머지 조건은 기존 판정식으로 계산하였다."
    )
    index["derivation"]["revision"] = {
        "date": date.today().isoformat(),
        "axes": list(CHANGED),
        "function": "tools/build/axis_patterns.py",
        "abstract_source": "PubMed efetch (research/systematic_review/etc/candidate_abstracts.json)",
        "parity_with_previous_index_pct": rates,
        "reason": "research/retrieval_eval 평가에서 연령 표현이 percentage, stage 같은 낱말 끝에서, 용량 표현이 %, mmol, 검사 농도에서 검출된 문제",
    }
    write_crlf(INDEX, json.dumps(index, ensure_ascii=False, indent=2) + "\n")
    for q in QUESTIONS:
        write_crlf(EXTENDED / f"{q}.json", json.dumps(extended[q], ensure_ascii=False, indent=1) + "\n")
    with CORE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, lineterminator="\r\n")
        writer.writeheader()
        writer.writerows(core_rows)
    write_crlf(RULES, json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    build_site.write_coverage_module()
    print("written")


if __name__ == "__main__":
    main()
