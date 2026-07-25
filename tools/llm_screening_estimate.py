# -*- coding: utf-8 -*-
"""남은 LLM 분류 분량과 예상 토큰을 계산한다.

크레딧을 얼마나 채워야 하는지 가늠하려고 만든 도구. 완료분의 실측 건당 토큰을
그대로 남은 건수에 곱한다. 단가는 계정·모델마다 달라 여기서 금액을 계산하지 않는다.
"""
import json, os, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAN = os.path.join(ROOT, 'research', 'screening', 'llm_screening_manifest.json')

m = json.load(open(MAN, encoding='utf-8'))
done, frame = m['row_count'], m['frame_rows_with_abstract']
rem = frame - done

print(f'완료   {done:>7,} / {frame:,}  ({done/frame:.1%})')
print(f'남음   {rem:>7,}')
print()

# 1순위: 체크포인트에 남은 실측 토큰. 2순위: 초기 파일럿 실측.
ck = m.get('token_usage_from_checkpoint') or {}
pin = pout = None
if ck.get('input_per_row'):
    pin, pout, src = ck['input_per_row'], ck['output_per_row'], f'체크포인트 실측 {ck["rows_with_token_data"]:,}건'
else:
    p = m.get('pilot_measurement')
    if p and p.get('rows'):
        pin, pout, src = p['input_tokens'] / p['rows'], p['output_tokens'] / p['rows'], f'파일럿 실측 {p["rows"]}건'

if pin:
    print(f'건당 평균 토큰   입력 {pin:>7.0f}   출력 {pout:>6.0f}      근거: {src}')
    print()
    print(f'남은 분량 예상   입력 {pin * rem / 1e6:>6.2f}M   출력 {pout * rem / 1e6:>6.2f}M 토큰')
    print(f'                 모델 {m.get("model")}, effort {m.get("reasoning_effort")}')
    print()
    print('단가는 계정·모델에 따라 다르므로 금액은 계산하지 않는다.')
    print('OpenAI 대시보드 요금 페이지에서 위 토큰 수로 환산할 것.')
else:
    print('토큰 실측 자료가 없어 예상치를 낼 수 없다.')

codes = (m.get('usage') or {}).get('codes')
if codes:
    print()
    print('HTTP 오류 코드:', codes)
if not m.get('run_complete'):
    print()
    print('상태  미완료 —', m.get('incomplete_reason', '').split('.')[0])
    print('재개 ', m.get('resume_command'))
