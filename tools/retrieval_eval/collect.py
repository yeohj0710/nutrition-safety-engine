"""조회 결과 적합성 평가용 자료를 모은다.

다섯 상황마다 조건 없음과 조건 하나씩(연령, 병용 약물, 용량, 성별, 기저 질환)을
운영 조회 API에 넣어 기본 화면에 나오는 문헌(최대 15건)을 받는다. 조회 경로는
결정적이므로 같은 날 다시 돌려도 같은 목록이 나온다. 초록은 PubMed efetch로
받는다. 언어모델을 호출하지 않는다.

    python -m tools.retrieval_eval.collect
"""

from __future__ import annotations

import json
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

API = "https://nutrition-safety-engine.vercel.app/api/personalized-safety"
EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
OUT = Path(__file__).resolve().parents[2] / "research" / "retrieval_eval"

SITUATIONS = [
    "HRS1_PERIOPERATIVE",
    "HRS2_KIDNEY_DISEASE",
    "HRS3_PREGNANCY",
    "HRS4_LIVER_DISEASE",
    "HRS5_ANTICOAGULATION",
]
AXES = ["age_group", "concomitant_medication", "dose_range", "sex", "underlying_condition"]


def post(body: dict) -> dict:
    req = urllib.request.Request(
        API,
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def fetch_abstracts(pmids: list[str]) -> dict[str, str]:
    found: dict[str, str] = {}
    for start in range(0, len(pmids), 150):
        chunk = pmids[start : start + 150]
        url = f"{EFETCH}?db=pubmed&retmode=xml&id={','.join(chunk)}"
        with urllib.request.urlopen(url, timeout=120) as res:
            root = ET.fromstring(res.read())
        for article in root.iter("PubmedArticle"):
            pmid = article.findtext(".//MedlineCitation/PMID") or ""
            parts = []
            for node in article.iter("AbstractText"):
                text = "".join(node.itertext()).strip()
                label = node.get("Label")
                parts.append(f"{label}: {text}" if label else text)
            found[pmid] = " ".join(parts)
        time.sleep(0.4)
    return found


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    queries = []
    for situation in SITUATIONS:
        base = post({"situation": situation, "axes": []})
        coverage = base["axis_coverage"]
        conditions: list[list[str]] = [[]] + [[axis] for axis in AXES if coverage.get(axis) is not None]
        for axes in conditions:
            data = base if not axes else post({"situation": situation, "axes": axes})
            core_shown = data["core_shown"]
            queries.append(
                {
                    "situation": situation,
                    "axes": axes,
                    "core_shown": core_shown,
                    "extended_shown": data["extended_shown"],
                    "results": [
                        {
                            "rank": index + 1,
                            "layer": "core" if index < core_shown else "topup",
                            "record_id": item["record_id"],
                            "title": item["title"],
                            "year": item["year"],
                            "publication_types": item["publication_types"],
                        }
                        for index, item in enumerate(data["evidence"])
                    ],
                }
            )
            time.sleep(0.3)

    pmids = sorted(
        {r["record_id"].split(":", 1)[1] for q in queries for r in q["results"] if r["record_id"].startswith("pubmed:")}
    )
    abstracts = fetch_abstracts(pmids)
    (OUT / "queries.json").write_text(json.dumps(queries, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "abstracts.json").write_text(json.dumps(abstracts, ensure_ascii=False, indent=1), encoding="utf-8")
    shown = sum(len(q["results"]) for q in queries)
    print(f"queries {len(queries)}, results {shown}, unique pmids {len(pmids)}, abstracts {sum(1 for v in abstracts.values() if v)}")


if __name__ == "__main__":
    main()
