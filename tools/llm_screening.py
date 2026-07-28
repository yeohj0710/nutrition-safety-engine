# -*- coding: utf-8 -*-
"""LLM 탐색 분류 (protocol v2.1).

protocol-v2.0-ai-exploratory.md 를 그대로 따른다.

  §5  결과는 사람의 include/exclude 가 아니다. retain / deprioritize / uncertain 만 쓴다.
  §7  PRISMA 최종 포함·제외 수, 임상 권고, 전문가 합의 표현을 만들지 않는다.
  §9  사람 gold 가 없으므로 민감도·특이도·F1 을 산출하지 않는다.
      보고 가능한 것은 자동 프로필 간 일치·불일치와 스키마 유효성뿐이다.
  §12 모든 숫자는 코드와 입력 해시에서 재생성한다.

입력  data/curated_v2/evidence_map.csv (초록 보유 행만)
출력  data/curated_v2/llm_screening_classifications.csv
      research/screening/llm_screening_manifest.json
      research/screening/llm_screening_runs.jsonl   (재개용 체크포인트)

사용
  python tools/llm_screening.py --limit 200      파일럿
  python tools/llm_screening.py                  전량
  python tools/llm_screening.py --finalize       체크포인트를 CSV/매니페스트로 확정
"""
from __future__ import annotations
import argparse, csv, hashlib, json, os, random, sys, io, time, threading
from collections import Counter, defaultdict
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
csv.field_size_limit(10 ** 8)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'curated_v2', 'evidence_map.csv')
OUT_CSV = os.path.join(ROOT, 'data', 'curated_v2', 'llm_screening_classifications.csv')
OUTDIR = os.path.join(ROOT, 'research', 'screening')
CKPT = os.path.join(OUTDIR, 'llm_screening_runs.jsonl')
MANIFEST = os.path.join(OUTDIR, 'llm_screening_manifest.json')
AGENT_AUDIT = os.path.join(OUTDIR, 'agent_local_runs.jsonl')

MODEL = os.environ.get('LLM_SCREENING_MODEL', 'gpt-5-mini')
EFFORT = os.environ.get('LLM_SCREENING_EFFORT', 'low')
ENDPOINT = 'https://api.openai.com/v1/responses'

# 문헌 선별은 에이전트 세션(Codex·Claude Code)이 수행한다: tools/agent_screening/.
# 이 스크립트의 API 경로는 한 번 돌면 만 건 단위로 호출하는데, OPENAI_API_KEY 는
# 운영 중인 서비스와 공유되므로 그 쿼터까지 함께 말린다. 실제로 그렇게 소진돼
# 약국 상담 앱의 AI 해석이 429 로 멈춘 적이 있다. 그래서 API 실행은 기본으로
# 닫아 두고, 사람이 비용을 감수하겠다고 명시할 때만 연다.
API_RUN_OPT_IN = 'LLM_SCREENING_ALLOW_API'
API_RUN_TOKEN = 'yes-spend-openai-credits'


def assert_api_run_allowed() -> None:
    if os.environ.get(API_RUN_OPT_IN) == API_RUN_TOKEN:
        return
    # Windows 콘솔의 stderr 는 stdout 과 코드페이지가 달라 한글이 깨진다. 읽지
    # 못하는 차단 사유는 차단하지 않은 것과 같으므로 stdout 으로 안내한다.
    print(
        'API 선별 경로가 닫혀 있습니다. 이 저장소의 문헌 선별은 에이전트 세션이 수행합니다.\n'
        '  배치 생성: python tools/agent_screening/make_batches.py --frame abstract --count 5\n'
        '  판정 적재 후 집계: python tools/llm_screening.py --finalize\n'
        f'재현 검증 등으로 반드시 API 를 써야 한다면 {API_RUN_OPT_IN}={API_RUN_TOKEN} 을\n'
        '사람이 직접 설정하고 실행하세요. 같은 키를 쓰는 운영 서비스의 쿼터가 함께 소진됩니다.'
    )
    raise SystemExit(2)

QUESTIONS = {
    'A1': 'vitamin K 노출과 vitamin K antagonist(와파린 등 비타민 K 길항 항응고제) 관련 문헌',
    'A2': 'omega-3 노출과 경구 항응고제 관련 문헌',
    'B1': '칼슘 보충과 칼슘옥살레이트 결석 관련 문헌',
    'B2': 'vitamin D 단독 또는 칼슘 병용과 결석 관련 문헌',
    'B3': 'vitamin C 노출과 결석 관련 문헌',
}

REASON_CODES = ['population', 'exposure', 'outcome', 'human_signal', 'design_signal',
                'animal_term_present', 'off_topic', 'insufficient_abstract']

SYSTEM = (
    '너는 탐색적 문헌지도(exploratory literature map)를 만드는 분류기다. '
    '체계적 문헌고찰의 최종 선별이 아니다. 어떤 문헌도 최종 제외로 판정하지 않는다.\n'
    '주어진 연구질문에 대해 이 초록이 지도에 남길 가치가 있는지만 판단한다.\n'
    '  retain        질문의 노출과 결과가 함께 다뤄질 가능성이 있어 지도에 유지한다\n'
    '  deprioritize  질문과 주제가 뚜렷이 달라 우선순위를 낮춘다\n'
    '  uncertain     초록만으로는 판단이 서지 않는다\n'
    '이 지도는 사람이 보충제를 복용하는 상황을 다룬다. 동물 전용 또는 시험관 전용 연구는 '
    'deprioritize 하고 animal_term_present 를 근거로 남긴다.\n'
    '판단 근거는 reason_codes 에서 고른다. 초록에 없는 사실을 만들지 않는다. '
    '임상 권고, 복용 지시, 용량 판단을 만들지 않는다. 확신이 없으면 uncertain 을 쓴다.'
)

SCHEMA = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'decision': {'type': 'string', 'enum': ['retain', 'deprioritize', 'uncertain']},
        'reason_codes': {'type': 'array', 'items': {'type': 'string', 'enum': REASON_CODES}},
        'confidence': {'type': 'string', 'enum': ['high', 'medium', 'low']},
    },
    'required': ['decision', 'reason_codes', 'confidence'],
}

_lock = threading.Lock()
_usage = {'input_tokens': 0, 'output_tokens': 0, 'calls': 0, 'retries': 0, 'failures': 0,
          'codes': {}}


def api_key() -> str:
    key = os.environ.get('OPENAI_API_KEY')
    if key:
        return key.strip()
    envp = os.path.join(ROOT, '.env')
    if os.path.exists(envp):
        for line in open(envp, encoding='utf-8'):
            if line.startswith('OPENAI_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    raise SystemExit('OPENAI_API_KEY 를 찾을 수 없습니다.')


KEY = None
PROMPT_SHA = hashlib.sha256(
    (SYSTEM + json.dumps(QUESTIONS, ensure_ascii=False, sort_keys=True)
     + json.dumps(SCHEMA, sort_keys=True)).encode('utf-8')).hexdigest()


def classify(row: dict) -> dict:
    qid = row['question_id']
    user = (f'연구질문 {qid}: {QUESTIONS.get(qid, qid)}\n\n'
            f'제목: {row["title"]}\n\n초록: {row["abstract"]}')
    body = json.dumps({
        'model': MODEL,
        'reasoning': {'effort': EFFORT},
        'input': [{'role': 'system', 'content': SYSTEM},
                  {'role': 'user', 'content': user}],
        'text': {'format': {'type': 'json_schema', 'name': 'exploratory_screening',
                            'strict': True, 'schema': SCHEMA}},
    }).encode('utf-8')

    delay = 3.0
    last = 'unknown'
    for attempt in range(9):
        try:
            req = urllib.request.Request(ENDPOINT, data=body, method='POST', headers={
                'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=180) as r:
                payload = json.loads(r.read().decode('utf-8'))
            text = ''
            for item in payload.get('output', []):
                for c in item.get('content', []):
                    if c.get('type') == 'output_text':
                        text += c.get('text', '')
            parsed = json.loads(text)
            u = payload.get('usage', {})
            with _lock:
                _usage['input_tokens'] += u.get('input_tokens', 0)
                _usage['output_tokens'] += u.get('output_tokens', 0)
                _usage['calls'] += 1
            return {'record_id': row['record_id'], 'question_id': qid,
                    'decision': parsed['decision'],
                    'reason_codes': '|'.join(parsed['reason_codes']),
                    'confidence': parsed['confidence'], 'status': 'ok'}
        except urllib.error.HTTPError as e:                      # 429 rate limit / 5xx
            wait = None
            try:
                ra = e.headers.get('Retry-After') if e.headers else None
                wait = float(ra) if ra else None
            except Exception:
                wait = None
            last = f'http{e.code}'
            with _lock:
                _usage['retries'] += 1
                _usage['codes'][str(e.code)] = _usage['codes'].get(str(e.code), 0) + 1
            if attempt == 8:
                break
            time.sleep((wait if wait else delay) + random.random() * 2)
            delay = min(delay * 1.7, 90)
        except Exception as e:                                   # 타임아웃 / 파싱 실패
            last = type(e).__name__
            with _lock:
                _usage['retries'] += 1
            if attempt == 8:
                break
            time.sleep(delay + random.random())
            delay = min(delay * 1.7, 90)
    with _lock:
        _usage['failures'] += 1
    return {'record_id': row['record_id'], 'question_id': qid,
            'decision': 'uncertain', 'reason_codes': 'insufficient_abstract',
            'confidence': 'low', 'status': f'error:{last}'}


def load_rows():
    rows = []
    with open(SRC, encoding='utf-8', newline='') as f:
        for r in csv.DictReader(f):
            if r['abstract'].strip() and r['question_id'] in QUESTIONS:
                rows.append({'record_id': r['record_id'], 'question_id': r['question_id'],
                             'title': r['title'], 'abstract': r['abstract']})
    rows.sort(key=lambda r: (r['record_id'], r['question_id']))
    return rows


def load_frame_metadata():
    frame = {}
    with open(SRC, encoding='utf-8-sig', newline='') as f:
        for r in csv.DictReader(f):
            if r['question_id'] not in QUESTIONS:
                continue
            key = (r['record_id'], r['question_id'])
            frame[key] = {
                'evidence_basis': 'abstract' if r['abstract'].strip() else 'title_only',
                'source': r['source'],
            }
    return frame


def load_agent_metadata():
    metadata = {}
    if not os.path.exists(AGENT_AUDIT):
        return metadata
    with open(AGENT_AUDIT, encoding='utf-8') as f:
        for line_number, line in enumerate(f, 1):
            if not line.strip():
                continue
            d = json.loads(line)
            key = (d['record_id'], d['question_id'])
            if key in metadata:
                raise SystemExit(f'agent_local 감사 로그 중복 키: {key} ({line_number}행)')
            metadata[key] = d
    return metadata


def done_keys():
    keys = set()
    if os.path.exists(CKPT):
        with open(CKPT, encoding='utf-8') as f:
            for line in f:
                try:
                    d = json.loads(line)
                    if d.get('status') == 'ok':
                        keys.add((d['record_id'], d['question_id']))
                except Exception:
                    pass
    return keys


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def finalize(incomplete_reason=None):
    frame = load_frame_metadata()
    agent_metadata = load_agent_metadata()
    seen, recs, duplicate_keys = set(), [], []
    with open(CKPT, encoding='utf-8') as f:
        for line_number, line in enumerate(f, 1):
            try:
                d = json.loads(line)
            except Exception as exc:
                raise SystemExit(f'체크포인트 {line_number}행 JSON 오류: {exc}') from exc
            required = {'record_id', 'question_id', 'decision', 'reason_codes', 'confidence', 'status'}
            if set(d) != required:
                raise SystemExit(f'체크포인트 {line_number}행 스키마 불일치: {sorted(d)}')
            k = (d['record_id'], d['question_id'])
            if k in seen:
                duplicate_keys.append(k)
                continue
            if k not in frame:
                raise SystemExit(f'입력 프레임에 없는 체크포인트 키: {k}')
            seen.add(k)
            recs.append(d)
    if duplicate_keys:
        raise SystemExit(f'체크포인트 중복 키 {len(duplicate_keys)}건: run_complete 산출 중단')
    recs.sort(key=lambda d: (d['record_id'], d['question_id']))

    os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)
    with open(OUT_CSV, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['record_id', 'question_id', 'llm_decision', 'llm_reason_codes',
                    'llm_confidence', 'llm_model', 'llm_reasoning_effort',
                    'decision_authority', 'status', 'evidence_basis', 'source',
                    'execution_mode', 'batch_id', 'batch_sha256', 'judged_at'])
        for d in recs:
            key = (d['record_id'], d['question_id'])
            meta = agent_metadata.get(key)
            execution_mode = 'agent_local' if meta else 'api_batch'
            w.writerow([d['record_id'], d['question_id'], d['decision'], d['reason_codes'],
                        d['confidence'], meta.get('model') if meta else MODEL,
                        'agent_local' if meta else EFFORT,
                        'ai_exploratory_only', d['status'], frame[key]['evidence_basis'],
                        frame[key]['source'], execution_mode,
                        meta.get('batch_id') if meta else '',
                        meta.get('batch_sha256') if meta else '',
                        meta.get('judged_at') if meta else ''])

    dist = Counter()
    by_basis = defaultdict(Counter)
    by_mode = Counter()
    tok_in = tok_out = tok_rows = 0
    for d in recs:
        key = (d['record_id'], d['question_id'])
        mode = 'agent_local' if key in agent_metadata else 'api_batch'
        dist[d['decision']] += 1
        by_basis[frame[key]['evidence_basis']][d['decision']] += 1
        by_mode[mode] += 1
        if d.get('in_tok'):
            tok_in += d['in_tok']
            tok_out += d.get('out_tok', 0)
            tok_rows += 1
    measured = {'rows_with_token_data': tok_rows, 'input_tokens': tok_in,
                'output_tokens': tok_out,
                'input_per_row': round(tok_in / tok_rows, 1) if tok_rows else None,
                'output_per_row': round(tok_out / tok_rows, 1) if tok_rows else None}
    total_frame = len(frame)
    coverage = round(len(recs) / total_frame, 6) if total_frame else None
    complete = coverage == 1.0 and seen == set(frame)
    if not complete and not incomplete_reason:
        incomplete_reason = '체크포인트에 미분류 record-question 키가 남아 있다.'
    man = {
        'schema_version': '2.0.0',
        'protocol_version': '3.0-full-ai',
        'status': ('complete_llm_exploratory_classification_no_human_authority' if complete
                   else 'partial_llm_exploratory_classification_run_incomplete'),
        'run_complete': complete,
        'coverage': coverage,
        'resume_command': None if complete else
            'python tools/agent_screening/make_batches.py --frame abstract --count 5',
        'incomplete_reason': None if complete else incomplete_reason,
        'note': 'retain/deprioritize/uncertain은 탐색지도용 AI 판정이며 사람 판정이 아니다.',
        'model': MODEL,
        'reasoning_effort': EFFORT,
        'prompt_sha256': PROMPT_SHA,
        'generated_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'frame_rows_total': total_frame,
        'frame_rows_with_abstract': sum(1 for value in frame.values()
                                        if value['evidence_basis'] == 'abstract'),
        'frame_rows_title_only': sum(1 for value in frame.values()
                                     if value['evidence_basis'] == 'title_only'),
        'row_count': len(recs),
        'classifications': dict(dist),
        'classifications_by_evidence_basis': {
            basis: dict(counts) for basis, counts in sorted(by_basis.items())
        },
        'execution_mode_distribution': dict(by_mode),
        'failures': sum(1 for d in recs if d['status'] != 'ok'),
        'usage': dict(_usage),
        'token_usage_from_checkpoint': measured,
        'pilot_measurement': {'rows': 30, 'input_tokens': 21101, 'output_tokens': 6556,
                              'note': '초기 파일럿 실측. 체크포인트에 토큰이 없는 구간의 추정 근거.'},
        'input_path': 'data/curated_v2/evidence_map.csv',
        'input_sha256': sha256(SRC),
        'output_path': 'data/curated_v2/llm_screening_classifications.csv',
        'output_sha256': sha256(OUT_CSV),
        'agent_local_audit_path': ('research/screening/agent_local_runs.jsonl'
                                   if agent_metadata else None),
        'human_screening_decisions': 0,
    }
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=2)
    print(f'\n확정 {len(recs):,}행 -> {os.path.relpath(OUT_CSV, ROOT)}')
    for k, v in sorted(dist.items(), key=lambda x: -x[1]):
        print(f'   {k:14s} {v:6,}  ({v/len(recs):.1%})')
    print(f'   실패 {man["failures"]}')
    return man


def main():
    global KEY
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0, help='파일럿 건수')
    ap.add_argument('--workers', type=int, default=10,
                    help='높이면 429 가 늘어 오히려 느려진다')
    ap.add_argument('--finalize', action='store_true', help='체크포인트만 확정')
    ap.add_argument('--incomplete-reason', help='부분 실행의 실제 중단 사유')
    a = ap.parse_args()

    os.makedirs(OUTDIR, exist_ok=True)
    rows = load_rows()
    print(f'초록 보유 대상 {len(rows):,}행')

    if a.finalize:
        finalize(a.incomplete_reason)
        return

    assert_api_run_allowed()
    KEY = api_key()
    have = done_keys()
    todo = [r for r in rows if (r['record_id'], r['question_id']) not in have]
    if a.limit:
        todo = todo[:a.limit]
    print(f'완료 {len(have):,} · 이번 실행 {len(todo):,} · 모델 {MODEL}(effort={EFFORT}) · 동시 {a.workers}\n')
    if not todo:
        finalize(a.incomplete_reason)
        return

    t0 = time.time()
    with open(CKPT, 'a', encoding='utf-8') as ck:
        with ThreadPoolExecutor(max_workers=a.workers) as ex:
            futs = {ex.submit(classify, r): r for r in todo}
            for i, fut in enumerate(as_completed(futs), 1):
                d = fut.result()
                with _lock:
                    ck.write(json.dumps(d, ensure_ascii=False) + '\n')
                    if i % 50 == 0:
                        ck.flush()
                if i % 250 == 0 or i == len(todo):
                    el = time.time() - t0
                    rate = i / el
                    eta = (len(todo) - i) / rate if rate else 0
                    print(f'  {i:6,}/{len(todo):,}  {rate:5.1f}/s  경과 {el/60:5.1f}분  '
                          f'남은 {eta/60:5.1f}분  실패 {_usage["failures"]}')
    print(f'\n입력토큰 {_usage["input_tokens"]:,} · 출력토큰 {_usage["output_tokens"]:,} '
          f'· 호출 {_usage["calls"]:,} · 재시도 {_usage["retries"]:,}')
    finalize(a.incomplete_reason)


if __name__ == '__main__':
    main()
