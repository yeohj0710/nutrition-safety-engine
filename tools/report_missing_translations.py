# -*- coding: utf-8 -*-
"""core evidence 중 한국어 key finding 번역이 없는 레코드를 보고한다.

LLM 게이트를 적용해 core 집합이 바뀌면 새로 들어온 레코드는 번역이 없다.
`key_finding_translations_ko.json` 은 사람이 채우는 파일이라 자동 생성되지 않고,
비어 있으면 validate_core_evidence_v3.py 가 invalid 로 떨어진다.

이 스크립트는 무엇을 채워야 하는지 목록으로 뽑아 준다.

  python tools/report_missing_translations.py            요약만
  python tools/report_missing_translations.py --emit     번역할 원문까지 JSON 으로 출력
"""
from __future__ import annotations
import argparse, csv, json, os, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
csv.field_size_limit(10 ** 8)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'research', 'systematic_review_v3')
CORE = os.path.join(D, 'core_evidence.csv')
TRANS = os.path.join(D, 'key_finding_translations_ko.json')
OUT = os.path.join(D, 'missing_translations_queue.json')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--emit', action='store_true', help='번역 대기열 JSON 파일로 저장')
    a = ap.parse_args()

    payload = json.load(open(TRANS, encoding='utf-8'))
    have = set(payload.get('translations', {}))
    have |= set(payload.get('source_overrides', {}))

    with open(CORE, encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))

    missing = [r for r in rows if r['record_id'] not in have]
    print(f'core evidence {len(rows):,}건 · 번역 보유 {len(rows) - len(missing):,}건 · '
          f'누락 {len(missing):,}건')

    if not missing:
        print('누락 없음. validate_core_evidence_v3.py 를 그대로 통과한다.')
        return 0

    by_q = {}
    for r in missing:
        by_q[r['question_id']] = by_q.get(r['question_id'], 0) + 1
    print('  질문별 누락:', ', '.join(f'{k} {v}' for k, v in sorted(by_q.items())))
    print()
    for r in missing[:10]:
        print(f'  [{r["question_id"]}] {r["record_id"]}  {r["title"][:66]}')
    if len(missing) > 10:
        print(f'  … 외 {len(missing) - 10}건')

    if a.emit:
        queue = [{'record_id': r['record_id'], 'question_id': r['question_id'],
                  'title': r['title'],
                  'source_text_en': r.get('key_finding') or r.get('outcome_evidence', ''),
                  'translation_ko': ''} for r in missing]
        with open(OUT, 'w', encoding='utf-8') as f:
            json.dump({'note': 'translation_ko 를 채운 뒤 key_finding_translations_ko.json 의 '
                               'translations 에 record_id: 번역 으로 옮긴다.',
                       'count': len(queue), 'items': queue}, f, ensure_ascii=False, indent=2)
        print()
        print('대기열 ->', os.path.relpath(OUT, ROOT))
    else:
        print()
        print('--emit 을 붙이면 번역할 원문까지 JSON 으로 뽑는다.')
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
