# -*- coding: utf-8 -*-
"""질문별 확장 근거 목록을 만든다.

왜 새 파일인가. 화면이 질문당 15건만 보여주는 것은 근거가 없어서가 아니라
`personalized_rules.json` 의 핵심근거 상한이 15이기 때문이다. 근거 후보는 이미
1,899행이 있고 전부 근거 문장·위치·URL·우선순위를 갖추고 있다.

그런데 그 상한을 올리려면 `personalized_rules.json` 을 재생성해야 하는데, 원장
`research/logs/v40_run_report.json` 이 그 파일을 포함해 297개 경로의 SHA-256 을
기록하고 있고 `finalize_run_report_v4.py` 는 커밋 후 재실행이 불가능하다.
그래서 봉인된 산출물은 건드리지 않고 별도 파일을 추가한다.

이 파일은 축(연령·병용약·용량·성별·기저질환) 부분집합을 갖지 않는다. 축 부분집합은
핵심근거 15건 위에서만 계산돼 있기 때문이다. 따라서 확장 목록은 "이 상황의 전체 근거"
이고 조건 필터가 적용되지 않는다는 점을 화면에서 밝혀야 한다.

또한 한국어 번역은 핵심근거 75건에만 있다. 확장 목록의 근거 문장은 영어 원문이다.
"""
import csv, json, os, hashlib, collections

csv.field_size_limit(10**9)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'research', 'systematic_review_v40', 'picos_extraction.csv')
CORE = os.path.join(ROOT, 'research', 'systematic_review_v40', 'core_evidence.csv')
OUT = os.path.join(ROOT, 'research', 'systematic_review_v40', 'extended_evidence_v40.json')

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
        # 핵심근거 15건은 이미 규칙 파일에 있으므로 확장 목록에서는 표시만 해 둔다.
        item['in_core'] = (r['question_id'], r['record_id']) in core_ids
        by_q[r['question_id']].append(item)

    payload = {
        'schema_version': '1.0.0',
        'track': 'v4.0',
        'source': 'research/systematic_review_v40/picos_extraction.csv',
        'note': ('핵심근거 15건 상한 밖의 근거까지 담은 확장 목록. 축 부분집합이 없어 조건 '
                 '필터가 적용되지 않으며, 근거 문장은 영어 원문이다(한국어 번역은 핵심근거 '
                 '75건에만 있다). 봉인된 산출물을 재생성하지 않기 위해 별도 파일로 둔다.'),
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
