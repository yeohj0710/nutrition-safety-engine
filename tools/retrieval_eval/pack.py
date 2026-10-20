"""판정 묶음을 만든다. 같은 상황의 같은 문헌은 한 번만 판정한다.

    python -m tools.retrieval_eval.pack
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "research" / "retrieval_eval"

QUESTIONS = {
    "HRS1_PERIOPERATIVE": "People before, during or after surgery, procedures or anesthesia, and their use of dietary supplements or nutritional products (use, effect, harm).",
    "HRS2_KIDNEY_DISEASE": "People with kidney disease, kidney failure or on dialysis, and their use of dietary supplements or nutritional products (use, effect, harm).",
    "HRS3_PREGNANCY": "Pregnant or breastfeeding people, or fetal exposure, and dietary supplements or nutritional products (use, effect, harm).",
    "HRS4_LIVER_DISEASE": "People with liver disease or liver failure using supplements, or liver toxicity caused by dietary supplements or nutritional products.",
    "HRS5_ANTICOAGULATION": "People on anticoagulant or antiplatelet drugs, or at bleeding risk, and dietary supplements or nutritional products (use, effect, harm).",
}

AXIS_TESTS = {
    "age_group": "The abstract states the participants' age, age range or age group (e.g. older adults, children, mean age).",
    "concomitant_medication": "The abstract names a drug the participants were taking besides the supplement, or a drug-supplement combination.",
    "dose_range": "The abstract states how much of the supplement was given or taken (amount with a unit, e.g. 500 mg/day).",
    "sex": "The abstract reports participants' sex, a sex breakdown, or a single-sex population.",
    "underlying_condition": "The abstract names a disease or clinical condition of the participants other than the situation itself, or describes the situation-defining disease in a specific form.",
}


def main() -> None:
    queries = json.loads((ROOT / "queries.json").read_text(encoding="utf-8"))
    abstracts = json.loads((ROOT / "abstracts.json").read_text(encoding="utf-8"))
    axes_by_item: dict[tuple[str, str], set[str]] = defaultdict(set)
    titles: dict[str, str] = {}
    for query in queries:
        for result in query["results"]:
            key = (query["situation"], result["record_id"])
            axes_by_item[key].update(query["axes"])
            titles[result["record_id"]] = result["title"]
    items = []
    for index, ((situation, record_id), axes) in enumerate(sorted(axes_by_item.items()), start=1):
        pmid = record_id.split(":", 1)[1]
        items.append(
            {
                "item_id": f"I{index:03d}",
                "situation": situation,
                "question": QUESTIONS[situation],
                "record_id": record_id,
                "title": titles[record_id],
                "abstract": abstracts.get(pmid, ""),
                "axis_checks": sorted(axes),
            }
        )
    (ROOT / "judge_items.json").write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    (ROOT / "rubric.json").write_text(
        json.dumps({"questions": QUESTIONS, "axis_tests": AXIS_TESTS}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"items {len(items)}, axis checks {sum(len(i['axis_checks']) for i in items)}")


if __name__ == "__main__":
    main()
