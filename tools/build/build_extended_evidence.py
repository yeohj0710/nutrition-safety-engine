# -*- coding: utf-8 -*-
"""정정한 선별 결과에서 질문별 문헌 후보 목록을 만든다.

목록은 AI 선별과 검색어 필터를 통과한 후보이며, 모든 문헌의 적합성을 개별 검증한
목록은 아니다. 핵심 문헌에는 별도의 원문·요약·번역 검토를 적용한다. 이 파일에는
조건별 부분집합이 없으며, 조건 검색 색인은 별도 빌더가 만든다.
"""
import csv, json, os, hashlib, collections

csv.field_size_limit(10**9)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'research', 'systematic_review', 'picos_extraction.csv')
CORE = os.path.join(ROOT, 'research', 'systematic_review', 'core_evidence.csv')
OUT = os.path.join(ROOT, 'research', 'systematic_review', 'extended_evidence.json')

FIELDS = ('record_id', 'question_id', 'title', 'authors', 'venue', 'year', 'doi', 'url',
          'locator', 'dose', 'outcome', 'key_finding', 'population', 'publication_types',
          'priority_score', 'source_scope')


def rows(path):
    with open(path, encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def main():
    core_ids = {(r['question_id'], r['record_id']) for r in rows(CORE)}
    by_q = collections.defaultdict(list)
    for r in rows(SRC):
        item = {k: (r.get(k) or '').strip() for k in FIELDS}
        try:
            item['year'] = int(item['year'])
        except ValueError:
            item['year'] = 0
        try:
            item['priority_score'] = float(item['priority_score'])
        except ValueError:
            item['priority_score'] = 0.0
        # 검토한 핵심 문헌의 포함 여부를 표시한다.
        item['in_core'] = (r['question_id'], r['record_id']) in core_ids
        by_q[r['question_id']].append(item)

    payload = {
        'schema_version': '1.0.0',
        'track': 'recollect-v2-posthoc-R20260905',
        'source': 'research/systematic_review/picos_extraction.csv',
        'note': (f'AI 선별과 검색어 필터를 통과한 문헌 후보 목록. 한국어 번역은 별도로 검토한 '
                 f'핵심 문헌 {len(core_ids)}건에 제공한다. 나머지 문장의 적합성을 모두 개별 검증하지 않았다.'),
        'clinical_recommendation': False,
        'decision_authority': 'none',
        'output_scope': 'evidence_linking_only',
        'questions': {},
    }
    total = 0
    for q, items in sorted(by_q.items()):
        # 우선순위 내림차순, 동점은 record_id 로 고정해 결정론을 유지한다.
        items.sort(key=lambda x: (-x['priority_score'], x['record_id']))
        payload['questions'][q] = items
        total += len(items)
    payload['total_records'] = total
    payload['per_question'] = {q: len(v) for q, v in sorted(payload['questions'].items())}

    text = json.dumps(payload, ensure_ascii=False, indent=1) + '\n'
    with open(OUT, 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    digest = hashlib.sha256(text.encode('utf-8')).hexdigest()
    print(f'extended_evidence rows={total} per_question={payload["per_question"]}')
    print(f'bytes={len(text.encode("utf-8")):,} sha256={digest}')
    print('out=' + OUT)


if __name__ == '__main__':
    main()
