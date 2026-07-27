# -*- coding: utf-8 -*-
"""v3.0 P2 에이전트 직접 선별 — 배치 생성과 커버리지 검증 도구.

이 스크립트는 판정을 하지 않는다. 판정은 에이전트가 배치 파일을 직접 읽고 수행한다.
스크립트가 하는 일은 배치 생성, 판정 결과 수집, 커버리지 검증, 매니페스트 작성뿐이다.

사용
  python tools/v30/agent_screen_batches.py build      배치 생성
  python tools/v30/agent_screen_batches.py status     진행 상황
  python tools/v30/agent_screen_batches.py collect    판정 파일을 체크포인트에 append
  python tools/v30/agent_screen_batches.py verify     커버리지·스키마 검증
  python tools/v30/agent_screen_batches.py finalize   CSV·매니페스트 확정
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
csv.field_size_limit(10 ** 8)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CORPUS = os.path.join(ROOT, 'data', 'curated_v3', 'evidence_map.csv')
BASE = os.path.join(ROOT, 'research', 'screening', 'v30_agent')
BATCH_DIR = os.path.join(BASE, 'batches')
DEC_DIR = os.path.join(BASE, 'decisions')
PROMPT = os.path.join(BASE, 'prompts', 'screening_prompt.md')
CKPT = os.path.join(BASE, 'checkpoints.jsonl')
MANIFEST = os.path.join(BASE, 'manifest.json')
OUT_CSV = os.path.join(ROOT, 'data', 'curated_v3', 'llm_screening_classifications.csv')

TARGET_BATCH = 55
DECISIONS = ('retain', 'deprioritize', 'uncertain')
CONFIDENCES = ('high', 'medium', 'low')
REASON_CODES = ('population', 'exposure', 'outcome', 'human_signal', 'design_signal',
                'animal_term_present', 'off_topic', 'insufficient_abstract')
QUESTION_ORDER = ('HRS1_PERIOPERATIVE', 'HRS2_KIDNEY_DISEASE', 'HRS3_PREGNANCY',
                  'HRS4_LIVER_DISEASE', 'HRS5_ANTICOAGULATION')


HASH_METHOD = 'sha256_over_lf_normalized_bytes'


def sha256_file(path: str) -> str:
    """줄바꿈을 LF 로 정규화한 바이트에 대해 SHA-256 을 계산한다.

    `.gitattributes` 는 보호 대상이라 v3.0 경로를 `-text` 로 추가할 수 없고,
    저장소의 `core.autocrlf=true` 환경에서는 체크아웃 시 텍스트 파일의 LF 가
    CRLF 로 바뀐다. 원시 바이트 해시를 쓰면 같은 내용인데도 플랫폼에 따라
    해시가 달라져 감사 사슬이 끊긴다. 따라서 정규화 후 해시한다.
    """
    data = open(path, 'rb').read().replace(b'\r\n', b'\n')
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def load_corpus() -> list[dict]:
    with open(CORPUS, encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))
    rows.sort(key=lambda r: (QUESTION_ORDER.index(r['question_id']), r['record_id']))
    return rows


def split_even(items: list, target: int) -> list[list]:
    n = len(items)
    k = max(1, math.ceil(n / target))
    base, extra = divmod(n, k)
    out, i = [], 0
    for j in range(k):
        size = base + (1 if j < extra else 0)
        out.append(items[i:i + size])
        i += size
    return out


def cmd_build() -> None:
    os.makedirs(BATCH_DIR, exist_ok=True)
    os.makedirs(DEC_DIR, exist_ok=True)
    rows = load_corpus()
    by_q = defaultdict(list)
    for r in rows:
        by_q[r['question_id']].append(r)

    index, seq = [], 0
    for qid in QUESTION_ORDER:
        for chunk in split_even(by_q[qid], TARGET_BATCH):
            seq += 1
            batch_id = f'v30-agent-{seq:03d}'
            payload_rows = [{
                'record_id': r['record_id'],
                'question_id': r['question_id'],
                'title': r['title'],
                'abstract': r['abstract'],
            } for r in chunk]
            body = json.dumps(payload_rows, ensure_ascii=False, sort_keys=True)
            batch = {
                'batch_id': batch_id,
                'question_id': qid,
                'row_count': len(payload_rows),
                'input_sha256': sha256_text(body),
                'rows': payload_rows,
            }
            path = os.path.join(BATCH_DIR, batch_id + '.json')
            with open(path, 'w', encoding='utf-8', newline='\n') as fh:
                json.dump(batch, fh, ensure_ascii=False, indent=1)
                fh.write('\n')
            index.append({'batch_id': batch_id, 'question_id': qid,
                          'row_count': len(payload_rows),
                          'input_sha256': batch['input_sha256'],
                          'path': os.path.relpath(path, ROOT).replace('\\', '/'),
                          'file_sha256': sha256_file(path)})

    with open(os.path.join(BASE, 'batch_index.json'), 'w', encoding='utf-8', newline='\n') as fh:
        json.dump({'corpus': 'data/curated_v3/evidence_map.csv',
                   'corpus_sha256': sha256_file(CORPUS),
                   'prompt_path': 'research/screening/v30_agent/prompts/screening_prompt.md',
                   'prompt_sha256': sha256_file(PROMPT),
                   'total_rows': len(rows),
                   'batches': index}, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print(f'batches={len(index)} rows={len(rows)}')
    for it in index:
        print(f"  {it['batch_id']} {it['question_id']} {it['row_count']}")


def read_index() -> dict:
    with open(os.path.join(BASE, 'batch_index.json'), encoding='utf-8') as fh:
        return json.load(fh)


def read_checkpoints() -> list[dict]:
    if not os.path.exists(CKPT):
        return []
    out = []
    with open(CKPT, encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def cmd_status() -> None:
    idx = read_index()
    done_batches = {os.path.splitext(f)[0] for f in os.listdir(DEC_DIR) if f.endswith('.jsonl')}
    pending = [b for b in idx['batches'] if b['batch_id'] not in done_batches]
    ck = read_checkpoints()
    print(f"batches total={len(idx['batches'])} judged={len(done_batches)} pending={len(pending)}")
    print(f"checkpoint rows={len(ck)} / {idx['total_rows']}")
    for b in pending[:6]:
        print(f"  NEXT {b['batch_id']} {b['question_id']} {b['row_count']} {b['path']}")


def _validate_line(obj: dict, expect: dict) -> list[str]:
    errs = []
    if obj.get('record_id') != expect['record_id'] or obj.get('question_id') != expect['question_id']:
        errs.append(f"key mismatch {obj.get('record_id')}/{obj.get('question_id')}")
        return errs
    if obj.get('decision') not in DECISIONS:
        errs.append(f"bad decision {obj.get('decision')}")
    if obj.get('confidence') not in CONFIDENCES:
        errs.append(f"bad confidence {obj.get('confidence')}")
    rc = obj.get('reason_codes')
    if not isinstance(rc, list) or not rc or any(c not in REASON_CODES for c in rc):
        errs.append(f"bad reason_codes {rc}")
    basis = obj.get('evidence_basis')
    if basis not in ('abstract', 'title_only'):
        errs.append(f"bad evidence_basis {basis}")
    if basis != expect['expected_basis']:
        errs.append(f"evidence_basis must be {expect['expected_basis']}")
    if expect['expected_basis'] == 'title_only':
        if obj.get('confidence') != 'low':
            errs.append('title_only requires confidence=low')
        if 'insufficient_abstract' not in (rc or []):
            errs.append('title_only requires insufficient_abstract')
    if obj.get('status') != 'ok':
        errs.append(f"bad status {obj.get('status')}")
    return errs


def _expectations() -> dict:
    exp = {}
    for r in load_corpus():
        exp[(r['record_id'], r['question_id'])] = {
            'record_id': r['record_id'], 'question_id': r['question_id'],
            'expected_basis': 'abstract' if r['abstract'].strip() else 'title_only',
        }
    return exp


def cmd_collect() -> None:
    idx = read_index()
    exp = _expectations()
    existing = {(c['record_id'], c['question_id']) for c in read_checkpoints()}
    appended = 0
    problems = []
    with open(CKPT, 'a', encoding='utf-8', newline='\n') as out:
        for b in idx['batches']:
            path = os.path.join(DEC_DIR, b['batch_id'] + '.jsonl')
            if not os.path.exists(path):
                continue
            with open(path, encoding='utf-8') as fh:
                lines = [l.strip() for l in fh if l.strip()]
            for ln in lines:
                obj = json.loads(ln)
                key = (obj.get('record_id'), obj.get('question_id'))
                if key not in exp:
                    problems.append(f"{b['batch_id']} unknown key {key}")
                    continue
                errs = _validate_line(obj, exp[key])
                if errs:
                    problems.append(f"{b['batch_id']} {key}: {'; '.join(errs)}")
                    continue
                if key in existing:
                    continue
                obj['batch_id'] = b['batch_id']
                out.write(json.dumps({
                    'record_id': obj['record_id'], 'question_id': obj['question_id'],
                    'decision': obj['decision'], 'reason_codes': obj['reason_codes'],
                    'confidence': obj['confidence'], 'evidence_basis': obj['evidence_basis'],
                    'status': obj['status'], 'batch_id': b['batch_id'],
                }, ensure_ascii=False, sort_keys=True) + '\n')
                existing.add(key)
                appended += 1
    print(f'appended={appended} total={len(existing)}/{len(exp)}')
    if problems:
        print(f'PROBLEMS={len(problems)}')
        for p in problems[:40]:
            print('  ' + p)
        sys.exit(1)


def cmd_verify() -> None:
    exp = _expectations()
    ck = read_checkpoints()
    seen = Counter((c['record_id'], c['question_id']) for c in ck)
    dupes = [k for k, v in seen.items() if v > 1]
    missing = [k for k in exp if k not in seen]
    print(f'expected={len(exp)} checkpoint_rows={len(ck)} unique={len(seen)}')
    print(f'duplicates={len(dupes)} missing={len(missing)}')
    if missing:
        by_batch = Counter()
        idx = read_index()
        loc = {}
        for b in idx['batches']:
            with open(os.path.join(BATCH_DIR, b['batch_id'] + '.json'), encoding='utf-8') as fh:
                for r in json.load(fh)['rows']:
                    loc[(r['record_id'], r['question_id'])] = b['batch_id']
        for k in missing:
            by_batch[loc.get(k, '?')] += 1
        for bid, n in sorted(by_batch.items()):
            print(f'  MISSING {bid}: {n}')
        sys.exit(1)
    if dupes:
        sys.exit(1)
    print('coverage=1.0 OK')


def cmd_finalize() -> None:
    exp = _expectations()
    ck = read_checkpoints()
    assert len(ck) == len(exp), f'coverage incomplete {len(ck)}/{len(exp)}'
    ck.sort(key=lambda c: (QUESTION_ORDER.index(c['question_id']), c['record_id']))

    with open(OUT_CSV, 'w', encoding='utf-8', newline='') as fh:
        w = csv.writer(fh, lineterminator='\n')
        w.writerow(['record_id', 'question_id', 'decision', 'reason_codes',
                    'confidence', 'evidence_basis', 'status'])
        for c in ck:
            w.writerow([c['record_id'], c['question_id'], c['decision'],
                        '|'.join(c['reason_codes']), c['confidence'],
                        c['evidence_basis'], c['status']])

    idx = read_index()
    dist = Counter(c['decision'] for c in ck)
    by_basis = defaultdict(Counter)
    for c in ck:
        by_basis[c['evidence_basis']][c['decision']] += 1
    by_q = defaultdict(Counter)
    for c in ck:
        by_q[c['question_id']][c['decision']] += 1
    conf = Counter(c['confidence'] for c in ck)
    codes = Counter()
    for c in ck:
        codes.update(c['reason_codes'])

    manifest = {
        'schema_version': '1.0.0',
        'track': 'v3.0_full_ai_autonomy',
        'generated_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'screener': 'agent_direct',
        'execution_mode': 'agent_direct',
        'hash_method': HASH_METHOD,
        'model_invocations': 0,
        'external_api_calls': 0,
        'human_decisions': 0,
        'prompt_path': 'research/screening/v30_agent/prompts/screening_prompt.md',
        'prompt_sha256': sha256_file(PROMPT),
        'input_path': 'data/curated_v3/evidence_map.csv',
        'input_sha256': sha256_file(CORPUS),
        'checkpoint_path': 'research/screening/v30_agent/checkpoints.jsonl',
        'checkpoint_sha256': sha256_file(CKPT),
        'output_path': 'data/curated_v3/llm_screening_classifications.csv',
        'output_sha256': sha256_file(OUT_CSV),
        'row_count': len(exp),
        'classified': len(ck),
        'coverage': round(len(ck) / len(exp), 6),
        'run_complete': len(ck) == len(exp),
        'distribution': dict(sorted(dist.items())),
        'distribution_by_question': {q: dict(sorted(v.items())) for q, v in sorted(by_q.items())},
        'by_evidence_basis': {
            b: {'rows': sum(v.values()), 'distribution': dict(sorted(v.items()))}
            for b, v in sorted(by_basis.items())},
        'confidence_distribution': dict(sorted(conf.items())),
        'reason_code_counts': dict(sorted(codes.items())),
        'batches': [{'batch_id': b['batch_id'], 'question_id': b['question_id'],
                     'row_count': b['row_count'], 'input_sha256': b['input_sha256'],
                     'file_sha256': b['file_sha256'],
                     'decisions_sha256': sha256_file(os.path.join(DEC_DIR, b['batch_id'] + '.jsonl'))}
                    for b in idx['batches']],
    }
    with open(MANIFEST, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print(json.dumps({k: manifest[k] for k in
                      ('coverage', 'run_complete', 'distribution', 'by_evidence_basis',
                       'output_sha256', 'checkpoint_sha256')},
                     ensure_ascii=False, indent=1))


def cmd_view() -> None:
    """배치를 에이전트가 읽기 좋은 압축 형태로 출력한다. 내용은 배치 JSON 과 동일하다."""
    for batch_id in sys.argv[2:]:
        with open(os.path.join(BATCH_DIR, batch_id + '.json'), encoding='utf-8') as fh:
            batch = json.load(fh)
        print(f"## {batch['batch_id']}  {batch['question_id']}  n={batch['row_count']}")
        for i, r in enumerate(batch['rows'], 1):
            abstract = ' '.join(r['abstract'].split()) or '(초록 없음 — title_only)'
            print(f"[{i}] {r['record_id']}")
            print(f"T {' '.join(r['title'].split())}")
            print(f"A {abstract}")
        print()


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    {'build': cmd_build, 'status': cmd_status, 'collect': cmd_collect,
     'verify': cmd_verify, 'finalize': cmd_finalize, 'view': cmd_view}[cmd]()


if __name__ == '__main__':
    main()
