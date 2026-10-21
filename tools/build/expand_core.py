"""핵심 문헌을 상황마다 최대 15건까지 채운다(2026-10-21).

처음 핵심 문헌은 순위 상위 75건을 gpt-5.6-luna 가 검토해 44건을 남긴 것이다.
같은 방식으로 문헌 후보에서 다음 순위의 문헌을 골라 같은 모델이 검토하게 하고,
핵심 적합으로 판정된 문헌을 상황별 15건까지 핵심 문헌에 더한다.

    python -m tools.build.expand_core select   # 검토 입력 만들기
    (Codex gpt-5.6-luna 가 research/final/core-expansion/review.json 을 쓴다)
    python -m tools.build.expand_core apply    # 검토 결과 반영

후보 선택은 결정적이다. 사람 대상 연구 설계(무작위 임상시험, 메타분석, 체계적
문헌고찰, 임상시험, 증례 보고, 관찰 연구)이고 제목이나 초록에 보충제 노출 표현이
있는 문헌을 기존 우선순위 점수 순으로 고른다. 언어모델은 검토에만 쓴다.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from tools.build import base_builder as base
from tools.build import build_site
from tools.build import reviewed_evidence
from tools.build.axis_patterns import dose_mentions

ROOT = Path(__file__).resolve().parents[2]
SR = ROOT / "research" / "systematic_review"
CORE = SR / "core_evidence.csv"
TRANSLATIONS = SR / "key_finding_translations_ko.json"
RULES = SR / "personalized_rules.json"
CORE_MANIFEST = SR / "core_manifest.json"
EXTENDED = SR / "extended_evidence"
ABSTRACTS = SR / "etc" / "candidate_abstracts.json"
REVIEW = ROOT / "research" / "final" / "evidence-review.json"
SUMMARY = ROOT / "research" / "final" / "site-summary.json"
CONSULT = ROOT / "research" / "consult"
WORK = ROOT / "research" / "final" / "core-expansion"
QUESTIONS = list(base.QUESTION_CONFIG)
LIMIT = base.MAX_CORE_PER_QUESTION
# 빈자리의 약 세 배를 검토한다. 항응고는 처음 검토에서 유지 비율이 낮아 더 많이 본다.
REVIEW_FACTOR = {"HRS5_ANTICOAGULATION": 4}
DESIGN_RE = re.compile(
    r"Randomized Controlled Trial|Meta-Analysis|Systematic Review|Clinical Trial|"
    r"Case Reports|Observational Study|Comparative Study|Multicenter Study",
    re.IGNORECASE,
)
DRUG_CLASS_RE = re.compile(
    r"\b(?:non-?)?vitamin[\s-]*k[\s-]*(?:antagonists?|dependent|epoxide\w*|oral\s+anticoagulants?)\b|"
    r"\bNOACs?\b|\bVKAs?\b|\bprotein\b(?=\s+(?:C|S|kinase))",
    re.IGNORECASE,
)


def write_crlf(path: Path, text: str) -> None:
    with path.open("w", encoding="utf-8", newline="\r\n") as handle:
        handle.write(text)


def read_core() -> tuple[list[str], list[dict[str, str]]]:
    with CORE.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def load_extended() -> dict[str, dict]:
    return {q: json.loads((EXTENDED / f"{q}.json").read_text(encoding="utf-8")) for q in QUESTIONS}


def select() -> None:
    _, core = read_core()
    reviewed = json.loads(REVIEW.read_text(encoding="utf-8"))["results"]
    seen = {(r["question_id"], r["record_id"]) for r in reviewed}
    abstracts = json.loads(ABSTRACTS.read_text(encoding="utf-8"))
    extended = load_extended()
    per_q = {q: sum(1 for r in core if r["question_id"] == q) for q in QUESTIONS}
    items = []
    for q in QUESTIONS:
        need = LIMIT - per_q[q]
        take = need * REVIEW_FACTOR.get(q, 3)
        pool = []
        for item in extended[q]["evidence"]:
            if item["in_core"] or (q, item["record_id"]) in seen:
                continue
            abstract = abstracts.get(item["record_id"].split(":", 1)[1], "")
            text = f"{item['title']} {abstract}"
            if not abstract or not DESIGN_RE.search(item["publication_types"]):
                continue
            # "vitamin K antagonist"(와파린 계열)는 보충제 노출이 아니다.
            if not base.EXPOSURE_RE.search(DRUG_CLASS_RE.sub(" ", text)):
                continue
            pool.append((-float(item["priority_score"]), -int(item["year"] or 0), item["record_id"], item, abstract))
        pool.sort(key=lambda x: x[:3])
        for _, _, _, item, abstract in pool[:take]:
            sentences = base.split_sentences(abstract)
            items.append({
                "question_id": q,
                "question": base.QUESTION_CONFIG[q]["label_ko"],
                "record_id": item["record_id"],
                "title": item["title"],
                "publication_types": item["publication_types"],
                "year": item["year"],
                "sentences": [{"n": i + 1, "text": s} for i, s in enumerate(sentences)],
            })
        print(q, "core", per_q[q], "need", need, "pool", len(pool), "review", min(take, len(pool)))
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "input.json").write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    print("items", len(items))


def apply() -> None:
    columns, core = read_core()
    review_payload = json.loads(REVIEW.read_text(encoding="utf-8"))
    review_rows = json.loads((WORK / "review.json").read_text(encoding="utf-8"))
    inputs = {(i["question_id"], i["record_id"]): i for i in json.loads((WORK / "input.json").read_text(encoding="utf-8"))}
    abstracts = json.loads(ABSTRACTS.read_text(encoding="utf-8"))
    extended = load_extended()
    by_id = {(q, item["record_id"]): item for q in QUESTIONS for item in extended[q]["evidence"]}
    assert {(r["question_id"], r["record_id"]) for r in review_rows} == set(inputs), "review must cover every input"

    eligible: dict[str, list[tuple]] = {q: [] for q in QUESTIONS}
    new_reviews = []
    for r in review_rows:
        key = (r["question_id"], r["record_id"])
        item = by_id[key]
        abstract = abstracts[r["record_id"].split(":", 1)[1]]
        sentences = base.split_sentences(abstract)
        finding = None
        if r["core_eligible"]:
            assert r["decision"] == "retain", key
            n = int(r["finding_sentence"])
            finding = sentences[n - 1]
            assert r["translation_ko"].strip(), key
        row_for_sha = {"title": item["title"], "abstract": abstract}
        new_reviews.append({
            "study": "yeo", "question_id": key[0], "record_id": key[1],
            "decision": r["decision"], "why_ko": r["why_ko"], "criterion": r["criterion"],
            "evidence_quote": r.get("evidence_quote", ""), "reason_mismatch": False,
            "key_finding_issue": None, "replacement_key_finding": None, "replacement_translation_ko": None,
            "core_eligible": bool(r["core_eligible"]), "added_from_reviewed_candidates": True,
            "content_sha256": reviewed_evidence.content_sha(row_for_sha),
            "finding_override": finding, "translation_ko": r["translation_ko"] if finding else None,
            "translation_issue": None, "original_key_finding": item["key_finding"], "original_translation_ko": None,
            "expansion_round": "R20261021",
        })
        if finding:
            eligible[key[0]].append((-float(item["priority_score"]), -int(item["year"] or 0), key[1], item, abstract, finding, r))

    added_rows, added_translations = [], []
    counts = {q: sum(1 for r in core if r["question_id"] == q) for q in QUESTIONS}
    chosen = set()
    for q in QUESTIONS:
        eligible[q].sort(key=lambda x: x[:3])
        room = LIMIT - counts[q]
        for _, _, record_id, item, abstract, finding, r in eligible[q][:room]:
            sentences = base.split_sentences(abstract)
            text = f"{item['title']} {abstract}"
            chosen.add((q, record_id))
            added_rows.append({
                "question_id": q, "record_id": record_id, "source": "pubmed",
                "provider_id": record_id.split(":", 1)[1], "title": item["title"], "abstract": abstract,
                "authors": item.get("authors", ""), "year": str(item["year"]), "venue": item.get("venue", ""),
                "publication_types": item["publication_types"], "doi": item.get("doi", ""), "url": item["url"],
                "screening_decision": "retain", "regex_passed": "true", "source_scope": item.get("source_scope", "abstract_only"),
                "locator": f"ABSTRACT_SENTENCE_{sentences.index(finding) + 1}", "locator_text": finding,
                "dose": " | ".join(dose_mentions(text)[:8]), "outcome": item.get("outcome", ""),
                "key_finding": finding, "population": item.get("population", ""),
                "priority_score": str(int(float(item["priority_score"]))), "raw_source_path": "", "raw_source_sha256": "",
                "extracted_effect_value": "", "extracted_effect_status": "not_observed", "status": "ai_screened_regex_confirmed",
            })
            added_translations.append({
                "translation_id": f"{q}|{record_id}", "question_id": q, "record_id": record_id,
                "source_text": finding, "source_sha256": hashlib.sha256(finding.encode("utf-8")).hexdigest(),
                "translation_ko": r["translation_ko"].strip(), "translation_authorship": "ai_generated",
                "author": "gpt-5.6-luna core expansion R20261021",
                "numeric_unit_validation": "passed" if numbers(finding) <= numbers(r["translation_ko"]) else "check",
                "direction_validation": "not_checked",
            })
    for row in new_reviews:
        row["core_eligible_selected"] = (row["question_id"], row["record_id"]) in chosen
        # 상한 15건이 차서 들어가지 못한 적격 문헌은 예비로 남긴다. 생성기는 적격 문헌이
        # 모두 핵심에 들어가야 통과하므로(base_builder) 적격 표시는 핵심에 든 것에만 둔다.
        row["reviewer_core_eligible"] = row["core_eligible"]
        if row["core_eligible"] and not row["core_eligible_selected"]:
            row["core_eligible"] = False
            row["core_reserve"] = "cap_15_filled"
    core_all = core + added_rows
    core_all.sort(key=lambda row: (QUESTIONS.index(row["question_id"]), -int(row["priority_score"]), row["record_id"]))
    with CORE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, lineterminator="\r\n")
        writer.writeheader()
        writer.writerows(core_all)

    trans = json.loads(TRANSLATIONS.read_text(encoding="utf-8"))
    trans["translations"].extend(added_translations)
    trans["records"] = len(trans["translations"])
    trans["author"] = "Claude; gpt-5.6-luna posthoc corrections; gpt-5.6-luna core expansion R20261021"
    write_crlf(TRANSLATIONS, json.dumps(trans, ensure_ascii=False, indent=2) + "\n")

    review_payload["results"].extend(new_reviews)
    review_payload["expansion_core_reviewed"] = len(new_reviews)
    review_payload["expansion_core_added"] = len(added_rows)
    write_crlf(REVIEW, json.dumps(review_payload, ensure_ascii=False, indent=2) + "\n")

    translation_map = {(t["record_id"], t["question_id"]): t for t in trans["translations"]}
    rules = build_site._expected_rules(core_all, translation_map)
    write_crlf(RULES, json.dumps(rules, ensure_ascii=False, indent=2) + "\n")
    build_site.write_coverage_module()

    for q in QUESTIONS:
        for item in extended[q]["evidence"]:
            if (q, item["record_id"]) in chosen:
                item["in_core"] = True
        write_crlf(EXTENDED / f"{q}.json", json.dumps(extended[q], ensure_ascii=False, indent=1) + "\n")

    per_q = {q: sum(1 for r in core_all if r["question_id"] == q) for q in QUESTIONS}
    manifest = json.loads(CORE_MANIFEST.read_text(encoding="utf-8"))
    manifest["core_records"] = len(core_all)
    manifest["per_question"] = per_q
    manifest["rules"] = len(rules)
    manifest["core_sha256"] = hashlib.sha256(CORE.read_bytes()).hexdigest()
    manifest["translation_sha256"] = hashlib.sha256(TRANSLATIONS.read_bytes()).hexdigest()
    axis_counts: dict[str, dict[str, int]] = {}
    for rule in rules:
        axis = rule.get("personalization_axis")
        if axis in (None, "base", "compatibility_alias"):
            continue
        axis_counts.setdefault(rule["question_id"], {})[axis] = len(rule["all_evidence"])
    manifest["personalization"]["evidence_rows_by_question_and_axis"] = axis_counts
    manifest["expansion"] = {
        "round": "R20261021", "reviewer": "gpt-5.6-luna", "reviewed": len(new_reviews),
        "eligible": sum(len(v) for v in eligible.values()), "added": len(added_rows),
        "selection": "사람 대상 연구 설계와 보충제 노출 표현이 있는 문헌 후보를 우선순위 점수 순으로 골라 검토",
    }
    write_crlf(CORE_MANIFEST, json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    summary = json.loads(SUMMARY.read_text(encoding="utf-8"))
    summary["core_records"] = len(core_all)
    summary["core_by_question"] = per_q
    summary["expansion_core_reviewed"] = len(new_reviews)
    summary["expansion_core_added"] = len(added_rows)
    index = json.loads((SR / "extended_axis_index.json").read_text(encoding="utf-8"))
    summary["candidate_dose_rows"] = index["axis_totals"]["dose_range"]
    write_crlf(SUMMARY, json.dumps(summary, ensure_ascii=False, indent=2) + "\n")

    # 해설 작성에 쓰는 문헌 묶음: 새 핵심 문헌의 결과 문장과 번역을 바꿔 넣는다.
    for q in QUESTIONS:
        path = CONSULT / f"{q}.json.gz"
        records = json.loads(gzip.decompress(path.read_bytes()))
        for row in added_rows:
            if row["question_id"] != q:
                continue
            rec = records[row["record_id"]]
            t = translation_map[(row["record_id"], q)]
            rec.update({"finding": row["key_finding"], "findingKo": t["translation_ko"],
                        "locator": f"{row['locator']}: {row['locator_text']}", "reviewed": True})
        data = json.dumps(records, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        path.write_bytes(gzip.compress(data, mtime=0))
    cm = json.loads((CONSULT / "manifest.json").read_text(encoding="utf-8"))
    for q in QUESTIONS:
        cm["questions"][q]["sha256"] = hashlib.sha256((CONSULT / f"{q}.json.gz").read_bytes()).hexdigest()
    (CONSULT / "manifest.json").write_text(json.dumps(cm, indent=2), encoding="utf-8")

    print("reviewed", len(new_reviews), "eligible", {q: len(v) for q, v in eligible.items()}, "added", len(added_rows), "core", per_q)
    print(datetime.now(timezone.utc).isoformat())


def numbers(text: str) -> set[str]:
    return set(re.findall(r"\d+(?:\.\d+)?", text))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("step", choices=["select", "apply"])
    args = parser.parse_args()
    select() if args.step == "select" else apply()


if __name__ == "__main__":
    main()
