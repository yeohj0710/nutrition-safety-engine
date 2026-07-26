# v3.0 자율 실행 재개 기록

갱신 시각: 2026-07-27 01:37 KST

- 현재 단계: P1 완료 — P2 신규 v3.0 코퍼스 100% AI 선별 시작
- 완료: v2.1 동결 상태 확인; 프로토콜 v3.0과 AM-007 채택; AI가 독립적으로 5개 PICOS 질문과 PubMed 검색식을 정의; ESearch 사전 확인 2,209행; 원시 EFetch XML 13개와 체크섬 보존; `data/curated_v3/evidence_map.csv` 2,209행 생성
- 신규 코퍼스: PubMed 2,209/2,209행; 초록 보유 1,968행; 제목만 241행; 고유 `(record_id, question_id)` 2,209개; 코퍼스 SHA-256 `3142e5259bd44acec1eb270aa66f9ff4d791e8c78013525a666f65a8bdc5b4d3`
- 다음 명령: `python -m pytest tools/v30/test_screen_v3.py -q` 후 `python tools/v30/screen_v3.py run`
- 미해결 문제: 선별 실행 방식을 외부 API 키 없이 로컬 에이전트 판정으로 구현하고 매니페스트에 실제 모델·실행 모드를 기록해야 한다.
- 보존 중인 선행 변경: 기존 v2.1 `research/screening/llm_screening_runs.jsonl` 추가 400행과 `agent_batches/`, `agent_results/`, `agent_local_runs.jsonl`은 시작 전부터 존재했으며 수정·삭제하지 않는다.
- 명령 실패 기록: P1 질의 검증 회귀 테스트 1회 실패 후 `humans[Mesh]`를 임상 개념 MeSH로 잘못 인정한 원인을 수정했다. 동일 명령 3회 실패 없음.
