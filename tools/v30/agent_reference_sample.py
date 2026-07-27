"""P3 AI 참조표준 채점 도구 (v3.0 트랙).

이 스크립트는 판정을 대신하지 않는다. 층화 표본 추출, 블라인드 파일 생성,
라운드별 행 순서 무작위화, 축별 응답 수집·검증, 코드 규칙에 의한 종합 라벨 도출,
그리고 층화 가중 통계 계산만 담당한다. P/I/C/O/S 축 판정은 에이전트가 직접 한다.

참조표준은 사람 gold standard 가 아니라 AI 가 만든 내부 참조 판정이다.
따라서 지표 이름은 반드시 `sensitivity_vs_ai_reference`,
`specificity_vs_ai_reference`, `agreement_vs_ai_reference` 를 쓴다.

서브커맨드
    sample   층화 무작위 표본 + 블라인드 파일 + 표본 매니페스트 생성
    rounds   라운드별 행 순서 무작위화 및 판정용 뷰 렌더
    collect  라운드 응답(JSONL) 검증 후 종합 라벨 도출
    vote     3라운드 다수결(세 라벨이 모두 다르면 unresolved)
    stats    층화 가중 지표 + Rogan-Gladen 보정 + 층화 부트스트랩 CI
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import random
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CORPUS = os.path.join(ROOT, "data", "curated_v3", "evidence_map.csv")
P2_OUTPUT = os.path.join(ROOT, "data", "curated_v3", "llm_screening_classifications.csv")
BASE = os.path.join(ROOT, "research", "validation", "screening_ai_reference_v3")
BLIND_DIR = os.path.join(BASE, "blinded")
ROUND_DIR = os.path.join(BASE, "rounds")
PROMPT_PATH = os.path.join(BASE, "prompts", "reference_picos_prompt.md")
SAMPLE_PATH = os.path.join(BASE, "sample.json")
MANIFEST_PATH = os.path.join(BASE, "manifest.json")
SYNTHESIS = os.path.join(ROOT, "research", "synthesis", "screener_vs_ai_reference_v3.json")

HASH_METHOD = "sha256_over_lf_normalized_bytes"
TARGET_SAMPLE = 300
MIN_PER_STRATUM = 5
SAMPLE_SEED = 20260727
ROUND_SEEDS = {1: 20260727001, 2: 20260727002, 3: 20260727003}
ROUND_CHUNK = 50

AXIS_VALUES = {"yes", "no", "unclear"}
DESIGN_VALUES = {
    "human_clinical",      # 사람 대상 임상/역학/사례 연구
    "human_secondary",     # 사람 근거를 종합한 리뷰·지침·등록자료 분석
    "animal",              # 동물 실험 전용
    "in_vitro",            # 세포·조직·시험관·in silico 전용
    "unclear",
}


# ---------------------------------------------------------------- utilities
def sha256_file(path: str) -> str:
    """줄바꿈을 LF 로 정규화한 바이트에 대해 SHA-256 을 계산한다.

    저장소가 `core.autocrlf=true` 라 체크아웃 시 CRLF 가 섞이므로,
    P2 와 동일하게 정규화 후 해시해야 값이 재현된다.
    """
    data = open(path, "rb").read().replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def write_json(path: str, obj) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1, sort_keys=True)
        fh.write("\n")


def load_corpus():
    rows = {}
    with open(CORPUS, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            rows[(row["record_id"], row["question_id"])] = row
    return rows


def load_p2():
    rows = []
    with open(P2_OUTPUT, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            rows.append(row)
    return rows


# ------------------------------------------------------------------ sample
def allocate(sizes: dict, target: int, minimum: int) -> dict:
    """비례배분 후 최소 표본 수를 보장하고, 총합을 target 에 정확히 맞춘다."""
    total = sum(sizes.values())
    alloc = {}
    for key, size in sizes.items():
        want = int(round(target * size / total))
        alloc[key] = min(size, max(minimum, want))
    # 총합 조정: 큰 층부터 1씩 줄이거나 늘린다(층 크기 한계·최소치 준수).
    order = sorted(sizes, key=lambda k: (-sizes[k], k))
    while sum(alloc.values()) > target:
        changed = False
        for key in order:
            if sum(alloc.values()) <= target:
                break
            if alloc[key] > minimum:
                alloc[key] -= 1
                changed = True
        if not changed:
            break
    while sum(alloc.values()) < target:
        changed = False
        for key in order:
            if sum(alloc.values()) >= target:
                break
            if alloc[key] < sizes[key]:
                alloc[key] += 1
                changed = True
        if not changed:
            break
    return alloc


def cmd_sample(_args) -> int:
    corpus = load_corpus()
    p2 = load_p2()
    strata = defaultdict(list)
    for row in p2:
        strata[(row["question_id"], row["decision"])].append(row)
    sizes = {k: len(v) for k, v in strata.items()}
    alloc = allocate(sizes, TARGET_SAMPLE, MIN_PER_STRATUM)

    rng = random.Random(SAMPLE_SEED)
    sample_rows = []
    stratum_meta = []
    for key in sorted(strata):
        pool = sorted(strata[key], key=lambda r: (r["record_id"], r["question_id"]))
        n = alloc[key]
        picked = rng.sample(pool, n)
        stratum_id = f"{key[0]}::{key[1]}"
        stratum_meta.append(
            {
                "stratum_id": stratum_id,
                "question_id": key[0],
                "p2_decision": key[1],
                "frame_size": len(pool),
                "sample_size": n,
                "weight": len(pool) / n,
            }
        )
        for row in picked:
            sample_rows.append({"stratum_id": stratum_id, **row})

    sample_rows.sort(key=lambda r: (r["record_id"], r["question_id"]))
    for idx, row in enumerate(sample_rows, 1):
        row["blind_id"] = f"B{idx:04d}"

    write_json(
        SAMPLE_PATH,
        {
            "schema_version": 1,
            "track": "v3.0-ai-reference",
            "target_sample": TARGET_SAMPLE,
            "min_per_stratum": MIN_PER_STRATUM,
            "sample_seed": SAMPLE_SEED,
            "sample_size": len(sample_rows),
            "strata": stratum_meta,
            "rows": sample_rows,
        },
    )

    # 블라인드 파일: P2 라벨/confidence/reason_codes/batch_id 를 절대 넣지 않는다.
    os.makedirs(BLIND_DIR, exist_ok=True)
    blind = []
    for row in sample_rows:
        src = corpus[(row["record_id"], row["question_id"])]
        blind.append(
            {
                "blind_id": row["blind_id"],
                "question_id": row["question_id"],
                "title": src.get("title", ""),
                "abstract": src.get("abstract", "") or "",
            }
        )
    blind_path = os.path.join(BLIND_DIR, "blinded_records.jsonl")
    with open(blind_path, "w", encoding="utf-8", newline="\n") as fh:
        for rec in blind:
            fh.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")

    print(f"sample={len(sample_rows)} strata={len(stratum_meta)} blind={blind_path}")
    for meta in stratum_meta:
        print(
            f"  {meta['stratum_id']:34s} N={meta['frame_size']:4d} n={meta['sample_size']:3d}"
            f" w={meta['weight']:.3f}"
        )
    return 0


# ------------------------------------------------------------------ rounds
def load_blind():
    path = os.path.join(BLIND_DIR, "blinded_records.jsonl")
    return [json.loads(line) for line in open(path, encoding="utf-8") if line.strip()]


def cmd_rounds(args) -> int:
    blind = load_blind()
    by_id = {r["blind_id"]: r for r in blind}
    rnd = args.round
    seed = ROUND_SEEDS[rnd]
    order = [r["blind_id"] for r in blind]
    random.Random(seed).shuffle(order)

    rdir = os.path.join(ROUND_DIR, f"round{rnd}")
    os.makedirs(rdir, exist_ok=True)
    write_json(
        os.path.join(rdir, "order.json"),
        {"round": rnd, "seed": seed, "order": order, "chunk_size": ROUND_CHUNK},
    )

    view_dir = args.view_dir
    os.makedirs(view_dir, exist_ok=True)
    chunks = [order[i : i + ROUND_CHUNK] for i in range(0, len(order), ROUND_CHUNK)]
    for ci, chunk in enumerate(chunks, 1):
        lines = [f"# round{rnd} part{ci:02d} / n={len(chunk)}", ""]
        for i, bid in enumerate(chunk, 1):
            rec = by_id[bid]
            lines.append(f"[{i}] {bid} / {rec['question_id']}")
            lines.append(f"T {rec['title']}")
            lines.append(f"A {rec['abstract'] or '(none)'}")
            lines.append("")
        out = os.path.join(view_dir, f"ref-r{rnd}-p{ci:02d}.md")
        with open(out, "w", encoding="utf-8", newline="\n") as fh:
            fh.write("\n".join(lines))
        print(out, len(chunk))
    return 0


# ----------------------------------------------------------- derive labels
def derive_label(axes: dict) -> str:
    """P/I/O/S 축 값에서 종합 참조 라벨을 도출하는 명시적 규칙.

    비교군(C)은 기록만 하고 게이팅에 쓰지 않는다. 안전성 근거지도에서는
    단일군 증례·감시보고가 정당한 근거이므로 C 부재를 배제 사유로 삼지 않는다.
    """
    if axes["design"] in ("animal", "in_vitro"):
        return "reference_deprioritize"
    core = (axes["population"], axes["intervention"], axes["outcome"])
    if "no" in core:
        return "reference_deprioritize"
    if all(v == "yes" for v in core):
        return "reference_retain"
    return "reference_uncertain"


def cmd_collect(args) -> int:
    blind = {r["blind_id"] for r in load_blind()}
    rnd = args.round
    rdir = os.path.join(ROUND_DIR, f"round{rnd}")
    src_dir = os.path.join(rdir, "responses")
    rows, seen, problems = [], set(), []
    for name in sorted(os.listdir(src_dir)) if os.path.isdir(src_dir) else []:
        if not name.endswith(".jsonl"):
            continue
        for ln, line in enumerate(open(os.path.join(src_dir, name), encoding="utf-8"), 1):
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            bid = rec.get("blind_id")
            where = f"{name}:{ln} {bid}"
            if bid not in blind:
                problems.append(f"{where}: unknown blind_id")
                continue
            if bid in seen:
                problems.append(f"{where}: duplicate")
                continue
            for axis in ("population", "intervention", "comparator", "outcome"):
                if rec.get(axis) not in AXIS_VALUES:
                    problems.append(f"{where}: bad {axis}={rec.get(axis)!r}")
            if rec.get("design") not in DESIGN_VALUES:
                problems.append(f"{where}: bad design={rec.get('design')!r}")
            seen.add(bid)
            rows.append(rec)
    for problem in problems:
        print("PROBLEM", problem)
    if problems:
        return 1
    for rec in rows:
        rec["reference_label"] = derive_label(rec)
    out = os.path.join(rdir, "derived.jsonl")
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        for rec in sorted(rows, key=lambda r: r["blind_id"]):
            fh.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")
    print(f"round={rnd} collected={len(rows)}/{len(blind)} -> {out}")
    print(" ", dict(Counter(r["reference_label"] for r in rows)))
    return 0 if len(rows) == len(blind) else 1


def load_round(rnd: int) -> dict:
    path = os.path.join(ROUND_DIR, f"round{rnd}", "derived.jsonl")
    out = {}
    for line in open(path, encoding="utf-8"):
        if line.strip():
            rec = json.loads(line)
            out[rec["blind_id"]] = rec
    return out


def majority(labels):
    counts = Counter(labels)
    top, n = counts.most_common(1)[0]
    if n == 1:
        return "unresolved"
    return top


def cmd_vote(_args) -> int:
    rounds = {r: load_round(r) for r in (1, 2, 3)}
    ids = sorted(rounds[1])
    out = []
    for bid in ids:
        labels = [rounds[r][bid]["reference_label"] for r in (1, 2, 3)]
        out.append(
            {
                "blind_id": bid,
                "round_labels": labels,
                "reference_label": majority(labels),
                "unanimous": len(set(labels)) == 1,
            }
        )
    path = os.path.join(BASE, "majority.jsonl")
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        for rec in out:
            fh.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")
    dist = Counter(r["reference_label"] for r in out)
    print(f"voted={len(out)} -> {path}")
    print(" ", dict(dist))
    return 0


# ------------------------------------------------------------------- stats
def cohen_kappa(a, b):
    """두 라운드 라벨 사이의 Cohen's kappa."""
    labels = sorted(set(a) | set(b))
    n = len(a)
    obs = sum(1 for x, y in zip(a, b) if x == y) / n
    pa = Counter(a)
    pb = Counter(b)
    exp = sum((pa[l] / n) * (pb[l] / n) for l in labels)
    if exp == 1.0:
        return 1.0
    return (obs - exp) / (1 - exp)


def weighted_rates(units):
    """층화 가중 민감도/특이도/일치도.

    units: [{"weight": w, "classifier_positive": bool, "reference_positive": bool}, ...]
    단순 평균을 쓰지 않고 층 가중치 w_h = N_h / n_h 를 곱해 모집단 규모로 환산한다.
    """
    tp = fn = fp = tn = 0.0
    for u in units:
        w = u["weight"]
        if u["reference_positive"]:
            if u["classifier_positive"]:
                tp += w
            else:
                fn += w
        else:
            if u["classifier_positive"]:
                fp += w
            else:
                tn += w
    sens = tp / (tp + fn) if (tp + fn) else float("nan")
    spec = tn / (tn + fp) if (tn + fp) else float("nan")
    agree = (tp + tn) / (tp + tn + fp + fn) if units else float("nan")
    ref_prev = (tp + fn) / (tp + tn + fp + fn) if units else float("nan")
    return {
        "reference_positive_classifier_positive": tp,
        "reference_positive_classifier_negative": fn,
        "reference_negative_classifier_positive": fp,
        "reference_negative_classifier_negative": tn,
        "sensitivity_vs_ai_reference": sens,
        "specificity_vs_ai_reference": spec,
        "agreement_vs_ai_reference": agree,
        "weighted_reference_positive_share": ref_prev,
    }


def rogan_gladen(apparent, sensitivity, specificity):
    """Rogan-Gladen 보정 유병률. 분모가 0 이하이면 보정 불가."""
    denom = sensitivity + specificity - 1.0
    if denom <= 0:
        return float("nan")
    value = (apparent + specificity - 1.0) / denom
    return min(1.0, max(0.0, value))


def bootstrap_ci(units_by_stratum, apparent, iterations, seed):
    """층 안에서 복원추출하는 층화 부트스트랩. 백분위수 95% CI."""
    rng = random.Random(seed)
    sens_s, spec_s, prev_s = [], [], []
    keys = sorted(units_by_stratum)
    for _ in range(iterations):
        draw = []
        for key in keys:
            pool = units_by_stratum[key]
            draw.extend(rng.choice(pool) for _ in range(len(pool)))
        rates = weighted_rates(draw)
        sens, spec = rates["sensitivity_vs_ai_reference"], rates["specificity_vs_ai_reference"]
        sens_s.append(sens)
        spec_s.append(spec)
        prev_s.append(rogan_gladen(apparent, sens, spec))
    return {"sensitivity": sens_s, "specificity": spec_s, "corrected_prevalence": prev_s}


def percentile(values, q):
    vals = sorted(v for v in values if v == v)  # NaN 제거
    if not vals:
        return float("nan")
    pos = (len(vals) - 1) * q
    lo, hi = int(pos), min(int(pos) + 1, len(vals) - 1)
    frac = pos - lo
    return vals[lo] * (1 - frac) + vals[hi] * frac


def cmd_stats(args) -> int:
    sample = json.load(open(SAMPLE_PATH, encoding="utf-8"))
    corpus_rows = load_p2()
    weights = {s["stratum_id"]: s["weight"] for s in sample["strata"]}
    majority_rows = {}
    for line in open(os.path.join(BASE, "majority.jsonl"), encoding="utf-8"):
        if line.strip():
            rec = json.loads(line)
            majority_rows[rec["blind_id"]] = rec

    units, units_by_stratum = [], defaultdict(list)
    unresolved = 0
    examples_fp, examples_fn = [], []
    corpus = load_corpus()
    for row in sample["rows"]:
        rec = majority_rows[row["blind_id"]]
        if rec["reference_label"] == "unresolved":
            unresolved += 1
            continue
        unit = {
            "weight": weights[row["stratum_id"]],
            "classifier_positive": row["decision"] == "retain",
            "reference_positive": rec["reference_label"] == "reference_retain",
        }
        units.append(unit)
        units_by_stratum[row["stratum_id"]].append(unit)
        if unit["classifier_positive"] != unit["reference_positive"]:
            src = corpus[(row["record_id"], row["question_id"])]
            item = {
                "blind_id": row["blind_id"],
                "record_id": row["record_id"],
                "question_id": row["question_id"],
                "title": src.get("title", ""),
                "p2_decision": row["decision"],
                "reference_label": rec["reference_label"],
            }
            (examples_fp if unit["classifier_positive"] else examples_fn).append(item)

    rates = weighted_rates(units)
    apparent = sum(1 for r in corpus_rows if r["decision"] == "retain") / len(corpus_rows)
    corrected = rogan_gladen(
        apparent,
        rates["sensitivity_vs_ai_reference"],
        rates["specificity_vs_ai_reference"],
    )
    boot = bootstrap_ci(units_by_stratum, apparent, args.iterations, args.seed)

    round_labels = {r: load_round(r) for r in (1, 2, 3)}
    ids = sorted(round_labels[1])
    axis_names = ("population", "intervention", "comparator", "outcome", "design")
    pairs = {}
    identical_pairs = []
    for a, b in ((1, 2), (1, 3), (2, 3)):
        la = [round_labels[a][i]["reference_label"] for i in ids]
        lb = [round_labels[b][i]["reference_label"] for i in ids]
        axis_diffs = sum(
            1
            for i in ids
            for ax in axis_names
            if round_labels[a][i][ax] != round_labels[b][i][ax]
        )
        pairs[f"round{a}_vs_round{b}"] = {
            "raw_agreement": sum(1 for x, y in zip(la, lb) if x == y) / len(ids),
            "cohen_kappa": cohen_kappa(la, lb),
            "axis_cells_compared": len(ids) * len(axis_names),
            "axis_cells_differing": axis_diffs,
        }
        if axis_diffs == 0:
            identical_pairs.append(f"round{a}_vs_round{b}")

    out = {
        "schema_version": 1,
        "track": "v3.0-ai-reference",
        "ai_reference_standard": True,
        "reference_note": (
            "참조표준은 사람 gold standard 가 아니라 같은 에이전트가 블라인드 상태에서 "
            "P/I/C/O/S 축을 독립 채점하고 코드 규칙으로 도출한 AI 내부 참조 판정이다. "
            "따라서 아래 값은 진실 정확도가 아니라 ai_cross_checked 결과다."
        ),
        "sample": {
            "sample_size": sample["sample_size"],
            "sample_seed": sample["sample_seed"],
            "strata": sample["strata"],
            "unresolved_excluded": unresolved,
            "analysed_units": len(units),
        },
        "rounds": {
            "count": 3,
            "seeds": {str(k): v for k, v in ROUND_SEEDS.items()},
            "pairwise": pairs,
            "unanimous_share": sum(
                1 for r in majority_rows.values() if r["unanimous"]
            ) / len(majority_rows),
            "identical_round_pairs": identical_pairs,
            "agreement_interpretation": (
                "세 라운드를 모두 같은 채점자(에이전트)가 수행했으므로 이 kappa 는 서로 다른 "
                "채점자 사이의 일치도가 아니라 동일 채점자의 재검사 안정성(intra-rater)이다. "
                "축 셀이 하나도 다르지 않은 라운드 쌍은 독립 재판정이 아니라 앞 라운드를 "
                "그대로 재현한 것으로 보아야 하며, 그 쌍의 kappa 1.0 을 신뢰도 근거로 쓰면 안 된다."
            ),
        },
        "weighted_metrics": rates,
        "corpus": {
            "corpus_rows": len(corpus_rows),
            "apparent_retain_share": apparent,
            "apparent_retain_count": sum(
                1 for r in corpus_rows if r["decision"] == "retain"
            ),
            "rogan_gladen_corrected_retain_share": corrected,
            "rogan_gladen_corrected_retain_count": corrected * len(corpus_rows),
        },
        "bootstrap": {
            "iterations": args.iterations,
            "seed": args.seed,
            "method": "stratified_resampling_percentile_ci",
            "sensitivity_vs_ai_reference_ci95": [
                percentile(boot["sensitivity"], 0.025),
                percentile(boot["sensitivity"], 0.975),
            ],
            "specificity_vs_ai_reference_ci95": [
                percentile(boot["specificity"], 0.025),
                percentile(boot["specificity"], 0.975),
            ],
            "corrected_retain_share_ci95": [
                percentile(boot["corrected_prevalence"], 0.025),
                percentile(boot["corrected_prevalence"], 0.975),
            ],
            "corrected_retain_count_ci95": [
                percentile(boot["corrected_prevalence"], 0.025) * len(corpus_rows),
                percentile(boot["corrected_prevalence"], 0.975) * len(corpus_rows),
            ],
        },
        "disagreement_examples": {
            "classifier_positive_reference_negative": examples_fp[:20],
            "classifier_negative_reference_positive": examples_fn[:20],
            "counts": {
                "classifier_positive_reference_negative": len(examples_fp),
                "classifier_negative_reference_positive": len(examples_fn),
            },
        },
        "inputs": {
            "p2_output": os.path.relpath(P2_OUTPUT, ROOT).replace("\\", "/"),
            "p2_output_sha256": sha256_file(P2_OUTPUT),
            "sample": os.path.relpath(SAMPLE_PATH, ROOT).replace("\\", "/"),
            "sample_sha256": sha256_file(SAMPLE_PATH),
            "prompt": os.path.relpath(PROMPT_PATH, ROOT).replace("\\", "/"),
            "prompt_sha256": sha256_file(PROMPT_PATH),
            "hash_method": HASH_METHOD,
        },
        "execution": {
            "scorer": "agent_direct",
            "model_invocations": 0,
            "external_api_calls": 0,
            "human_decisions": 0,
        },
    }
    write_json(SYNTHESIS, out)
    write_json(
        MANIFEST_PATH,
        {
            "schema_version": 1,
            "track": "v3.0-ai-reference",
            "sample": out["sample"],
            "rounds": out["rounds"],
            "inputs": out["inputs"],
            "execution": out["execution"],
            "output": os.path.relpath(SYNTHESIS, ROOT).replace("\\", "/"),
            "output_sha256": sha256_file(SYNTHESIS),
        },
    )
    print(json.dumps({k: out[k] for k in ("weighted_metrics", "corpus")}, indent=1, ensure_ascii=False))
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("sample")
    p_rounds = sub.add_parser("rounds")
    p_rounds.add_argument("--round", type=int, required=True, choices=(1, 2, 3))
    p_rounds.add_argument("--view-dir", required=True)
    p_collect = sub.add_parser("collect")
    p_collect.add_argument("--round", type=int, required=True, choices=(1, 2, 3))
    sub.add_parser("vote")
    p_stats = sub.add_parser("stats")
    p_stats.add_argument("--iterations", type=int, default=10000)
    p_stats.add_argument("--seed", type=int, default=20260727777)
    args = parser.parse_args(argv)
    return {
        "sample": cmd_sample,
        "rounds": cmd_rounds,
        "collect": cmd_collect,
        "vote": cmd_vote,
        "stats": cmd_stats,
    }[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
