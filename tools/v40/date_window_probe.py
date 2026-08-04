# -*- coding: utf-8 -*-
"""기간 제한이 잘라낸 크기를 건수로만 진단한다.

인출·선별·채점을 하지 않는다. 동결된 질의문에서 시작일만 바꿔 ESearch 건수를 비교한다.
상한(2026/07/28)은 그대로 두어 시작일 하나만 달라지게 한다.
"""
import io
import json
import time
import urllib.parse
import urllib.request

QDEF = r"C:\dev\nutrition-safety-engine\research\searches_v4\query_definitions.json"
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
TOOL = "nutrition-safety-engine-date-window-probe"
EMAIL = "wellnessbox.tips@gmail.com"

# 논문 표 1 이 기록한 ESearch 건수
RECORDED = {
    "HRS1_PERIOPERATIVE": 12296,
    "HRS2_KIDNEY_DISEASE": 4704,
    "HRS3_PREGNANCY": 20376,
    "HRS4_LIVER_DISEASE": 6919,
    "HRS5_ANTICOAGULATION": 3751,
}
LABEL = {
    "HRS1_PERIOPERATIVE": "수술 전후",
    "HRS2_KIDNEY_DISEASE": "만성콩팥병",
    "HRS3_PREGNANCY": "임신",
    "HRS4_LIVER_DISEASE": "간질환",
    "HRS5_ANTICOAGULATION": "항응고 치료",
}


def count(term):
    params = urllib.parse.urlencode({
        "db": "pubmed", "term": term, "rettype": "count",
        "retmode": "json", "tool": TOOL, "email": EMAIL,
    })
    req = urllib.request.Request(EUTILS, data=params.encode("utf-8"),
                                 headers={"User-Agent": TOOL})
    with urllib.request.urlopen(req, timeout=60) as r:
        return int(json.loads(r.read().decode("utf-8"))["esearchresult"]["count"])


qs = json.load(io.open(QDEF, encoding="utf-8"))["questions"]
rows = []
for q in qs:
    qid, term = q["question_id"], q["query"]
    assert '"2022/01/01"[Date - Publication]' in term, qid
    wide = term.replace('"2022/01/01"[Date - Publication]',
                        '"1900/01/01"[Date - Publication]')
    n_orig = count(term)
    time.sleep(0.5)
    n_wide = count(wide)
    time.sleep(0.5)
    rows.append((qid, RECORDED[qid], n_orig, n_wide))
    print(f"{LABEL[qid]:10s} 원장 {RECORDED[qid]:>7,}  재조회 {n_orig:>7,}  "
          f"시작일 해제 {n_wide:>7,}  배수 {n_wide / n_orig:.2f}")

t_rec = sum(r[1] for r in rows)
t_o = sum(r[2] for r in rows)
t_w = sum(r[3] for r in rows)
print(f"\n{'합계':10s} 원장 {t_rec:>7,}  재조회 {t_o:>7,}  시작일 해제 {t_w:>7,}  "
      f"배수 {t_w / t_o:.2f}")
print(f"창 밖 건수 {t_w - t_o:,} · 전체의 {(t_w - t_o) / t_w * 100:.1f}%")

io.open("date_window_probe.json", "w", encoding="utf-8").write(json.dumps({
    "purpose": "기간 제한이 잘라낸 크기를 건수로만 진단. 인출·선별·채점 없음.",
    "upper_bound_unchanged": "2026/07/28",
    "start_original": "2022/01/01",
    "start_probe": "1900/01/01",
    "per_question": [
        {"question_id": r[0], "recorded_hit": r[1], "recheck_hit": r[2],
         "hit_without_start_limit": r[3], "ratio": round(r[3] / r[2], 4)}
        for r in rows
    ],
    "total": {"recorded": t_rec, "recheck": t_o, "without_start_limit": t_w,
              "ratio": round(t_w / t_o, 4), "outside_window": t_w - t_o},
}, ensure_ascii=False, indent=2))
print("\ndate_window_probe.json 저장")
