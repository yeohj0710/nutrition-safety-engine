# -*- coding: utf-8 -*-
"""검증 표본(사람 gold) 생성기.

프로토콜 v2 기준 자동 분류(deterministic_dual_profile_v1)의 성능을 재기 위한
층화 무작위 표본을 만든다. LLM 선별을 돌리기 **전에** 실행해 gold를 동결한다
(research/protocol/human_ai_role_matrix.md: "사람 gold 해시를 AI 실행 전에 고정한다").

산출물
  research/validation/screening_gold/screening_gold_blind.csv    사람이 채울 판정지 (AI 판정 가림)
  research/validation/screening_gold/screening_gold_key.csv      대조용 AI 판정 (채점 전까지 열지 않음)
  research/validation/screening_gold/screening_gold_manifest.json  시드·층·가중치·해시

사용
  python tools/screening_gold_sample.py --stats     분포만 출력
  python tools/screening_gold_sample.py             표본 생성
"""
from __future__ import annotations
import argparse, csv, hashlib, json, os, random, sys, io
from collections import Counter, defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
csv.field_size_limit(10 ** 8)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'curated_v2', 'evidence_map.csv')
CLS = os.path.join(ROOT, 'data', 'curated_v2', 'ai_screening_classifications.csv')
OUTDIR = os.path.join(ROOT, 'research', 'validation', 'screening_gold')

SEED = 20260727
QUESTIONS = ['A1', 'A2', 'B1', 'B2', 'B3']

# 층별 목표 표본 수. 불일치 버킷은 이 연구의 핵심 미지수라 비중을 높인다.
# ai_unranked_source_candidate(269건)는 전부 비-PubMed라 초록이 없어 층에서 제외하고,
# 논문에서는 '초록 미보유로 판정 불가'로 따로 보고한다.
QUOTA = {
    'ai_agreement_retain': 150,
    'ai_disagreement_uncertain': 180,
    'ai_agreement_deprioritize': 90,
}

# protocol-v2.0-ai-exploratory.md §2 의 정의를 그대로 옮긴다.
QUESTION_TEXT = {
    'A1': 'vitamin K 노출과 vitamin K antagonist 관련 문헌',
    'A2': 'omega-3 노출과 경구 항응고제 관련 문헌',
    'B1': '칼슘 보충과 칼슘옥살레이트 결석 관련 문헌',
    'B2': 'vitamin D 단독 또는 칼슘 병용과 결석 관련 문헌',
    'B3': 'vitamin C 노출과 결석 관련 문헌',
}


def load():
    """evidence_map(제목·초록)과 ai_screening_classifications(세부 판정)를 조인한다."""
    detail = {}
    with open(CLS, encoding='utf-8-sig', newline='') as f:
        for r in csv.DictReader(f):
            detail[(r['record_id'], r['question_id'])] = (
                r['sensitivity_recommendation'], r['conservative_recommendation'])
    rows = []
    with open(SRC, encoding='utf-8', newline='') as f:
        for r in csv.DictReader(f):
            sens, cons = detail.get((r['record_id'], r['question_id']), ('', ''))
            r['sensitivity_recommendation'] = sens
            r['conservative_recommendation'] = cons
            rows.append(r)
    return rows


def stats(rows):
    by_cls_abs = Counter()
    by_q_cls = Counter()
    for r in rows:
        has = bool(r['abstract'].strip())
        by_cls_abs[(r['classification'], has)] += 1
        if has:
            by_q_cls[(r['question_id'], r['classification'])] += 1

    print(f'전체 레코드-질문 행: {len(rows):,}\n')
    print('분류 x 초록 보유')
    for c in QUOTA:
        yes, no = by_cls_abs[(c, True)], by_cls_abs[(c, False)]
        tot = yes + no
        print(f'  {c:30s} 초록O {yes:6,}  초록X {no:5,}  합 {tot:6,}  ({yes/tot:.1%} 판정가능)')
    print('\n질문 x 분류 (초록 있는 것만)')
    head = '  질문   ' + ''.join(f'{c.replace("ai_", "")[:14]:>16s}' for c in QUOTA)
    print(head)
    for q in QUESTIONS:
        line = f'  {q:5s}  ' + ''.join(f'{by_q_cls[(q, c)]:16,}' for c in QUOTA)
        print(line)


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def build(rows):
    os.makedirs(OUTDIR, exist_ok=True)
    # 판정 가능한 행만 대상: 초록이 있어야 사람이 포함/제외를 정할 수 있다.
    pool = defaultdict(list)
    for r in rows:
        if r['abstract'].strip():
            pool[r['classification']].append(r)

    rng = random.Random(SEED)
    picked, strata = [], {}
    for cls, quota in QUOTA.items():
        frame = sorted(pool[cls], key=lambda r: (r['record_id'], r['question_id']))
        n = min(quota, len(frame))
        sample = rng.sample(frame, n)
        picked.extend(sample)
        strata[cls] = {
            'frame_size': len(frame),          # 초록 있는 모집단 크기
            'sampled': n,
            'weight': round(len(frame) / n, 4) if n else None,   # 재가중 계수
        }

    rng.shuffle(picked)                        # 판정 순서에서 층이 드러나지 않게 섞는다

    blind = os.path.join(OUTDIR, 'screening_gold_blind.csv')
    key = os.path.join(OUTDIR, 'screening_gold_key.csv')

    with open(blind, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['seq', 'record_id', 'question_id', 'question', 'year',
                    'title', 'abstract', 'judgement', 'reason', 'note'])
        for i, r in enumerate(picked, 1):
            w.writerow([i, r['record_id'], r['question_id'],
                        QUESTION_TEXT.get(r['question_id'], ''), r['year'],
                        r['title'], r['abstract'], '', '', ''])

    with open(key, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['record_id', 'question_id', 'classification',
                    'sensitivity_recommendation', 'conservative_recommendation'])
        for r in picked:
            w.writerow([r['record_id'], r['question_id'], r['classification'],
                        r['sensitivity_recommendation'], r['conservative_recommendation']])

    manifest = {
        'schema_version': '1.0.0',
        'purpose': 'human gold standard for measuring automated screening performance',
        'protocol_version': '2.0-ai-exploratory',
        'created_for': 'protocol amendment: AI-only screening with measured error',
        'seed': SEED,
        'sampling': 'stratified simple random, without replacement, abstract-available rows only',
        'sample_unit': 'record-question pair',
        'eligible_frame_note': '초록이 있는 행만 표본 대상. 제목만 있는 행은 별도 한계로 보고한다.',
        'total_sampled': len(picked),
        'strata': strata,
        'source_file': 'data/curated_v2/evidence_map.csv',
        'source_sha256': sha256(SRC),
        'blind_sha256': sha256(blind),
        'key_sha256': sha256(key),
        'frozen_before_llm_run': True,
    }
    mpath = os.path.join(OUTDIR, 'screening_gold_manifest.json')
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f'표본 {len(picked)}건 생성\n')
    for c, s in strata.items():
        print(f'  {c:30s} {s["sampled"]:4d} / {s["frame_size"]:6,}   가중치 {s["weight"]}')
    print(f'\n  판정지  {os.path.relpath(blind, ROOT)}')
    print(f'  정답키  {os.path.relpath(key, ROOT)}   (채점 전까지 열지 말 것)')
    print(f'  매니페스트  {os.path.relpath(mpath, ROOT)}')
    print(f'  blind sha256  {manifest["blind_sha256"][:16]}...')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--stats', action='store_true', help='분포만 출력하고 종료')
    a = ap.parse_args()
    rows = load()
    stats(rows)
    if not a.stats:
        print()
        build(rows)
