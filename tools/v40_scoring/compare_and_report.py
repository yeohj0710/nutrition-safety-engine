#!/usr/bin/env python3
"""잠긴 채점 라벨을 AI 참조표준과 대조해 층화 가중 지표를 산출한다.

사람 gold standard는 없다. 모든 지표 이름에 비교 상대를 명시한다
(`_vs_ai_reference`). 맨 sensitivity/specificity/accuracy/gold_standard/validated
는 쓰지 않는다.

두 방향을 구분해 보고한다.
  - 채점자를 지표검사, AI 참조표준을 비교 상대로 둔 값: `*_vs_ai_reference`
  - AI 참조표준을 지표검사, 채점자를 비교 상대로 둔 값: `*_of_ai_reference_vs_scorer`
    (로건-글래든 보정에 필요하다.)

이진화: 양성 = retain, 음성 = deprioritize ∪ uncertain.
층화 가중: 표본 층은 w_h = N_h / n_h, 전수 층은 w_h = 1(표집오차 0).
"""

from __future__ import annotations

import hashlib
import json
import math
import random
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARM = ROOT / "research" / "validation" / "screening_ai_reference_v40"

LOCKED = ARM / "scored_labels_locked.json"
RECEIPT = ARM / "lock_receipt.json"
TRUTH = ARM / "v40_truth_sealed.json"
MANIFEST = ARM / "manifest.json"
CARDS = ARM / "blinded_cards.json"

OUT_SYNTHESIS = ROOT / "research" / "synthesis" / "screener_vs_ai_reference_v40.json"
OUT_REPORT = ROOT / "research" / "logs" / "v40_scoring_report.json"

BOOTSTRAP_DRAWS = 10_000
SEED = "20260729"

# 원본 선별 결과(전수). research/logs/v40_run_report.json 및 AGENTS.md 기재값.
AI_REFERENCE_POPULATION = {
    "retain": 3374,
    "deprioritize": 44597,
    "uncertain": 60,
    "total": 48031,
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def wilson(k: int, n: int, z: float = 1.959963985) -> tuple[float, float] | None:
    """비가중 비율의 윌슨 95% 신뢰구간."""
    if n == 0:
        return None
    p = k / n
    d = 1.0 + z * z / n
    centre = (p + z * z / (2 * n)) / d
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, centre - half), min(1.0, centre + half))


def is_retain(label: str) -> bool:
    return label == "retain"


def weighted_confusion(rows, weights):
    """가중 2x2. 채점자를 지표검사, AI 참조표준을 비교 상대로 둔다."""
    tp = fp = fn = tn = 0.0
    for r in rows:
        w = weights[r["stratum_id"]]
        s, a = is_retain(r["scorer"]), is_retain(r["ai_reference"])
        if s and a:
            tp += w
        elif s and not a:
            fp += w
        elif (not s) and a:
            fn += w
        else:
            tn += w
    return tp, fp, fn, tn


def metrics_from_confusion(tp, fp, fn, tn):
    """지표검사 관점(양성 = retain)."""
    n = tp + fp + fn + tn
    ref_pos = tp + fn
    ref_neg = fp + tn
    test_pos = tp + fp
    recall = tp / ref_pos if ref_pos else None
    spec = tn / ref_neg if ref_neg else None
    prec = tp / test_pos if test_pos else None
    f1 = (2 * prec * recall / (prec + recall)) if (prec and recall) else (0.0 if prec is not None and recall is not None else None)
    return {
        "n_weighted": n,
        "true_positive_weighted": tp,
        "false_positive_weighted": fp,
        "false_negative_weighted": fn,
        "true_negative_weighted": tn,
        "sensitivity_vs_ai_reference": recall,
        "specificity_vs_ai_reference": spec,
        "precision_vs_ai_reference": prec,
        "f1_vs_ai_reference": f1,
        "agreement_vs_ai_reference": (tp + tn) / n if n else None,
    }


def reverse_metrics(tp, fp, fn, tn):
    """AI 참조표준을 지표검사, 채점자를 비교 상대로 둔 값. 방향만 바꾼다."""
    # 채점자 기준 양성 = tp + fp, AI 양성 = tp + fn
    scorer_pos = tp + fp
    scorer_neg = fn + tn
    se = tp / scorer_pos if scorer_pos else None
    sp = tn / scorer_neg if scorer_neg else None
    return {
        "sensitivity_of_ai_reference_vs_scorer": se,
        "specificity_of_ai_reference_vs_scorer": sp,
    }


def weighted_retain_prevalence(rows, weights):
    num = sum(weights[r["stratum_id"]] for r in rows if is_retain(r["scorer"]))
    den = sum(weights[r["stratum_id"]] for r in rows)
    return num / den if den else None


def cohen_kappa(rows):
    """3범주 비가중 코헨 카파(retain/deprioritize/uncertain)."""
    cats = ["retain", "deprioritize", "uncertain"]
    n = len(rows)
    if n == 0:
        return None
    obs = sum(1 for r in rows if r["scorer"] == r["ai_reference"]) / n
    s = Counter(r["scorer"] for r in rows)
    a = Counter(r["ai_reference"] for r in rows)
    exp = sum((s[c] / n) * (a[c] / n) for c in cats)
    if abs(1 - exp) < 1e-12:
        return None
    return (obs - exp) / (1 - exp)


def rogan_gladen(apparent: float, se: float | None, sp: float | None):
    """AI 참조표준의 겉보기 retain 유병률을 채점자 기준으로 보정."""
    if se is None or sp is None:
        return None
    denom = se + sp - 1.0
    if abs(denom) < 1e-9:
        return None
    return (apparent + sp - 1.0) / denom


def stratified_bootstrap(rows, weights, census_ids, draws=BOOTSTRAP_DRAWS):
    """층 내 복원추출. 전수 층은 표집오차가 0이므로 고정한다."""
    by_stratum = defaultdict(list)
    for r in rows:
        by_stratum[r["stratum_id"]].append(r)

    rng = random.Random(int(SEED))
    keys = sorted(by_stratum)
    draws_out = {
        "sensitivity_vs_ai_reference": [],
        "specificity_vs_ai_reference": [],
        "precision_vs_ai_reference": [],
        "f1_vs_ai_reference": [],
        "agreement_vs_ai_reference": [],
        "scorer_retain_prevalence": [],
        "rogan_gladen_ai_reference_retain": [],
    }
    apparent = AI_REFERENCE_POPULATION["retain"] / AI_REFERENCE_POPULATION["total"]

    for _ in range(draws):
        resampled = []
        for k in keys:
            pool = by_stratum[k]
            if k in census_ids:
                resampled.extend(pool)
            else:
                resampled.extend(rng.choices(pool, k=len(pool)))
        tp, fp, fn, tn = weighted_confusion(resampled, weights)
        m = metrics_from_confusion(tp, fp, fn, tn)
        rev = reverse_metrics(tp, fp, fn, tn)
        for key in ("sensitivity_vs_ai_reference", "specificity_vs_ai_reference",
                    "precision_vs_ai_reference", "f1_vs_ai_reference",
                    "agreement_vs_ai_reference"):
            if m[key] is not None:
                draws_out[key].append(m[key])
        prev = weighted_retain_prevalence(resampled, weights)
        if prev is not None:
            draws_out["scorer_retain_prevalence"].append(prev)
        rg = rogan_gladen(apparent,
                          rev["sensitivity_of_ai_reference_vs_scorer"],
                          rev["specificity_of_ai_reference_vs_scorer"])
        if rg is not None:
            draws_out["rogan_gladen_ai_reference_retain"].append(rg)

    out = {}
    for key, vals in draws_out.items():
        if not vals:
            out[key] = None
            continue
        vals.sort()
        lo = vals[int(0.025 * (len(vals) - 1))]
        hi = vals[int(0.975 * (len(vals) - 1))]
        out[key] = {"ci95_low": lo, "ci95_high": hi, "draws_used": len(vals)}
    return out


def layer_block(rows, weights, census_ids, label, run_bootstrap):
    tp, fp, fn, tn = weighted_confusion(rows, weights)
    block = {
        "layer": label,
        "rows_scored": len(rows),
        "population_N_represented": sum(weights[r["stratum_id"]] for r in rows),
        "weighted": metrics_from_confusion(tp, fp, fn, tn),
        "reverse_direction": reverse_metrics(tp, fp, fn, tn),
        "scorer_retain_prevalence_weighted": weighted_retain_prevalence(rows, weights),
        "cohen_kappa_vs_ai_reference_unweighted": cohen_kappa(rows),
    }

    raw_agree = sum(1 for r in rows if r["scorer"] == r["ai_reference"])
    block["unweighted"] = {
        "rows": len(rows),
        "exact_label_match": raw_agree,
        "agreement_vs_ai_reference_unweighted": raw_agree / len(rows) if rows else None,
        "wilson_ci95": wilson(raw_agree, len(rows)),
    }

    block["scorer_label_counts"] = dict(Counter(r["scorer"] for r in rows))
    block["ai_reference_label_counts"] = dict(Counter(r["ai_reference"] for r in rows))
    block["disagreement_matrix"] = {
        f"{a}->{s}": c
        for (a, s), c in sorted(
            Counter((r["ai_reference"], r["scorer"]) for r in rows if r["ai_reference"] != r["scorer"]).items(),
            key=lambda kv: -kv[1],
        )
    }
    if run_bootstrap:
        block["stratified_bootstrap"] = {
            "draws": BOOTSTRAP_DRAWS,
            "census_strata_held_fixed": sorted(census_ids),
            "note": "전수 층은 표집오차가 0이므로 재추출하지 않는다.",
            "ci": stratified_bootstrap(rows, weights, census_ids),
        }
    return block


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    design = manifest["design"]
    strata = design["strata"]
    weights = {k: v["weight"] for k, v in strata.items()}
    census_ids = {k for k, v in strata.items() if v["census"]}

    locked = json.loads(LOCKED.read_text(encoding="utf-8"))
    receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))
    truth = json.loads(TRUTH.read_text(encoding="utf-8"))
    cards = json.loads(CARDS.read_text(encoding="utf-8"))

    # 블라인드 카드에는 층 정보가 없다(블라인딩 유지). 봉인 파일의 label_source와
    # 작업기 라벨로 층을 복원한다. 재판정되지 않은 행은 decision == 작업기 라벨이므로
    # 표집 당시의 층 정의와 정확히 일치한다. 복원 결과는 설계값과 대조해 검증한다.
    def reconstruct_stratum(key: str, rec: dict) -> str:
        if rec.get("label_source") == "adjudication":
            return "S4_adjudication"
        decision = rec["decision"]
        if decision == "uncertain":
            return "S3_worker_uncertain"
        question_id = key.split("|", 1)[0]
        prefix = "S1_worker_retain" if decision == "retain" else "S2_worker_deprioritize"
        return f"{prefix}|{question_id}"

    stratum_of = {key: reconstruct_stratum(key, rec) for key, rec in truth.items()}
    rebuilt = Counter(stratum_of.values())
    for sid, spec in strata.items():
        if rebuilt[sid] != spec["sample_n"]:
            raise SystemExit(f"층 복원 불일치 {sid}: 복원 {rebuilt[sid]} 설계 {spec['sample_n']}")
    if set(rebuilt) != set(strata):
        raise SystemExit(f"층 집합 불일치 {set(rebuilt) ^ set(strata)}")

    locked_rows = locked["labels"] if "labels" in locked else locked
    if set(locked_rows) != set(truth):
        raise SystemExit(f"잠긴 라벨과 봉인 파일의 키 집합 불일치 {len(set(locked_rows) ^ set(truth))}건")

    rows = []
    for key in sorted(locked_rows):
        item = locked_rows[key]
        question_id, record_id = key.split("|", 1)
        t = truth[key]
        rows.append({
            "key": key,
            "question_id": question_id,
            "record_id": record_id,
            "stratum_id": stratum_of[key],
            "scorer": item["decision"],
            "ai_reference": t["decision"],
            "ai_label_source": t.get("label_source"),
            "scorer_confidence": item.get("confidence"),
            "scorer_reason_codes": item.get("reason_codes", []),
            "ai_reason_codes": t.get("reason_codes", []),
            "evidence_basis": t.get("evidence_basis"),
        })

    assert len(rows) == design["sample_total"], f"행 수 불일치 {len(rows)}"

    worker_rows = [r for r in rows if r["stratum_id"] != "S4_adjudication"]
    adjud_rows = [r for r in rows if r["stratum_id"] == "S4_adjudication"]

    result = {
        "schema_version": "1.0.0",
        "track": manifest["track"],
        "arm": manifest["arm"],
        "scorer": manifest["scorer"],
        "reference_standard": "ai_reference_standard",
        "human_reference_rows": 0,
        "independent_blinding": False,
        "independent_blinding_ai": True,
        "release_ready": False,
        "local_language_model_used": False,
        "external_llm_api_used": False,
        "positive_class": "retain",
        "negative_class": "deprioritize | uncertain",
        "naming_rule": "모든 지표는 비교 상대를 이름에 포함한다. 사람 gold standard는 존재하지 않는다.",
        "lock": {
            "locked_at_utc": receipt.get("locked_at_utc"),
            "scored_labels_sha256": receipt.get("sha256"),
            "truth_opened_before_lock": receipt.get("truth_opened_before_lock"),
            "rows": receipt.get("rows"),
        },
        "design": {k: v for k, v in design.items() if k != "strata"},
        "strata": strata,
        "ai_reference_population": AI_REFERENCE_POPULATION,
        "layers": {
            "overall": layer_block(rows, weights, census_ids, "overall", True),
            "worker_classifier_layer": layer_block(worker_rows, weights, census_ids, "worker_classifier_layer", True),
            "agent_adjudication_layer": layer_block(adjud_rows, weights, census_ids, "agent_adjudication_layer", True),
        },
    }

    # 질문별(전체 층 합산, 가중)
    per_q = {}
    for q in sorted({r["question_id"] for r in rows}):
        qr = [r for r in rows if r["question_id"] == q]
        tp, fp, fn, tn = weighted_confusion(qr, weights)
        raw = sum(1 for r in qr if r["scorer"] == r["ai_reference"])
        per_q[q] = {
            "rows_scored": len(qr),
            "weighted": metrics_from_confusion(tp, fp, fn, tn),
            "agreement_vs_ai_reference_unweighted": raw / len(qr),
            "wilson_ci95": wilson(raw, len(qr)),
            "cohen_kappa_vs_ai_reference_unweighted": cohen_kappa(qr),
        }
    result["per_question"] = per_q

    # 로건-글래든: AI 참조표준의 겉보기 retain 유병률을 채점자 기준으로 보정
    ov = result["layers"]["overall"]
    apparent = AI_REFERENCE_POPULATION["retain"] / AI_REFERENCE_POPULATION["total"]
    rg = rogan_gladen(apparent,
                      ov["reverse_direction"]["sensitivity_of_ai_reference_vs_scorer"],
                      ov["reverse_direction"]["specificity_of_ai_reference_vs_scorer"])
    design_based = ov["scorer_retain_prevalence_weighted"]
    rg_identity_gap = None if (rg is None or design_based is None) else abs(rg - design_based)
    result["retain_prevalence_estimates"] = {
        "ai_reference_apparent_census": apparent,
        "ai_reference_apparent_census_note": "전수 라벨이므로 표집오차 없음. 측정오차는 보정되지 않은 값.",
        "scorer_design_based_weighted": design_based,
        "scorer_design_based_note": "층화 확률표본의 설계 기반 추정치. 이것이 유일한 1차 추정치다.",
        "rogan_gladen_corrected_ai_reference": rg,
        "rogan_gladen_inputs": ov["reverse_direction"],
        "rogan_gladen_identity_gap": rg_identity_gap,
        "rogan_gladen_is_tautological_here": True,
        "rogan_gladen_note": (
            "로건-글래든 보정은 이 설계에서 설계 기반 추정치와 대수적으로 동일하다. "
            "층이 AI 참조표준 라벨로 정의되어 가중 합이 전수 retain 수(3,374)를 정확히 복원하고, "
            "보정에 쓰는 Se·Sp를 같은 표본에서 추정하기 때문이다. "
            "N = P + Q(P: 채점자 양성 가중합, Q: 채점자 음성 가중합)를 대입하면 "
            "(p_app + Sp - 1)/(Se + Sp - 1) = P/N 으로 환원된다. "
            "따라서 두 값의 일치는 독립적인 교차확인이 아니라 항등식이며, "
            "외부 검증연구에서 얻은 Se·Sp를 대입할 때만 보정으로서 의미를 가진다."
        ),
        "bootstrap_ci": {
            "scorer_design_based_weighted": ov["stratified_bootstrap"]["ci"]["scorer_retain_prevalence"],
            "rogan_gladen_corrected_ai_reference": ov["stratified_bootstrap"]["ci"]["rogan_gladen_ai_reference_retain"],
        },
        "ratio_scorer_to_ai_reference": (design_based / apparent) if (design_based and apparent) else None,
    }

    result["disclosed_weaknesses"] = [
        "사람 gold standard가 0건이다. 두 판정 모두 AI가 산출한 것이므로 어느 쪽도 정답이 아니다. "
        "모든 지표는 두 AI 판정 사이의 일치·불일치를 뜻한다.",
        "채점자 블라인딩은 카드 필드 제한과 잠금 영수증으로 보장했으나 사람 블라인딩(independent_blinding)은 false다.",
        "재판정 층(S4, 616행)은 전수이므로 표집오차가 0이다. 이 층의 부트스트랩 신뢰구간은 "
        "설계상 한 점으로 수축하며, 남는 불확실성은 표집이 아니라 판단 차이다.",
        "로건-글래든 보정은 이 설계에서 항등식이라 추가 정보를 주지 않는다(위 note 참조).",
        "이진 지표는 양성 = retain, 음성 = deprioritize ∪ uncertain 으로 이진화한 값이다. "
        "uncertain 60행(표본 57행)은 초록 결측을 뜻하므로 이진화가 이 층의 의미를 압축한다.",
        "Cohen κ는 비가중값이다. 표본이 경계 사례를 의도적으로 과대표집했으므로 "
        "κ는 모집단 전체의 일치도가 아니라 이 표본에서의 일치도다.",
        "채점자 판정 근거는 초록·제목·문헌유형·MeSH뿐이다. 전문을 읽지 않았다.",
    ]

    # 불일치 목록(전량)
    disagreements = [
        {
            "question_id": r["question_id"],
            "record_id": r["record_id"],
            "stratum_id": r["stratum_id"],
            "ai_reference": r["ai_reference"],
            "ai_label_source": r["ai_label_source"],
            "scorer": r["scorer"],
            "scorer_confidence": r["scorer_confidence"],
            "evidence_basis": r["evidence_basis"],
        }
        for r in rows if r["scorer"] != r["ai_reference"]
    ]
    result["decision_disagreements"] = {
        "count": len(disagreements),
        "by_direction": {
            f"{a}->{s}": c
            for (a, s), c in sorted(
                Counter((d["ai_reference"], d["scorer"]) for d in disagreements).items(),
                key=lambda kv: -kv[1],
            )
        },
        "by_scorer_confidence": dict(Counter(d["scorer_confidence"] for d in disagreements)),
        "by_evidence_basis": dict(Counter(d["evidence_basis"] for d in disagreements)),
        "rows": disagreements,
    }

    OUT_SYNTHESIS.parent.mkdir(parents=True, exist_ok=True)
    OUT_SYNTHESIS.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    report = {
        "schema_version": "1.0.0",
        "arm": manifest["arm"],
        "scorer": manifest["scorer"],
        "rows_scored": len(rows),
        "lock": result["lock"],
        "inputs": {
            "blinded_cards_sha256": sha256_file(CARDS),
            "v40_truth_sealed_sha256": sha256_file(TRUTH),
            "manifest_sha256": sha256_file(MANIFEST),
            "scored_labels_locked_sha256": sha256_file(LOCKED),
        },
        "outputs": {
            "screener_vs_ai_reference_v40": {
                "path": "research/synthesis/screener_vs_ai_reference_v40.json",
                "sha256": None,
            }
        },
        "headline": {
            "agreement_vs_ai_reference_weighted": ov["weighted"]["agreement_vs_ai_reference"],
            "agreement_vs_ai_reference_unweighted": ov["unweighted"]["agreement_vs_ai_reference_unweighted"],
            "sensitivity_vs_ai_reference_weighted": ov["weighted"]["sensitivity_vs_ai_reference"],
            "specificity_vs_ai_reference_weighted": ov["weighted"]["specificity_vs_ai_reference"],
            "precision_vs_ai_reference_weighted": ov["weighted"]["precision_vs_ai_reference"],
            "f1_vs_ai_reference_weighted": ov["weighted"]["f1_vs_ai_reference"],
            "cohen_kappa_vs_ai_reference_unweighted": ov["cohen_kappa_vs_ai_reference_unweighted"],
            "decision_disagreements": len(disagreements),
        },
        "constraints_honoured": {
            "no_human_gold_standard": True,
            "metric_names_carry_comparator": True,
            "independent_blinding_human": False,
            "release_ready": False,
            "no_local_language_model": True,
            "no_external_llm_api": True,
            "no_subagents": True,
            "v40_run_report_untouched": True,
            "v40_agent_directory_untouched": True,
        },
    }
    OUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    OUT_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    # 산출 후 해시 채우기
    report["outputs"]["screener_vs_ai_reference_v40"]["sha256"] = sha256_file(OUT_SYNTHESIS)
    OUT_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    def pct(x):
        return "n/a" if x is None else f"{x * 100:.2f}%"

    print(f"행 {len(rows)}  잠금 {receipt.get('locked_at_utc')}")
    print()
    for name, key in (("전체", "overall"), ("작업기 층", "worker_classifier_layer"), ("재판정 층", "agent_adjudication_layer")):
        b = result["layers"][key]
        w = b["weighted"]
        print(f"[{name}] 행 {b['rows_scored']}  대표 모집단 {b['population_N_represented']:.0f}")
        print(f"  일치(가중) {pct(w['agreement_vs_ai_reference'])}   일치(비가중) {pct(b['unweighted']['agreement_vs_ai_reference_unweighted'])}")
        print(f"  sensitivity_vs_ai_reference {pct(w['sensitivity_vs_ai_reference'])}  specificity_vs_ai_reference {pct(w['specificity_vs_ai_reference'])}")
        print(f"  precision_vs_ai_reference   {pct(w['precision_vs_ai_reference'])}  f1_vs_ai_reference {pct(w['f1_vs_ai_reference'])}")
        k = b["cohen_kappa_vs_ai_reference_unweighted"]
        print(f"  Cohen κ {'n/a' if k is None else f'{k:.3f}'}")
        ci = b["stratified_bootstrap"]["ci"]["agreement_vs_ai_reference"]
        if ci:
            print(f"  일치 부트스트랩 95% CI {pct(ci['ci95_low'])} ~ {pct(ci['ci95_high'])}")
        print()

    rp = result["retain_prevalence_estimates"]
    print("retain 유병률")
    print(f"  AI 참조표준 전수 겉보기       {pct(rp['ai_reference_apparent_census'])}")
    print(f"  채점자 설계기반 가중 추정치   {pct(rp['scorer_design_based_weighted'])}")
    b1 = rp["bootstrap_ci"]["scorer_design_based_weighted"]
    if b1:
        print(f"    부트스트랩 95% CI          {pct(b1['ci95_low'])} ~ {pct(b1['ci95_high'])}")
    ratio = rp["ratio_scorer_to_ai_reference"]
    if ratio:
        print(f"    AI 참조표준 대비 배수       {ratio:.2f}배")
    print(f"  로건-글래든 보정              {pct(rp['rogan_gladen_corrected_ai_reference'])}"
          f"  <- 설계기반과 항등(차이 {rp['rogan_gladen_identity_gap']:.1e})")
    print()
    dd = result["decision_disagreements"]
    print(f"판정 불일치 {dd['count']}건  방향 {dd['by_direction']}")
    print(f"  채점자 confidence 분포 {dd['by_scorer_confidence']}")
    print()
    print("질문별 일치(비가중)")
    for q, v in per_q.items():
        kq = v["cohen_kappa_vs_ai_reference_unweighted"]
        kq_txt = "n/a" if kq is None else f"{kq:.3f}"
        print(f"  {q:24s} {pct(v['agreement_vs_ai_reference_unweighted'])}  (n={v['rows_scored']}, κ={kq_txt})")
    print()
    print(f"기록 {OUT_SYNTHESIS.relative_to(ROOT)}")
    print(f"기록 {OUT_REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
