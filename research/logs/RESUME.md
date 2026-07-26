# v3.0 자율 실행 재개 기록

갱신 시각: 2026-07-27 08:09 KST

- 현재 단계: P2 진행 중 — 신규 v3.0 코퍼스 2,000/2,209행 로컬 AI 선별 완료
- 완료: v2.1 동결 상태 확인; 프로토콜 v3.0과 AM-007 채택; AI가 독립적으로 5개 PICOS 질문과 PubMed 검색식을 정의; ESearch 사전 확인 2,209행; 원시 EFetch XML 13개와 체크섬 보존; `data/curated_v3/evidence_map.csv` 2,209행 생성
- 신규 코퍼스: PubMed 2,209/2,209행; 초록 보유 1,968행; 제목만 241행; 고유 `(record_id, question_id)` 2,209개; 코퍼스 SHA-256 `3142e5259bd44acec1eb270aa66f9ff4d791e8c78013525a666f65a8bdc5b4d3`
- 현재 선별: canonical 체크포인트 2,000행; 커버리지 0.9053870530; 배치 감사 로그 20개; 분포 `deprioritize=1,408`, `retain=316`, `uncertain=276`; 체크포인트 SHA-256 `13c305dfc70b98dc6e4c400c678e18c6c3a146cf2d5e926f00b1f2b07449b187`
- 실행 방식: 로컬 `Qwen/Qwen2.5-3B-Instruct` 스냅샷 `aa8e72537993ba99e69dfaafa59ed015b17504d1`, CUDA, `execution_mode=agent_local`, API 키 0건, 사람 판정 0건
- 다음 명령: `$env:PYTHONIOENCODING='utf-8'; $env:TRANSFORMERS_VERBOSITY='error'; python tools/v30/screen_v3.py run --max-batches 1 --micro-batch-size 16`
- 미해결 문제: 남은 209행을 이어서 판정하고, 커버리지 1.0 검증 뒤 CSV·매니페스트를 확정해야 한다.
- 보존 중인 선행 변경: 기존 v2.1 `research/screening/llm_screening_runs.jsonl` 추가 400행과 `agent_batches/`, `agent_results/`, `agent_local_runs.jsonl`은 시작 전부터 존재했으며 수정·삭제하지 않는다.
- 명령 실패 기록: P1 질의 검증 회귀 테스트 1회 실패 후 `humans[Mesh]`를 임상 개념 MeSH로 잘못 인정한 원인을 수정했다. P2 첫 실행은 일부 모델 응답의 `confidence` 누락으로 200행 뒤 중단돼 결측값을 보수적으로 `low`로 정규화했다. 다음 실행은 긴 초록이 JSON 출력 지시를 잘라 500행 뒤 중단됐고, append-only 파일을 `research/screening/v3/aborted/20260727T1645Z/`에 보존한 뒤 고정 입력 길이를 적용해 새 실행을 시작했다. 장시간 10배치 명령은 대화 중단과 함께 Windows 코드 `1073807364`로 800행에서 종료됐으며, 100행 단위 명령으로 바꿔 1,000행까지 완료했다. 동일한 실패 원인으로 3회 반복한 명령은 없다.
