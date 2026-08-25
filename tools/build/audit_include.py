"""retain 76,730행이 주제에 맞는지 결정론으로 센다.

260824 발표에서 받은 검토 요구에 답하려고 만들었다.

  25만건에서 title, abstract로 하면 대략적으로 7만건이 아니라 한 2~3만건
  정도로 추려져야 하는데 (...) 너무 많이 include 된 것은 아닌지 검토 필요함.

선별 기준은 evidence-recollect 의 재판정 규칙과 같다. 이 질문의 대상(P)과
노출(I)에 맞고 사람 대상 근거가 보이면 유지다. 결과(O)와 연구설계는 기준에
없다. 그래서 여기서도 P 와 I 만 센다.

1차에서 걸린 24건을 읽어 보니 절반은 정규식이 놓친 것이었다.
  - 한약을 "Chinese medical preparation", "Si-Jun-Zi decoction" 으로 쓴 것
  - 오메가3을 "n-3 PUFA" 로 쓴 것
  - 보충제를 "complementary and alternative medicine" 으로 묶은 것
  - 수술을 "endarterectomy", "renal allograft" 로 쓴 것
  - 콩팥병을 "anephric" 으로 쓴 것
  - 감초를 "licorice" 로 쓴 것

놓친 표현을 다 넣었다. 일부러 넉넉하게 잡는다. 그래야 남는 숫자가 "이만큼은
확실히 주제가 다르다"는 하한이 된다. 모델을 부르지 않는다. 같은 입력에 같은
출력이다.

    python tools/build/audit_include.py

결과는 research/logs/include_audit_260825.md 에 적었다.
"""

from __future__ import annotations

import csv
import re
import sys
from collections import Counter, defaultdict

csv.field_size_limit(10_000_000)
CORPUS = "data/corpus/evidence_map.csv"
SCREEN = "data/corpus/agent_screening_classifications.csv"

SUPPLEMENT = re.compile(
    r"(?:supplement\w*|vitamin|multivitamin|micronutrient|mineral\s+status|"
    r"folate|folic\s+acid|thiamin\w*|riboflavin|niacin|pyridoxine|cobalamin|biotin|"
    r"ascorb\w*|tocopherol|retinol|calciferol|calcitriol|alfacalcidol|carotenoid|"
    r"menaquinone|phylloquinone|phytonadione|"
    r"\biron\b|ferrous|ferric|\bzinc\b|selenium|magnesium|calcium|copper|iodine|"
    r"manganese|chromium|molybdenum|phosphate\s+binder|"
    r"omega[-\s]?3|omega[-\s]?6|\bn-?3\b|\bn-?6\b|fish\s+oil|krill|\bepa\b|\bdha\b|"
    r"eicosapenta\w*|docosahexa\w*|polyunsaturated\s+fatty|\bpufa\b|fatty\s+acid|"
    r"linoleic|linolenic|"
    r"probiotic\w*|prebiotic\w*|synbiotic\w*|lactobacill\w*|bifidobact\w*|"
    r"herb\w*|botanic\w*|phytotherap\w*|phytochemic\w*|nutraceutic\w*|"
    r"dietary\s+supplement|food\s+supplement|nutritional\s+support|nutrition\s+therapy|"
    r"amino\s+acid|glutamine|arginine|carnitine|creatine|taurine|whey|"
    r"coenzyme\s*q|ubiquinone|curcumin|turmeric|ginseng|ginkgo|milk\s+thistle|"
    r"silymarin|silibinin|st\.?\s*john|echinacea|garlic|green\s+tea|licorice|"
    r"glycyrrhiz\w*|tripterygium|astragal\w*|berberine|resveratrol|quercetin|"
    r"melatonin|collagen|glucosamine|chondroitin|fib(?:er|re)\s+supplement|"
    r"enteral\s+nutrition|parenteral\s+nutrition|immunonutrition|oral\s+nutritional|"
    r"traditional\s+chinese\s+medic\w*|chinese\s+medic\w*|chinese\s+herb\w*|\btcm\b|"
    r"decoction|granule|kampo|ayurved\w*|panchakarma|"
    r"complementary\s+and\s+alternative|alternative\s+medicine|integrative\s+medicine|"
    r"mushroom|hericium|extract\b|antioxidant\w*|micronutrient\w*)",
    re.IGNORECASE,
)

HUMAN = re.compile(
    r"\b(?:patients?|participants?|subjects?|volunteers?|adults?|children|infants?|"
    r"neonates?|women|men|humans?|pregnan\w*|cohort|randomi[sz]ed|case\s+report|"
    r"clinical\s+trial|cross[-\s]?sectional|case[-\s]?control|recipients?)\b",
    re.IGNORECASE,
)

POPULATION = {
    "HRS1_PERIOPERATIVE": re.compile(
        r"(?:periopera\w*|preopera\w*|postopera\w*|post[-\s]opera\w*|intraopera\w*|"
        r"surgery|surgical|surgeon|operation|operative|resect\w*|excision|"
        r"anesthe\w*|anaesthe\w*|prehabilitat\w*|enhanced\s+recovery|\beras\b|"
        r"laparoscop\w*|laparotom\w*|arthroplasty|endarterectom\w*|"
        r"transplant\w*|allograft|\bgraft\b|bypass|stent|catheter|"
        r"colonoscop\w*|endoscop\w*|\bpci\b|percutaneous\s+coronary|"
        r"c(?:a)?esarean|hysterectom\w*|gastrectom\w*|colectom\w*|nephrectom\w*|"
        r"hepatectom\w*|resection|amputat\w*|implant\w*|incision|wound\s+heal\w*|"
        r"resection|\bicu\b|intensive\s+care|critically\s+ill)",
        re.IGNORECASE),
    "HRS2_KIDNEY_DISEASE": re.compile(
        r"(?:kidney|renal|nephro\w*|nephri\w*|anephric|dialysis|dialy[sz]\w*|"
        r"h[ae]modialysis|peritoneal\s+dialysis|\bckd\b|\besrd\b|\bakd\b|\baki\b|"
        r"ur[ae]mi\w*|glomerul\w*|creatinine|\begfr\b|\bgfr\b|proteinuria|"
        r"albuminuria|nephropath\w*|nephrotic|nephrotox\w*)",
        re.IGNORECASE),
    "HRS3_PREGNANCY": re.compile(
        r"(?:pregnan\w*|gestation\w*|matern\w*|prenatal|antenatal|preconcept\w*|"
        r"perinatal|postpartum|postnatal|obstetric\w*|trimester|f[oe]etal|f[oe]etus|"
        r"lactat\w*|breastfeed\w*|breast[-\s]?fed|neonat\w*|birth\s+weight|"
        r"preterm|premature\s+birth|miscarriage|stillbirth|abortion|"
        r"pre[-\s]?eclamps\w*|eclamps\w*|birth\s+defect|congenital|infant)",
        re.IGNORECASE),
    "HRS4_LIVER_DISEASE": re.compile(
        r"(?:liver|hepat\w*|cirrho\w*|\bnafld\b|\bnash\b|\bmafld\b|\bmasld\b|\bmash\b|"
        r"steato\w*|fibrosis|\balt\b|\bast\b|transaminase|aminotransferase|"
        r"bilirubin|portal\s+hypertension|varice\w*|ascites|encephalopath\w*|"
        r"cholestas\w*|biliary|\bhbv\b|\bhcv\b)",
        re.IGNORECASE),
    "HRS5_ANTICOAGULATION": re.compile(
        r"(?:anticoagul\w*|antithrombot\w*|warfarin|coumarin|coumadin|\bvka\b|"
        r"\bdoac\b|\bnoac\b|apixaban|rivaroxaban|dabigatran|edoxaban|heparin|"
        r"enoxaparin|fondaparinux|antiplatelet|aspirin|clopidogrel|ticagrelor|"
        r"\binr\b|prothrombin|thromb\w*|embol\w*|bleed\w*|h[ae]morrhag\w*|"
        r"atrial\s+fibrillation|coagul\w*|platelet)",
        re.IGNORECASE),
}


def main() -> None:
    decisions = {}
    with open(SCREEN, encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            decisions[(row["question_id"], row["record_id"])] = row["decision"]

    stats: dict[str, Counter] = defaultdict(Counter)
    with open(CORPUS, encoding="utf-8-sig", newline="") as handle:
        for n, row in enumerate(csv.DictReader(handle), start=1):
            if n % 50_000 == 0:
                print(f"  {n:,}", file=sys.stderr)
            question = row["question_id"]
            if decisions.get((question, row["record_id"])) != "retain":
                continue
            text = f"{row['title']} {row['abstract']}"
            has_p = bool(POPULATION[question].search(text))
            has_i = bool(SUPPLEMENT.search(text))
            has_human = bool(HUMAN.search(text))
            c = stats[question]
            c["retain"] += 1
            c["P"] += has_p
            c["I"] += has_i
            c["P+I"] += has_p and has_i
            c["P+I+사람"] += has_p and has_i and has_human
            if not has_p and has_i:
                c["대상만 어긋남"] += 1
            if has_p and not has_i:
                c["노출만 어긋남"] += 1
            if not has_p and not has_i:
                c["둘 다 어긋남"] += 1

    total = Counter()
    for c in stats.values():
        total.update(c)

    head = (f"{'질문':24s}{'retain':>9s}{'P+I':>9s}{'통과율':>8s}"
            f"{'대상어긋':>9s}{'노출어긋':>9s}{'둘다':>7s}{'주제밖':>9s}{'비율':>7s}")
    print("\n" + head)
    print("-" * len(head))
    for q in sorted(stats):
        c = stats[q]
        r, ok = c["retain"], c["P+I"]
        off = r - ok
        print(f"{q:24s}{r:>9,}{ok:>9,}{ok/r*100:>7.1f}%"
              f"{c['대상만 어긋남']:>9,}{c['노출만 어긋남']:>9,}{c['둘 다 어긋남']:>7,}"
              f"{off:>9,}{off/r*100:>6.1f}%")
    r, ok = total["retain"], total["P+I"]
    off = r - ok
    print("-" * len(head))
    print(f"{'합계':24s}{r:>9,}{ok:>9,}{ok/r*100:>7.1f}%"
          f"{total['대상만 어긋남']:>9,}{total['노출만 어긋남']:>9,}{total['둘 다 어긋남']:>7,}"
          f"{off:>9,}{off/r*100:>6.1f}%")
    print(f"\n넉넉한 기준으로도 주제가 어긋나는 retain: {off:,}행 ({off/r*100:.1f}%)")
    print(f"P·I 둘 다 맞는 retain:                  {ok:,}행")
    print(f"거기서 사람 대상까지 보이는 것:          {total['P+I+사람']:,}행")


if __name__ == "__main__":
    main()
