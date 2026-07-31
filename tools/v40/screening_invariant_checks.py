from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# `python tools/v40/screening_invariant_checks.py` 로 부르면 파이썬이 sys.path 에
# 넣는 것은 이 파일이 있는 폴더이지 저장소 루트가 아니라서 `tools.v40...` 임포트가
# 깨진다. PYTHONPATH 를 따로 걸어야 돌아가는 상태였고, package.json 의
# `check:screening-invariants` 도 그래서 그냥은 실행되지 않았다.
_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from tools.v40.agent_screen_worker import WORKER_VERSION, classify  # noqa: E402


ROOT = _ROOT
WORKER = ROOT / "tools" / "v40" / "agent_screen_worker.py"
REPORT = ROOT / "research" / "screening" / "v40_agent" / "invariant_checks.json"


def row(question_id: str, title: str, abstract: str = "", publication_types: str = "Journal Article") -> dict[str, str]:
    return {
        "record_id": "synthetic:base",
        "provider_id": "base",
        "question_id": question_id,
        "title": title,
        "abstract": abstract,
        "publication_types": publication_types,
    }


CASES: list[dict[str, Any]] = [
    {
        "name": "nontherapeutic_supplementing_language",
        "row": row(
            "HRS1_PERIOPERATIVE",
            "Supplementing instruction in surgical simulation training for medical students",
            "METHODS: Medical students received extra instruction during a simulated examination. "
            "RESULTS: Student interaction scores improved.",
        ),
        "decision": "deprioritize",
        "forbidden_reasons": {"exposure"},
    },
    {
        "name": "linked_target_supplement_title",
        "row": row(
            "HRS1_PERIOPERATIVE",
            "Dietary vitamin D supplementation and bleeding after surgery",
            publication_types="Journal Article",
        ),
        "decision": "retain",
        "required_reasons": {"population", "exposure", "outcome", "insufficient_abstract"},
        "confidence": "low",
    },
    {
        "name": "animal_clinical_application_phrase",
        "row": row(
            "HRS2_KIDNEY_DISEASE",
            "Curcumin protects against renal injury in rats with potential clinical application",
            "METHODS: Rats were treated with curcumin. RESULTS: Renal injury was reduced.",
        ),
        "decision": "deprioritize",
        "required_reasons": {"animal_term_present"},
        "forbidden_reasons": {"population", "human_signal"},
    },
    {
        "name": "negated_liver_population",
        "row": row(
            "HRS4_LIVER_DISEASE",
            "Nutritional supplementation in adults without hepatic disease",
            "METHODS: Adults without liver disease received an oral multivitamin. "
            "RESULTS: No adverse events were observed.",
        ),
        "decision": "deprioritize",
        "forbidden_reasons": {"population"},
    },
    {
        "name": "zero_events_is_outcome_assessed",
        "row": row(
            "HRS4_LIVER_DISEASE",
            "Herbal supplementation in patients with cirrhosis",
            "METHODS: Patients with cirrhosis received an oral herbal supplement. "
            "RESULTS: No adverse events were observed.",
        ),
        "decision": "retain",
        "required_reasons": {"population", "exposure", "outcome"},
    },
    {
        "name": "vitamin_k_drug_class_not_supplement",
        "row": row(
            "HRS5_ANTICOAGULATION",
            "Safety of switching from a vitamin K antagonist to a non-vitamin K oral anticoagulant",
            "METHODS: Patients receiving warfarin switched to apixaban. RESULTS: Bleeding was recorded.",
        ),
        "decision": "deprioritize",
        "forbidden_reasons": {"exposure"},
    },
    {
        "name": "broad_warfarin_interaction_scope",
        "row": row(
            "HRS5_ANTICOAGULATION",
            "Warfarin safety and interactions",
            "This review discusses bleeding, INR monitoring, drug interactions, diet, and lifestyle "
            "for patients receiving warfarin.",
            publication_types="Review|Journal Article",
        ),
        "decision": "retain",
        "forbidden_reasons": {"exposure"},
    },
    {
        "name": "traditional_medicine_hospital_is_not_exposure",
        "row": row(
            "HRS1_PERIOPERATIVE",
            "Postoperative complication prediction after hip surgery",
            "METHODS: Patients were enrolled at the Hospital of Traditional Chinese Medicine. "
            "RESULTS: Readmission was predicted from routine laboratory data.",
        ),
        "decision": "retain",
        "forbidden_reasons": {"exposure"},
    },
    {
        "name": "maternal_nutrient_biomarker_is_not_supplement",
        "row": row(
            "HRS3_PREGNANCY",
            "Maternal plasma choline concentrations and birth weight",
            "METHODS: Plasma choline was measured in pregnant participants. "
            "RESULTS: Concentrations were associated with birth weight.",
        ),
        "decision": "deprioritize",
        "forbidden_reasons": {"exposure"},
    },
    {
        "name": "perinatal_supplement_title_has_two_axes",
        "row": row(
            "HRS3_PREGNANCY",
            "Dietary supplements in the perinatal period",
        ),
        "decision": "retain",
        "required_reasons": {"population", "exposure", "insufficient_abstract"},
        "confidence": "low",
    },
    {
        "name": "postpartum_only_is_not_pregnancy_exposure",
        "row": row(
            "HRS3_PREGNANCY",
            "Oral iron supplementation for postpartum anemia",
            "METHODS: Women received iron after delivery. RESULTS: Hemoglobin improved.",
        ),
        "decision": "deprioritize",
        "forbidden_reasons": {"population"},
    },
    {
        "name": "protective_liver_cell_study_is_nonclinical",
        "row": row(
            "HRS4_LIVER_DISEASE",
            "Hawthorn extract protects HepG2 cells from induced hepatotoxicity",
            "METHODS: HepG2 cells were treated with hawthorn extract. RESULTS: Injury markers fell.",
        ),
        "decision": "deprioritize",
        "required_reasons": {"animal_term_present"},
        "forbidden_reasons": {"population", "human_signal"},
    },
    {
        "name": "supplement_caused_liver_injury_title",
        "row": row(
            "HRS4_LIVER_DISEASE",
            "Acute liver failure secondary to green tea extract",
        ),
        "decision": "retain",
        "required_reasons": {"exposure", "outcome", "insufficient_abstract"},
        "confidence": "low",
    },
    {
        "name": "therapeutic_vitamin_k_reversal_is_not_supplement",
        "row": row(
            "HRS5_ANTICOAGULATION",
            "Vitamin K and plasma for reversal of warfarin-associated hemorrhage",
            "METHODS: Warfarin users with hemorrhage received vitamin K and plasma.",
        ),
        "decision": "deprioritize",
        "forbidden_reasons": {"exposure"},
    },
    {
        "name": "hyphenated_vitamin_k_antagonists_are_drugs",
        "row": row(
            "HRS5_ANTICOAGULATION",
            "DOACs versus vitamin-K antagonists for major bleeding",
        ),
        "decision": "deprioritize",
        "forbidden_reasons": {"exposure"},
        "confidence": "low",
    },
    {
        "name": "author_reply_is_commentary",
        "row": row(
            "HRS5_ANTICOAGULATION",
            "DOAC-VKA comparisons in kidney recipients. Author's reply.",
            publication_types="Letter",
        ),
        "decision": "deprioritize",
        "confidence": "low",
    },
]


def run() -> dict[str, Any]:
    failures: list[dict[str, Any]] = []
    for case in CASES:
        result = classify(case["row"])
        problems: list[str] = []
        if result["decision"] != case["decision"]:
            problems.append(f"decision:{result['decision']}!=expected:{case['decision']}")
        if case.get("confidence") and result["confidence"] != case["confidence"]:
            problems.append(f"confidence:{result['confidence']}!=expected:{case['confidence']}")
        reasons = set(result["reason_codes"])
        missing = set(case.get("required_reasons", set())) - reasons
        forbidden = set(case.get("forbidden_reasons", set())) & reasons
        if missing:
            problems.append("missing_reasons:" + ",".join(sorted(missing)))
        if forbidden:
            problems.append("forbidden_reasons:" + ",".join(sorted(forbidden)))
        if problems:
            failures.append({"name": case["name"], "problems": problems, "observed": result})

    # The semantic decision must not depend on identifiers or on an unrelated
    # structured BACKGROUND sentence.
    base = row(
        "HRS1_PERIOPERATIVE",
        "Peer feedback in clinical examination training",
        "METHODS: Students practiced examination skills. RESULTS: Training scores improved.",
    )
    variant = dict(base)
    variant["record_id"] = "synthetic:changed"
    variant["provider_id"] = "changed"
    variant["abstract"] = (
        "BACKGROUND: Surgical patients sometimes use herbal supplements and experience bleeding.\n"
        + base["abstract"]
    )
    base_result = classify(base)
    variant_result = classify(variant)
    invariant_fields = ("decision", "reason_codes", "confidence", "evidence_basis", "status")
    if any(base_result[field] != variant_result[field] for field in invariant_fields):
        failures.append(
            {
                "name": "identifier_and_background_invariance",
                "problems": ["semantic_fields_changed"],
                "base": base_result,
                "variant": variant_result,
            }
        )

    return {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "worker_version": WORKER_VERSION,
        "worker_sha256": hashlib.sha256(WORKER.read_bytes()).hexdigest(),
        "case_count": len(CASES) + 1,
        "passed_case_count": len(CASES) + 1 - len(failures),
        "failed_case_count": len(failures),
        "all_passed": not failures,
        "failures": failures,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-report", action="store_true")
    args = parser.parse_args()
    report = run()
    if args.write_report:
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["all_passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
