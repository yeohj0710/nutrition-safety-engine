"""v4.0 채점 arm — 층화 표본 추출과 맹검 카드 생성.

판정은 하지 않는다. 이 스크립트는 표본 추출, 카드 생성, 누출 검사, 해시 기록만 한다.
로컬 언어모델을 로드하지 않으며 외부 API를 호출하지 않는다.

층화 설계 (코퍼스 완전분할, label_source 교차):
  S1 작업기 x retain        N=3,251   n=180  (질문당 36)
  S2 작업기 x deprioritize  N=44,107  n=180  (질문당 36)
  S3 작업기 x uncertain     N=57      n=57   (전수)
  S4 재판정 (전 라벨)        N=616     n=616  (전수)
  합계 N=48,031  n=1,033

시드 20260729. 무작위 추출은 SHA-256(seed, question_id, record_id) 결정적 순위로 한다.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "research" / "screening" / "v40_agent"
CORPUS = ROOT / "data" / "curated_v4" / "evidence_map.csv"
SEARCHES = ROOT / "research" / "searches_v4"
OUT = ROOT / "research" / "validation" / "screening_ai_reference_v40"

SEED = "20260729"
PER_QUESTION = 36

# 카드에 허용된 필드. 이 목록 밖의 키가 카드에 들어가면 누출 검사가 실패한다.
CARD_FIELDS = ("record_id", "question_id", "title", "abstract", "publication_types", "mesh_terms")

# 카드에 절대 들어가면 안 되는 v4.0 판정 관련 키.
FORBIDDEN_KEYS = (
    "decision", "reason_codes", "confidence", "label_source", "evidence_basis",
    "worker_decision", "status", "adjudication", "rule", "pattern",
)

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def rank_key(question_id: str, record_id: str) -> str:
    return hashlib.sha256(f"{SEED}|{question_id}|{record_id}".encode("utf-8")).hexdigest()


# ---------------------------------------------------------------- 1. 최종 라벨
def load_final_labels() -> dict[tuple[str, str], dict]:
    worker: dict[tuple[str, str], dict] = {}
    for fp in sorted((BASE / "decisions").glob("*.jsonl")):
        with fp.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                r = json.loads(line)
                key = (r["question_id"], r["record_id"])
                if key in worker:
                    raise RuntimeError(f"duplicate worker key {key}")
                worker[key] = r

    adj_payload = json.loads((BASE / "semantic_adjudications.json").read_text(encoding="utf-8"))
    adj = {(i["question_id"], i["record_id"]): i for i in adj_payload["records"]}
    if len(adj) != adj_payload["record_count"]:
        raise RuntimeError("adjudication record_count mismatch")
    if set(adj) - set(worker):
        raise RuntimeError("adjudication keys absent from worker output")

    final: dict[tuple[str, str], dict] = {}
    for key, w in worker.items():
        src = adj.get(key)
        row = src if src is not None else w
        final[key] = {
            "decision": row["decision"],
            "reason_codes": row["reason_codes"],
            "confidence": row["confidence"],
            "evidence_basis": row["evidence_basis"],
            "label_source": "adjudication" if src is not None else "worker",
        }
    return final


# ---------------------------------------------------------------- 2. 층화 추출
def build_sample(final: dict[tuple[str, str], dict]) -> tuple[list[dict], dict]:
    questions = sorted({q for q, _ in final})

    pools: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for key, v in final.items():
        q, _ = key
        if v["label_source"] == "adjudication":
            pools["S4_adjudication"].append(key)
        elif v["decision"] == "retain":
            pools[f"S1_worker_retain|{q}"].append(key)
        elif v["decision"] == "deprioritize":
            pools[f"S2_worker_deprioritize|{q}"].append(key)
        else:
            pools["S3_worker_uncertain"].append(key)

    selected: list[dict] = []
    strata: dict[str, dict] = {}

    def take(stratum_id: str, pool_key: str, n: int | None) -> None:
        pool = sorted(pools[pool_key], key=lambda k: rank_key(*k))
        N = len(pool)
        take_n = N if n is None else n
        if take_n > N:
            raise RuntimeError(f"{pool_key}: 표본 {take_n} > 모수 {N}")
        chosen = pool[:take_n]
        strata[stratum_id] = {
            "stratum_id": stratum_id,
            "population_N": N,
            "sample_n": take_n,
            "census": n is None,
            "weight": 1.0 if n is None else N / take_n,
        }
        for key in chosen:
            selected.append({"question_id": key[0], "record_id": key[1], "stratum_id": stratum_id})

    for q in questions:
        take(f"S1_worker_retain|{q}", f"S1_worker_retain|{q}", PER_QUESTION)
    for q in questions:
        take(f"S2_worker_deprioritize|{q}", f"S2_worker_deprioritize|{q}", PER_QUESTION)
    take("S3_worker_uncertain", "S3_worker_uncertain", None)
    take("S4_adjudication", "S4_adjudication", None)

    total_N = sum(s["population_N"] for s in strata.values())
    if total_N != len(final):
        raise RuntimeError(f"층 모수 합 {total_N} != 코퍼스 {len(final)} — 완전분할 아님")

    keys = {(r["question_id"], r["record_id"]) for r in selected}
    if len(keys) != len(selected):
        raise RuntimeError("표본에 중복 키가 있다 — 층이 겹친다")

    design = {
        "seed": SEED,
        "rank_function": "SHA-256(seed|question_id|record_id) 오름차순",
        "per_question_worker_label_stratum": PER_QUESTION,
        "partition_is_exhaustive": True,
        "population_total": total_N,
        "sample_total": len(selected),
        "strata": strata,
    }
    return selected, design


# ---------------------------------------------------------------- 3. MeSH 추출
def extract_mesh(wanted_pmids: set[str]) -> dict[str, str]:
    mesh: dict[str, list[str]] = {}
    xml_files = sorted(SEARCHES.rglob("efetch_*.xml"))
    if not xml_files:
        raise RuntimeError("efetch XML을 찾지 못했다")
    for fp in xml_files:
        for _, elem in ET.iterparse(str(fp), events=("end",)):
            if not elem.tag.endswith("PubmedArticle"):
                continue
            pmid_el = elem.find("./MedlineCitation/PMID")
            pmid = (pmid_el.text or "").strip() if pmid_el is not None else ""
            if pmid in wanted_pmids and pmid not in mesh:
                terms = [
                    (d.text or "").strip()
                    for d in elem.findall("./MedlineCitation/MeshHeadingList/MeshHeading/DescriptorName")
                ]
                mesh[pmid] = [t for t in terms if t]
            elem.clear()
        if len(mesh) == len(wanted_pmids):
            break
    return {p: ";".join(v) for p, v in mesh.items()}


# ---------------------------------------------------------------- 4. 카드 생성
def build_cards(selected: list[dict]) -> tuple[list[dict], dict]:
    wanted = {(r["question_id"], r["record_id"]) for r in selected}
    pmids = {r["record_id"].split(":", 1)[-1] for r in selected}

    corpus: dict[tuple[str, str], dict] = {}
    with CORPUS.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            key = (row["question_id"], row["record_id"])
            if key in wanted and key not in corpus:
                corpus[key] = row
    missing = wanted - set(corpus)
    if missing:
        raise RuntimeError(f"코퍼스에서 {len(missing)}건을 찾지 못했다: {sorted(missing)[:5]}")

    mesh = extract_mesh(pmids)

    cards: list[dict] = []
    for r in sorted(selected, key=lambda x: rank_key(x["question_id"], x["record_id"])):
        key = (r["question_id"], r["record_id"])
        row = corpus[key]
        pmid = r["record_id"].split(":", 1)[-1]
        cards.append({
            "record_id": r["record_id"],
            "question_id": r["question_id"],
            "title": (row.get("title") or "").strip(),
            "abstract": (row.get("abstract") or "").strip(),
            "publication_types": (row.get("publication_types") or "").strip(),
            "mesh_terms": mesh.get(pmid, ""),
        })

    stats = {
        "cards": len(cards),
        "mesh_resolved": sum(1 for c in cards if c["mesh_terms"]),
        "mesh_absent": sum(1 for c in cards if not c["mesh_terms"]),
        "abstract_absent": sum(1 for c in cards if not c["abstract"]),
    }
    return cards, stats


# ---------------------------------------------------------------- 5. 누출 검사
def leak_check(cards: list[dict], final: dict[tuple[str, str], dict]) -> dict:
    problems: list[str] = []

    for i, c in enumerate(cards):
        extra = set(c) - set(CARD_FIELDS)
        if extra:
            problems.append(f"card[{i}] 허용 밖 필드: {sorted(extra)}")
        for k in FORBIDDEN_KEYS:
            if k in c:
                problems.append(f"card[{i}] 금지 키 존재: {k}")

    blob = json.dumps(cards, ensure_ascii=False)
    for token in ("retain", "deprioritize", "off_topic", "human_signal", "animal_term_present",
                  "design_signal", "insufficient_abstract", "label_source", "reason_codes"):
        # 초록 본문에 우연히 등장할 수 있는 일반 단어는 제외하고, v4.0 전용 코드만 검사한다.
        if token in ("retain", "deprioritize"):
            continue
        if f'"{token}"' in blob:
            problems.append(f"카드 직렬화에 v4.0 사유코드 문자열 등장: {token}")

    # 판정 값이 카드 어느 필드에도 들어가 있지 않은지 키 단위로 재확인
    for i, c in enumerate(cards):
        v4 = final[(c["question_id"], c["record_id"])]
        for field in ("title", "abstract", "publication_types", "mesh_terms"):
            val = c[field]
            if val == v4["decision"] or val == v4["label_source"]:
                problems.append(f"card[{i}].{field} 가 v4.0 판정값과 동일")

    return {
        "checked_cards": len(cards),
        "allowed_fields": list(CARD_FIELDS),
        "forbidden_keys_absent": not any("금지 키" in p for p in problems),
        "passed": not problems,
        "problems": problems,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    final = load_final_labels()
    dist = Counter(v["decision"] for v in final.values())
    src = Counter(v["label_source"] for v in final.values())
    print(f"최종 라벨 {len(final)}행  {dict(dist)}  label_source={dict(src)}")
    expected = {"retain": 3374, "deprioritize": 44597, "uncertain": 60}
    if dict(dist) != expected or len(final) != 48031 or src["adjudication"] != 616:
        raise RuntimeError("원장 수치와 불일치 — 중단")
    print("원장 대조 통과 (48,031 / 3,374 / 44,597 / 60 / 재판정 616)")

    selected, design = build_sample(final)
    print(f"\n표본 {len(selected)}건, 층 {len(design['strata'])}개")
    for sid, s in design["strata"].items():
        print(f"  {sid:44} N={s['population_N']:>6} n={s['sample_n']:>4} w={s['weight']:>8.2f}"
              f"{'  (전수)' if s['census'] else ''}")

    cards, stats = build_cards(selected)
    print(f"\n카드 {stats['cards']}건  MeSH 해결 {stats['mesh_resolved']}  MeSH 없음 {stats['mesh_absent']}"
          f"  초록 없음 {stats['abstract_absent']}")

    check = leak_check(cards, final)
    print(f"\n누출 검사: {'통과' if check['passed'] else '실패'}")
    for p in check["problems"][:10]:
        print("  !", p)
    if not check["passed"]:
        raise RuntimeError("맹검 카드 누출 검사 실패 — 채점 시작 불가")

    cards_path = OUT / "blinded_cards.json"
    payload = json.dumps(cards, ensure_ascii=False, indent=2)
    cards_path.write_text(payload, encoding="utf-8")
    cards_sha = sha256_bytes(payload.encode("utf-8"))

    # 정답(v4.0 최종 라벨)은 별도 파일로 봉인하고 채점 중에는 열지 않는다.
    truth = {f"{q}|{r}": final[(q, r)] for q, r in
             ((c["question_id"], c["record_id"]) for c in cards)}
    truth_payload = json.dumps(truth, ensure_ascii=False, indent=2, sort_keys=True)
    truth_path = OUT / "v40_truth_sealed.json"
    truth_path.write_text(truth_payload, encoding="utf-8")

    manifest = {
        "schema_version": "1.0.0",
        "track": "v4.0",
        "arm": "screening_ai_reference_v40",
        "scorer": "claude_opus_5_single_scorer_no_subagents",
        "local_language_model_used": False,
        "external_llm_api_used": False,
        "independent_blinding": False,
        "independent_blinding_ai": True,
        "release_ready": False,
        "human_reference_rows": 0,
        "design": design,
        "card_stats": stats,
        "blinding_check": check,
        "artifacts": {
            "blinded_cards": {"path": str(cards_path.relative_to(ROOT)).replace("\\", "/"),
                              "sha256": cards_sha, "count": len(cards)},
            "v40_truth_sealed": {"path": str(truth_path.relative_to(ROOT)).replace("\\", "/"),
                                 "sha256": sha256_bytes(truth_payload.encode("utf-8")),
                                 "note": "채점 라벨 잠금 이후에만 열람한다"},
        },
        "source_hashes": {
            "evidence_map.csv": sha256_file(CORPUS),
            "semantic_adjudications.json": sha256_file(BASE / "semantic_adjudications.json"),
            "agent_screen_worker.py": sha256_file(ROOT / "tools" / "v40" / "agent_screen_worker.py"),
        },
    }
    mpath = OUT / "manifest.json"
    mpath.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n카드     {cards_path.relative_to(ROOT)}  sha256={cards_sha[:16]}...")
    print(f"봉인정답 {truth_path.relative_to(ROOT)}")
    print(f"매니페스트 {mpath.relative_to(ROOT)}")
    print("\n층별 카드 수:")
    by = Counter(r["stratum_id"] for r in selected)
    for sid in design["strata"]:
        print(f"  {sid:44} {by[sid]}")


if __name__ == "__main__":
    main()
