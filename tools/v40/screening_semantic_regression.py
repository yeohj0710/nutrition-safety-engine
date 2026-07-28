from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from tools.v40.agent_screen_worker import WORKER_VERSION, classify


ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "data" / "curated_v4" / "evidence_map.csv"
WORKER = ROOT / "tools" / "v40" / "agent_screen_worker.py"
PROMPT = ROOT / "research" / "screening" / "v40_agent" / "prompts" / "screening_prompt.md"
RAW_REPORT = ROOT / "research" / "screening" / "v40_agent" / "semantic_rule_audit.json"
ADJUDICATED_REPORT = (
    ROOT / "research" / "screening" / "v40_agent" / "semantic_adjudication_consistency.json"
)
AUDIT_CASE_DIR = (
    ROOT / "research" / "screening" / "v40_agent" / "etc" / "semantic_audit_cases"
)

EXPECTED: dict[str, dict[str, list[str]]] = {
    "HRS1_PERIOPERATIVE": {
        "retain": [
            "35063205", "35470909", "35701778", "38910886", "33783312",
            "35426325", "33342276", "35768119", "36461939", "40619705",
            "40312644", "39671973", "41879405", "40777177",
        ],
        "deprioritize": [
            "20301300", "34411017", "35283042", "34980887", "31364414",
            "33021547", "35382835", "35315624", "33143761", "34059194",
            "34609004", "35442771", "38911421", "34995935", "35243603",
            "35640263", "34980778", "38912759", "38913100", "38915010",
            "40621326", "40622207", "40753041", "42343512",
            "39518052", "41923086", "39321111", "39687551", "41368692",
            "39270698", "39059275", "39557196", "41766153",
        ],
        "uncertain": ["34823989"],
    },
    "HRS2_KIDNEY_DISEASE": {
        "retain": [
            "34510284", "34845313", "34990766", "35267901", "35887733",
            "39744164", "41515248",
        ],
        "deprioritize": [
            "33882494", "34586605", "38541742", "34045136", "34294642",
            "34363294", "35144414", "35156909", "35180026", "34309798",
            "34420167", "34856477", "42506718", "35714209", "40744977",
            "34353389", "37565761", "38089160",
            "35736361", "39998074", "41585876", "35621372", "39641572",
            "41492600", "37950553", "35703216", "37673290", "39608497",
            "41568437", "41143739",
        ],
        "uncertain": [],
    },
    "HRS3_PREGNANCY": {
        "retain": [
            "32067533", "33749574", "33979245", "34508748", "34562018",
            "35276810", "35948268", "39959527",
        ],
        "deprioritize": [
            "32456494", "35441210", "37204118", "39773923", "32654629",
            "37299427", "35219268", "30000695", "37156908", "31937153",
            "32933356", "32912100", "35947545", "35995981", "36459002",
            "39471241", "37137609", "37299446", "37296472", "39979646",
            "41094441", "20301288", "20301300",
            "20301298", "34962672", "36107253", "36899725", "20301720",
            "36014585", "37295325", "33819142", "37039193", "38143595",
            "38133610", "39053158", "39796357", "38761888", "38720550",
            "39716493", "40175068", "41241720", "41754818", "42252696",
            "40158005", "40638899", "41167406", "41689925", "42214109",
            "40620271", "41642683", "41094493", "40154150", "37644576",
            "37148409",
        ],
        "uncertain": [],
    },
    "HRS4_LIVER_DISEASE": {
        "retain": [
            "32467497", "33434654", "34370392", "34400337", "35068807",
            "35260147", "39197740", "20301501", "20301523", "20301613",
            "42147312", "34697623", "34772600", "35353431", "37970949",
            "37708539", "42491231",
        ],
        "deprioritize": [
            "31736373", "32482111", "32551976", "32842782", "33824458",
            "42501513", "33621669", "20301428", "31082119", "33861657",
            "34939363", "35955942", "34999018", "38196441", "40418327",
            "40501231", "41534953", "37077767", "38905402", "40762285",
            "42497478", "30252263", "40231197", "38599387", "31588816",
            "42487941",
        ],
        "uncertain": [],
    },
    "HRS5_ANTICOAGULATION": {
        "retain": ["35685257", "28520347", "29261922"],
        "deprioritize": [
            "35041061", "40208135", "34751053", "36942299", "34121529",
            "34622986", "35038554", "35049594", "33879035", "35649428",
            "35152746",
            "36316693", "41405700", "41393756", "37148437", "37494706",
            "38695465", "41317185", "40551307", "38976611", "41325444",
            "34718884", "38304792", "39713552", "36549192", "39479767",
        ],
        "uncertain": [],
    },
}

# Independent post-run semantic audits.  These cases are deliberately kept
# separate from the original seed set so a classifier revision cannot appear
# to improve merely by replacing the earlier checks.
AUDIT_EXPECTED: dict[str, dict[str, list[str]]] = {
    "HRS1_PERIOPERATIVE": {
        "retain": ["36682414", "36089835", "35781402"],
        "deprioritize": [
            "39991716", "40629641", "41158518", "42287322", "39312315",
            "40162400", "40898905", "41502198", "42111807", "39691749",
            "40145668", "39120763", "39312012", "35204301", "36912744",
            "35658342", "36181780", "34997340", "35634597", "37429783",
            "37307422", "36321995", "38761337", "38356760",
        ],
        "uncertain": [],
    },
    "HRS2_KIDNEY_DISEASE": {
        "retain": ["36088526"],
        "deprioritize": [
            "39200348", "40702230", "41859737", "35314072", "36704595",
            "38328391", "41204553", "34717305", "36630492", "42327478",
            "38319546", "40113040", "41150979",
        ],
        "uncertain": [],
    },
    "HRS3_PREGNANCY": {
        "retain": ["38456342", "41900304", "41966490", "41990347"],
        "deprioritize": [
            "36584689", "34844500", "35866154", "36971966", "36632272",
            "35301401", "32828743", "35561708", "32912927", "34842031",
            "35994745", "35894718", "37878827", "39485595", "39130210",
            "37309815", "38421280", "39887107", "39163029", "37419168",
            "41211248", "41480354", "42404154", "40920409", "41062817",
        ],
        "uncertain": [],
    },
    "HRS4_LIVER_DISEASE": {
        "retain": ["39519500", "38071155"],
        "deprioritize": [
            "36880395", "38219807", "42467982", "30726015", "36433866",
            "38016814", "39388923", "40838840", "42498088", "40620505",
            "35035159",
        ],
        "uncertain": [],
    },
    "HRS5_ANTICOAGULATION": {
        "retain": [],
        "deprioritize": [
            "37598356", "37814735", "35871859", "38567789", "34625983",
            "40177510", "35472458", "36244517", "39386345", "38739708",
            "41986202",
        ],
        "uncertain": [],
    },
}

for _question_id, _decisions in AUDIT_EXPECTED.items():
    for _decision, _pmids in _decisions.items():
        EXPECTED[_question_id][_decision].extend(_pmids)

ANIMAL_CASES = {
    ("HRS1_PERIOPERATIVE", "34980778"),
    ("HRS2_KIDNEY_DISEASE", "34309798"),
    ("HRS2_KIDNEY_DISEASE", "34420167"),
    ("HRS2_KIDNEY_DISEASE", "34856477"),
    ("HRS2_KIDNEY_DISEASE", "42506718"),
    ("HRS3_PREGNANCY", "32912100"),
    ("HRS3_PREGNANCY", "35947545"),
    ("HRS3_PREGNANCY", "35995981"),
    ("HRS3_PREGNANCY", "41094441"),
    ("HRS4_LIVER_DISEASE", "31736373"),
    ("HRS4_LIVER_DISEASE", "32482111"),
    ("HRS4_LIVER_DISEASE", "32551976"),
    ("HRS4_LIVER_DISEASE", "32842782"),
    ("HRS4_LIVER_DISEASE", "33824458"),
    ("HRS4_LIVER_DISEASE", "42501513"),
    ("HRS5_ANTICOAGULATION", "34121529"),
    ("HRS5_ANTICOAGULATION", "34622986"),
    ("HRS5_ANTICOAGULATION", "35038554"),
    ("HRS5_ANTICOAGULATION", "35049594"),
    ("HRS5_ANTICOAGULATION", "33879035"),
    ("HRS2_KIDNEY_DISEASE", "37673290"),
    ("HRS2_KIDNEY_DISEASE", "41568437"),
    ("HRS2_KIDNEY_DISEASE", "41143739"),
    ("HRS3_PREGNANCY", "38133610"),
    ("HRS3_PREGNANCY", "39053158"),
    ("HRS3_PREGNANCY", "40158005"),
    ("HRS3_PREGNANCY", "40638899"),
    ("HRS3_PREGNANCY", "41094493"),
    ("HRS3_PREGNANCY", "40154150"),
    ("HRS4_LIVER_DISEASE", "38905402"),
    ("HRS4_LIVER_DISEASE", "40762285"),
    ("HRS4_LIVER_DISEASE", "42497478"),
    ("HRS1_PERIOPERATIVE", "40380251"),
    ("HRS3_PREGNANCY", "35301401"),
    ("HRS4_LIVER_DISEASE", "38219807"),
    ("HRS4_LIVER_DISEASE", "40838840"),
}

REQUIRED_REASON_CODES = {
    ("HRS1_PERIOPERATIVE", "39671973"): {"exposure"},
    ("HRS1_PERIOPERATIVE", "41879405"): {"exposure"},
    ("HRS1_PERIOPERATIVE", "39059275"): {"exposure"},
    ("HRS1_PERIOPERATIVE", "39557196"): {"population"},
    ("HRS3_PREGNANCY", "39959527"): {"exposure"},
    ("HRS4_LIVER_DISEASE", "42491231"): {"exposure"},
    ("HRS1_PERIOPERATIVE", "36682414"): {"population", "exposure", "outcome"},
    ("HRS1_PERIOPERATIVE", "36089835"): {"exposure", "outcome"},
    ("HRS1_PERIOPERATIVE", "35781402"): {"population", "exposure"},
    ("HRS2_KIDNEY_DISEASE", "36088526"): {"population", "outcome"},
    ("HRS3_PREGNANCY", "38456342"): {"population", "exposure", "outcome"},
    ("HRS3_PREGNANCY", "41900304"): {"population", "exposure"},
    ("HRS3_PREGNANCY", "41966490"): {"population", "exposure", "outcome"},
    ("HRS3_PREGNANCY", "41990347"): {"population", "exposure"},
    ("HRS4_LIVER_DISEASE", "39519500"): {"population", "exposure", "outcome"},
    ("HRS4_LIVER_DISEASE", "38071155"): {"exposure", "outcome"},
}

FORBIDDEN_REASON_CODES = {
    ("HRS3_PREGNANCY", "37644576"): {"animal_term_present"},
    ("HRS3_PREGNANCY", "41094493"): {"population", "human_signal"},
    ("HRS3_PREGNANCY", "40154150"): {"population", "human_signal"},
    ("HRS2_KIDNEY_DISEASE", "41143739"): {"population", "human_signal"},
    ("HRS1_PERIOPERATIVE", "40380251"): {"population", "exposure", "human_signal"},
    ("HRS1_PERIOPERATIVE", "37926225"): {"exposure", "human_signal"},
    ("HRS3_PREGNANCY", "37541986"): {"animal_term_present"},
    ("HRS3_PREGNANCY", "41020306"): {"exposure", "outcome"},
    ("HRS3_PREGNANCY", "42069426"): {"exposure"},
    ("HRS5_ANTICOAGULATION", "41169345"): set(),
}

EXPECTED_CONFIDENCE = {
    ("HRS1_PERIOPERATIVE", pmid): "high"
    for pmid in (
        "20301300", "34411017", "34980887", "31364414", "35382835",
        "35315624", "34059194", "34609004", "35442771", "38911421",
        "34995935", "41766153",
    )
}
EXPECTED_CONFIDENCE.update(
    {
        ("HRS1_PERIOPERATIVE", "39671973"): "high",
        ("HRS1_PERIOPERATIVE", "41879405"): "high",
        ("HRS1_PERIOPERATIVE", "40777177"): "medium",
        # The frozen prompt requires low confidence whenever no abstract is
        # available, even when all three concepts occur in the title.
        ("HRS3_PREGNANCY", "39959527"): "low",
        # The named treatment is not explicitly identified as a supplement in
        # the record.  P+O are present and I remains unknown.
        ("HRS4_LIVER_DISEASE", "37708539"): "medium",
        ("HRS4_LIVER_DISEASE", "42491231"): "high",
    }
)
FORBIDDEN_REASON_CODES[("HRS1_PERIOPERATIVE", "40777177")] = {"outcome"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_external_audit_cases() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    cases: list[dict[str, object]] = []
    files: list[dict[str, object]] = []
    if not AUDIT_CASE_DIR.exists():
        return cases, files
    allowed_decisions = {"retain", "deprioritize", "uncertain"}
    allowed_confidence = {"high", "medium", "low"}
    allowed_reasons = {
        "population", "exposure", "outcome", "human_signal", "design_signal",
        "animal_term_present", "off_topic", "insufficient_abstract",
    }
    for path in sorted(AUDIT_CASE_DIR.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            raise RuntimeError(f"audit case file is not a JSON array: {path}")
        seen: set[tuple[str, str]] = set()
        for position, case in enumerate(payload):
            if not isinstance(case, dict):
                raise RuntimeError(f"audit case is not an object: {path}:{position}")
            key = (str(case.get("question_id", "")), str(case.get("pmid", "")))
            if not key[0] or not key[1] or key in seen:
                raise RuntimeError(f"invalid or duplicate audit key: {path}:{key}")
            seen.add(key)
            decision = str(case.get("expected_decision", ""))
            confidence = str(case.get("expected_confidence", ""))
            required = set(case.get("required_reason_codes", []))
            forbidden = set(case.get("forbidden_reason_codes", []))
            if decision not in allowed_decisions or confidence not in allowed_confidence:
                raise RuntimeError(f"invalid audit decision/confidence: {path}:{key}")
            if not required <= allowed_reasons or not forbidden <= allowed_reasons or required & forbidden:
                raise RuntimeError(f"invalid audit reason constraints: {path}:{key}")
            cases.append(case)
        files.append(
            {
                "path": path.resolve().relative_to(ROOT.resolve()).as_posix(),
                "sha256": sha256(path),
                "case_count": len(payload),
            }
        )
    return cases, files


def run(*, apply_adjudications: bool = False) -> dict[str, object]:
    expected: dict[tuple[str, str], str] = {}
    for question_id, decisions in EXPECTED.items():
        for decision, pmids in decisions.items():
            for pmid in pmids:
                key = (question_id, pmid)
                if key in expected:
                    raise RuntimeError(f"duplicate regression key: {key}")
                expected[key] = decision

    required_reason_codes = {key: set(value) for key, value in REQUIRED_REASON_CODES.items()}
    forbidden_reason_codes = {key: set(value) for key, value in FORBIDDEN_REASON_CODES.items()}
    expected_confidence_map = dict(EXPECTED_CONFIDENCE)
    external_cases, audit_case_files = load_external_audit_cases()
    for case in external_cases:
        key = (str(case["question_id"]), str(case["pmid"]))
        decision = str(case["expected_decision"])
        if key in expected and expected[key] != decision:
            raise RuntimeError(f"conflicting audit decision for {key}: {expected[key]} != {decision}")
        expected[key] = decision
        confidence = str(case["expected_confidence"])
        prior_confidence = expected_confidence_map.get(key)
        if prior_confidence and prior_confidence != confidence:
            raise RuntimeError(
                f"conflicting audit confidence for {key}: {prior_confidence} != {confidence}"
            )
        expected_confidence_map[key] = confidence
        required_reason_codes.setdefault(key, set()).update(case.get("required_reason_codes", []))
        forbidden_reason_codes.setdefault(key, set()).update(case.get("forbidden_reason_codes", []))
        overlap = required_reason_codes[key] & forbidden_reason_codes[key]
        if overlap:
            raise RuntimeError(f"conflicting audit reason codes for {key}: {sorted(overlap)}")

    rows: dict[tuple[str, str], dict[str, str]] = {}
    with CORPUS.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (row["question_id"], row["provider_id"])
            if key in expected:
                if key in rows:
                    raise RuntimeError(f"duplicate corpus key for regression: {key}")
                rows[key] = row

    failures: list[dict[str, object]] = []
    observed_counts: dict[str, int] = {}
    for key, expected_decision in expected.items():
        row = rows.get(key)
        if row is None:
            failures.append({"question_id": key[0], "pmid": key[1], "problem": "missing_record"})
            continue
        result = classify(row, apply_adjudication=apply_adjudications)
        observed_counts[result["decision"]] = observed_counts.get(result["decision"], 0) + 1
        problems: list[str] = []
        if result["decision"] != expected_decision:
            problems.append(f"decision:{result['decision']}!=expected:{expected_decision}")
        if key in ANIMAL_CASES:
            if "animal_term_present" not in result["reason_codes"]:
                problems.append("missing_animal_term_present")
            if "population" in result["reason_codes"] or "human_signal" in result["reason_codes"]:
                problems.append("nonclinical_case_has_clinical_reason")
        if key in {
            ("HRS5_ANTICOAGULATION", "28520347"),
            ("HRS5_ANTICOAGULATION", "29261922"),
        } and "exposure" in result["reason_codes"]:
            problems.append("vitamin_k_mechanism_misread_as_exposure")
        missing_reasons = required_reason_codes.get(key, set()) - set(result["reason_codes"])
        if missing_reasons:
            problems.append("missing_reason_codes:" + ",".join(sorted(missing_reasons)))
        forbidden_reasons = forbidden_reason_codes.get(key, set()) & set(result["reason_codes"])
        if forbidden_reasons:
            problems.append("forbidden_reason_codes:" + ",".join(sorted(forbidden_reasons)))
        expected_confidence = expected_confidence_map.get(key)
        if expected_confidence and result["confidence"] != expected_confidence:
            problems.append(f"confidence:{result['confidence']}!=expected:{expected_confidence}")
        if problems:
            failures.append(
                {
                    "question_id": key[0], "pmid": key[1], "title": row["title"],
                    "problems": problems, "observed": result,
                }
            )

    total = len(expected)
    report = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": "adjudication_consistency" if apply_adjudications else "raw_rule_audit",
        "adjudications_applied": apply_adjudications,
        "worker_version": WORKER_VERSION,
        "worker_sha256": sha256(WORKER),
        "prompt_sha256": sha256(PROMPT),
        "corpus_sha256": sha256(CORPUS),
        "audit_case_files": audit_case_files,
        "case_count": total,
        "passed_case_count": total - len(failures),
        "failed_case_count": len(failures),
        "all_passed": not failures,
        "observed_decision_distribution": dict(sorted(observed_counts.items())),
        "failures": failures,
    }
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-report", action="store_true")
    parser.add_argument("--apply-adjudications", action="store_true")
    parser.add_argument("--allow-mismatches", action="store_true")
    args = parser.parse_args()
    report = run(apply_adjudications=args.apply_adjudications)
    if args.write_report:
        report_path = ADJUDICATED_REPORT if args.apply_adjudications else RAW_REPORT
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["all_passed"] and not args.allow_mismatches:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
