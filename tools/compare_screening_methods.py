# -*- coding: utf-8 -*-
"""자동 분류 방식 간 일치·불일치 (protocol v2.0 §9).

사람 gold 가 없으므로 민감도·특이도·정확도를 산출하지 않는다. 산출하는 것은
두 자동 방식(규칙 기반 이중 프로파일 / LLM 탐색 분류) 사이의 일치도와 교차표뿐이다.

출력  research/synthesis/screening_method_comparison.json
"""
from __future__ import annotations
import csv, hashlib, json, os, sys, io
from collections import Counter, defaultdict
from datetime import datetime, timezone

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
csv.field_size_limit(10 ** 8)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EMAP = os.path.join(ROOT, 'data', 'curated_v2', 'evidence_map.csv')
LLM = os.path.join(ROOT, 'data', 'curated_v2', 'llm_screening_classifications.csv')
OUT = os.path.join(ROOT, 'research', 'synthesis', 'screening_method_comparison.json')

# 규칙 기반 상태를 LLM 라벨 공간으로 대응시킨다. 이름만 맞추는 것이고 의미를 바꾸지 않는다.
RULE_MAP = {
    'ai_agreement_retain': 'retain',
    'ai_agreement_deprioritize': 'deprioritize',
    'ai_disagreement_uncertain': 'uncertain',
}
LABELS = ['retain', 'deprioritize', 'uncertain']


def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def kappa(pairs):
    """Cohen's κ — 두 자동 방식이 우연 이상으로 일치하는 정도."""
    n = len(pairs)
    if not n:
        return None
    agree = sum(1 for a, b in pairs if a == b)
    po = agree / n
    ca, cb = Counter(a for a, _ in pairs), Counter(b for _, b in pairs)
    pe = sum((ca[l] / n) * (cb[l] / n) for l in LABELS)
    return round((po - pe) / (1 - pe), 4) if pe != 1 else None


def main():
    llm = {}
    with open(LLM, encoding='utf-8', newline='') as f:
        for r in csv.DictReader(f):
            llm[(r['record_id'], r['question_id'])] = r['llm_decision']

    pairs, by_q, cross = [], defaultdict(list), Counter()
    rule_only = Counter()
    with open(EMAP, encoding='utf-8', newline='') as f:
        for r in csv.DictReader(f):
            k = (r['record_id'], r['question_id'])
            rl = RULE_MAP.get(r['classification'])
            if rl is None:
                rule_only[r['classification']] += 1     # 초록 없는 비-PubMed 후보
                continue
            lv = llm.get(k)
            if lv is None:
                rule_only['abstract_missing_not_sent_to_llm'] += 1
                continue
            pairs.append((rl, lv))
            by_q[r['question_id']].append((rl, lv))
            cross[(rl, lv)] += 1

    n = len(pairs)
    agree = sum(1 for a, b in pairs if a == b)

    # 규칙이 '불일치(uncertain)'로 남겨 둔 행을 LLM 이 어떻게 갈랐는지 — 이번 작업의 핵심 산출물
    unc = Counter(b for a, b in pairs if a == 'uncertain')
    unc_n = sum(unc.values())

    llm_man_path = os.path.join(ROOT, 'research', 'screening', 'llm_screening_manifest.json')
    llm_man = json.load(open(llm_man_path, encoding='utf-8')) if os.path.exists(llm_man_path) else {}
    frame = llm_man.get('frame_rows_with_abstract')
    complete = bool(llm_man.get('run_complete'))

    out = {
        'schema_version': '1.0.0',
        'protocol_reference': 'protocol-v2.0-ai-exploratory.md §9 (자동 프로필 간 일치·불일치만 보고)',
        'llm_run_complete': complete,
        'llm_coverage': llm_man.get('coverage'),
        'interpretation_warning': None if complete else (
            f'LLM 분류가 {llm_man.get("row_count", "?")}/{frame} 행에서 멈춘 부분 실행 결과다. '
            '대상 행은 record_id 순으로 처리되어 무작위 표본이 아니므로, 아래 수치를 '
            '코퍼스 전체의 일치도로 해석하면 안 된다. 전량 실행 후 재생성할 것.'),
        'not_reported': ['sensitivity', 'specificity', 'precision', 'recall', 'f1', 'accuracy'],
        'not_reported_reason': '사람 gold standard 가 없으므로 정확도 계열 지표를 산출하지 않는다.',
        'generated_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'inputs': {
            'evidence_map': {'path': 'data/curated_v2/evidence_map.csv', 'sha256': sha256(EMAP)},
            'llm_classifications': {'path': 'data/curated_v2/llm_screening_classifications.csv',
                                    'sha256': sha256(LLM)},
        },
        'compared_rows': n,
        'excluded_rows': dict(rule_only),
        'overall': {
            'observed_agreement': round(agree / n, 4) if n else None,
            'cohens_kappa': kappa(pairs),
            'rule_distribution': {l: sum(1 for a, _ in pairs if a == l) for l in LABELS},
            'llm_distribution': {l: sum(1 for _, b in pairs if b == l) for l in LABELS},
        },
        'cross_tab': {f'rule_{a}__llm_{b}': cross[(a, b)] for a in LABELS for b in LABELS},
        'rule_uncertain_resolved_by_llm': {
            'total': unc_n,
            'distribution': {l: unc[l] for l in LABELS},
            'share': {l: round(unc[l] / unc_n, 4) for l in LABELS} if unc_n else {},
        },
        'by_question': {
            q: {'rows': len(v),
                'observed_agreement': round(sum(1 for a, b in v if a == b) / len(v), 4),
                'cohens_kappa': kappa(v),
                'rule_distribution': {l: sum(1 for a, _ in v if a == l) for l in LABELS},
                'llm_distribution': {l: sum(1 for _, b in v if b == l) for l in LABELS}}
            for q, v in sorted(by_q.items())
        },
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f'비교 대상 {n:,}행')
    print(f'  단순 일치도 {out["overall"]["observed_agreement"]:.1%}   Cohen κ {out["overall"]["cohens_kappa"]}')
    print('\n  교차표 (행=규칙, 열=LLM)')
    print('           ' + ''.join(f'{l:>14s}' for l in LABELS))
    for a in LABELS:
        print(f'  {a:9s}' + ''.join(f'{cross[(a,b)]:14,}' for b in LABELS))
    print(f'\n  규칙이 판단 유보한 {unc_n:,}행을 LLM 이 나눈 결과')
    for l in LABELS:
        if unc_n:
            print(f'    {l:14s} {unc[l]:6,} ({unc[l]/unc_n:.1%})')
    print(f'\n  -> {os.path.relpath(OUT, ROOT)}')


if __name__ == '__main__':
    main()
