"""문헌 후보 25,747행의 초록을 PubMed에서 다시 받는다.

조건 색인을 다시 계산하려면 제목과 초록이 필요한데, 원자료(picos_extraction.csv)는
연구 PC에만 있다. 공개 초록을 efetch로 받아 etc 아래에 캐시한다. 받은 초록에 기존
판정식을 돌려 현재 색인과 같게 나오는지 대조해야 이 캐시를 쓸 수 있다.

    python -m tools.build.fetch_candidate_abstracts
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXTENDED = ROOT / "research" / "systematic_review" / "extended_evidence"
CACHE = ROOT / "research" / "systematic_review" / "etc" / "candidate_abstracts.json"
EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
QUESTIONS = [
    "HRS1_PERIOPERATIVE",
    "HRS2_KIDNEY_DISEASE",
    "HRS3_PREGNANCY",
    "HRS4_LIVER_DISEASE",
    "HRS5_ANTICOAGULATION",
]


def parse(xml: bytes) -> dict[str, str]:
    found: dict[str, str] = {}
    for article in ET.fromstring(xml).iter("PubmedArticle"):
        pmid = article.findtext(".//MedlineCitation/PMID") or ""
        parts = []
        for node in article.iter("AbstractText"):
            text = "".join(node.itertext()).strip()
            label = node.get("Label")
            parts.append(f"{label}: {text}" if label else text)
        found[pmid] = " ".join(parts)
    return found


def main() -> None:
    pmids: set[str] = set()
    for question in QUESTIONS:
        data = json.loads((EXTENDED / f"{question}.json").read_text(encoding="utf-8"))
        pmids.update(item["record_id"].split(":", 1)[1] for item in data["evidence"])
    cache: dict[str, str] = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    todo = sorted(pmids - set(cache))
    print(f"pmids {len(pmids)}, cached {len(cache)}, to fetch {len(todo)}")
    for start in range(0, len(todo), 200):
        chunk = todo[start : start + 200]
        body = urllib.parse.urlencode({"db": "pubmed", "retmode": "xml", "id": ",".join(chunk)}).encode()
        for attempt in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(EFETCH, data=body), timeout=180) as res:
                    got = parse(res.read())
                break
            except Exception as error:  # noqa: BLE001 - 네트워크 재시도
                print(f"retry {start} {attempt}: {error}")
                time.sleep(5 * (attempt + 1))
        else:
            raise SystemExit(f"failed at {start}")
        for pmid in chunk:
            cache[pmid] = got.get(pmid, "")
        if start // 200 % 10 == 0:
            CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
            print(f"{start + len(chunk)}/{len(todo)}")
        time.sleep(0.4)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    print(f"done {len(cache)}, empty {sum(1 for v in cache.values() if not v)}")


if __name__ == "__main__":
    main()
