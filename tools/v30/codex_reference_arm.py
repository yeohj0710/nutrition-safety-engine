#!/usr/bin/env python3
"""Codex 참조표준 교차검증 arm 의 결과를 검증하고 Claude 판정과 비교한다.

이 arm 의 목적은 재검사 신뢰도가 아니라 평가자 간 일치도다. 분류기와 참조표준을
같은 주체가 수행해 생긴 독립성 한계를, 다른 모델 계열의 채점으로 측정한다.

    python tools/v30/codex_reference_arm.py verify  <responses.jsonl>
    python tools/v30/codex_reference_arm.py compare <responses.jsonl>

`verify` 는 형식과 블라인딩만 본다. `compare` 는 지표를 계산해
`research/synthesis/ai_reference_cross_check_codex.json` 에 쓴다.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from tools.v30.agent_reference_sample import (  # noqa: E402
    AXIS_VALUES,
    BASE,
    DESIGN_VALUES,
    SAMPLE_PATH,
    SYNTHESIS,
    bootstrap_ci,
    cohen_kappa,
    derive_label,
    load_blind,
    load_p2,
    load_round,
    rogan_gladen,
    sha256_file,
    weighted_rates,
    write_json,
)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARM = os.path.join(BASE, "codex_arm")
OUT = os.path.join(ROOT, "research", "synthesis", "ai_reference_cross_check_codex.json")

AXES = ("population", "intervention", "comparator", "outcome", "design")
REQUIRED_FIELDS = ("blind_id",) + AXES
# 블라인딩이 깨졌는지 보는 신호. 응답에 이 필드가 있으면 P2 정보가 흘러든 것이다.
LEAK_FIELDS = ("decision", "llm_decision", "label", "confidence", "reason_codes", "batch_id")


def load_responses(path: str) -> list[dict]:
    rows = []
    with open(path, encoding="utf-8-sig") as handle:
        for number, line in enumerate(handle, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append((number, json.loads(line)))
            except json.JSONDecodeError as error:
                raise SystemExit(f"{path}:{number} JSON 파싱 실패 — {error}") from error
    return rows


def check(path: str) -> tuple[dict[str, dict], list[str]]:
    """형식·블라인딩을 검사하고 (blind_id -> 축 판정, 오류 목록) 을 돌려준다."""
    blind_ids = {record["blind_id"] for record in load_blind()}
    rows = load_responses(path)
    errors: list[str] = []
    seen: dict[str, dict] = {}

    for number, row in rows:
        if not isinstance(row, dict):
            errors.append(f"{number}행: 객체가 아니다")
            continue
        leaked = [field for field in LEAK_FIELDS if field in row]
        if leaked:
            errors.append(f"{number}행: 블라인딩 위반 필드 {leaked}")
        extra = sorted(set(row) - set(REQUIRED_FIELDS))
        if extra:
            errors.append(f"{number}행: 허용되지 않은 필드 {extra}")
        missing = [field for field in REQUIRED_FIELDS if field not in row]
        if missing:
            errors.append(f"{number}행: 누락 필드 {missing}")
            continue
        blind_id = row["blind_id"]
        if blind_id not in blind_ids:
            errors.append(f"{number}행: 표본에 없는 blind_id {blind_id}")
        if blind_id in seen:
            errors.append(f"{number}행: blind_id {blind_id} 중복")
        for axis in ("population", "intervention", "comparator", "outcome"):
            if row[axis] not in AXIS_VALUES:
                errors.append(f"{number}행 {blind_id}: {axis} 허용값 아님 — {row[axis]!r}")
        if row["design"] not in DESIGN_VALUES:
            errors.append(f"{number}행 {blind_id}: design 허용값 아님 — {row['design']!r}")
        seen[blind_id] = {axis: row[axis] for axis in AXES}

    for blind_id in sorted(blind_ids - set(seen)):
        errors.append(f"판정 누락 blind_id {blind_id}")
    return seen, errors


def cmd_verify(args) -> int:
    seen, errors = check(args.responses)
    report = {
        "file": os.path.relpath(args.responses, ROOT).replace(os.sep, "/"),
        "sha256_lf": sha256_file(args.responses),
        "judged": len(seen),
        "expected": len(load_blind()),
        "errors": errors,
        "valid": not errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["valid"] else 1


def cmd_compare(args) -> int:
    codex_axes, errors = check(args.responses)
    if errors:
        print(json.dumps({"valid": False, "errors": errors}, ensure_ascii=False, indent=2))
        return 1

    sample = json.load(open(SAMPLE_PATH, encoding="utf-8"))
    weights = {s["stratum_id"]: s["weight"] for s in sample["strata"]}
    claude_majority = {}
    for line in open(os.path.join(BASE, "majority.jsonl"), encoding="utf-8"):
        if line.strip():
            record = json.loads(line)
            claude_majority[record["blind_id"]] = record
    # 축 단위 비교는 Claude 라운드 1을 상대로 한다. 라운드 2·3 은 라운드 1과 사실상 같아
    # 어느 것을 써도 결과가 같고, 라운드 1이 유일하게 독립적으로 생성된 판정이다.
    claude_axes = load_round(1)

    codex_labels = {bid: derive_label(axes) for bid, axes in codex_axes.items()}

    units, by_stratum = [], {}
    paired_labels_claude, paired_labels_codex = [], []
    axis_cells = axis_diffs = 0
    claude_unresolved = 0
    disagreements = []

    for row in sample["rows"]:
        blind_id = row["blind_id"]
        if blind_id not in codex_labels:
            continue
        claude_label = claude_majority[blind_id]["reference_label"]
        codex_label = codex_labels[blind_id]

        if claude_label != "unresolved":
            paired_labels_claude.append(claude_label)
            paired_labels_codex.append(codex_label)
        else:
            claude_unresolved += 1

        first_round = claude_axes.get(blind_id)
        if first_round:
            for axis in AXES:
                axis_cells += 1
                if first_round.get(axis) != codex_axes[blind_id][axis]:
                    axis_diffs += 1

        # Codex 판정을 참조로 두고 Claude 의 P2 선별을 검사 대상으로 본다.
        unit = {
            "weight": weights[row["stratum_id"]],
            "classifier_positive": row["decision"] == "retain",
            "reference_positive": codex_label == "reference_retain",
        }
        units.append(unit)
        by_stratum.setdefault(row["stratum_id"], []).append(unit)

        if claude_label != codex_label and len(disagreements) < 20:
            disagreements.append(
                {
                    "blind_id": blind_id,
                    "record_id": row["record_id"],
                    "question_id": row["question_id"],
                    "p2_decision": row["decision"],
                    "claude_reference_label": claude_label,
                    "codex_reference_label": codex_label,
                }
            )

    if not units:
        raise SystemExit("표본과 Codex 응답의 blind_id 가 하나도 겹치지 않는다.")

    agreed = sum(1 for a, b in zip(paired_labels_claude, paired_labels_codex) if a == b)
    metrics = weighted_rates(units)
    corpus_rows = load_p2()
    apparent_share = sum(1 for r in corpus_rows if r["decision"] == "retain") / len(corpus_rows)
    corrected = rogan_gladen(
        apparent_share,
        metrics["sensitivity_vs_ai_reference"],
        metrics["specificity_vs_ai_reference"],
    )
    boot = bootstrap_ci(by_stratum, apparent_share, args.iterations, args.seed)

    payload = {
        "schema_version": "1.0.0",
        "track": sample["track"],
        "arm": "codex_reference_cross_check",
        "ai_reference_standard": True,
        "reference_note": (
            "이 arm 의 참조 판정도 사람 gold standard 가 아니다. 값은 임상 정확도가 아니라 "
            "분류기와 다른 모델 계열이 채점했을 때의 ai_cross_checked 결과다."
        ),
        "inputs": {
            "codex_responses": os.path.relpath(args.responses, ROOT).replace(os.sep, "/"),
            "codex_responses_sha256_lf": sha256_file(args.responses),
            "sample": os.path.relpath(SAMPLE_PATH, ROOT).replace(os.sep, "/"),
            "claude_synthesis": os.path.relpath(SYNTHESIS, ROOT).replace(os.sep, "/"),
            "claude_synthesis_sha256_lf": sha256_file(SYNTHESIS),
            "prompt_sha256_lf": sha256_file(
                os.path.join(ARM, "input", "reference_picos_prompt.md")
            ),
        },
        "inter_rater": {
            "compared_units": len(paired_labels_claude),
            "claude_unresolved_excluded": claude_unresolved,
            "label_raw_agreement": agreed / len(paired_labels_claude)
            if paired_labels_claude
            else None,
            "label_cohen_kappa": cohen_kappa(paired_labels_claude, paired_labels_codex)
            if paired_labels_claude
            else None,
            "axis_cells_compared": axis_cells,
            "axis_cells_differing": axis_diffs,
            "axis_comparison_round": 1,
            "claude_label_distribution": dict(Counter(paired_labels_claude)),
            "codex_label_distribution": dict(Counter(paired_labels_codex)),
            "interpretation": (
                "이 κ 는 서로 다른 모델 계열의 평가자 간 일치도다. 같은 주체를 반복 실행한 "
                "재검사 일치도와 달리 독립성 근거로 인용할 수 있다. 다만 층화 표본이 Claude 의 "
                "P2 라벨을 층으로 삼아 뽑혔으므로 표집틀은 여전히 Claude 에 의존한다."
            ),
        },
        "weighted_metrics_vs_codex_reference": metrics,
        "corpus": {
            "row_count": len(corpus_rows),
            "apparent_retain_count": sum(1 for r in corpus_rows if r["decision"] == "retain"),
            "apparent_retain_share": apparent_share,
            "rogan_gladen_corrected_retain_share": corrected,
            "rogan_gladen_corrected_retain_count": corrected * len(corpus_rows),
        },
        "bootstrap": boot,
        "disagreement_examples": disagreements,
        "primary_analysis_note": (
            "주 분석이 어느 arm 인지는 숫자를 보기 전에 정해 두어야 한다. 두 추정치를 비교한 뒤 "
            "유리한 쪽을 고르면 안 된다."
        ),
    }
    write_json(OUT, payload)
    print(
        json.dumps(
            {
                "output": os.path.relpath(OUT, ROOT).replace(os.sep, "/"),
                "compared_units": payload["inter_rater"]["compared_units"],
                "label_raw_agreement": payload["inter_rater"]["label_raw_agreement"],
                "label_cohen_kappa": payload["inter_rater"]["label_cohen_kappa"],
                "axis_cells_differing": axis_diffs,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    verify = sub.add_parser("verify", help="형식과 블라인딩을 검사한다")
    verify.add_argument("responses")
    verify.set_defaults(func=cmd_verify)

    compare = sub.add_parser("compare", help="평가자 간 일치도와 보정 추정치를 계산한다")
    compare.add_argument("responses")
    compare.add_argument("--iterations", type=int, default=10000)
    compare.add_argument("--seed", type=int, default=20260727)
    compare.set_defaults(func=cmd_compare)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
