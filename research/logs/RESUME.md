# v3.0 자율 실행 재개 기록

갱신 시각: 2026-07-27 08:10 KST

- 현재 단계: P2 완료 — P3 신규 코퍼스 층화 AI 참조표준 채점 시작
- 완료: v2.1 동결 상태 확인; 프로토콜 v3.0과 AM-007 채택; AI가 독립적으로 5개 PICOS 질문과 PubMed 검색식을 정의; ESearch 사전 확인 2,209행; 원시 EFetch XML 13개와 체크섬 보존; `data/curated_v3/evidence_map.csv` 2,209행 생성
- 신규 코퍼스: PubMed 2,209/2,209행; 초록 보유 1,968행; 제목만 241행; 고유 `(record_id, question_id)` 2,209개; 코퍼스 SHA-256 `3142e5259bd44acec1eb270aa66f9ff4d791e8c78013525a666f65a8bdc5b4d3`
- 현재 선별: canonical 체크포인트 2,209행; 커버리지 1.0; 배치 감사 로그 23개; 분포 `deprioritize=1,548`, `retain=334`, `uncertain=327`; 체크포인트 SHA-256 `29056acd5b7f12757c013159fce71ccbf16d4c9c248f8eb79ee9bf7180c21824`
- 실행 방식: 로컬 `Qwen/Qwen2.5-3B-Instruct` 스냅샷 `aa8e72537993ba99e69dfaafa59ed015b17504d1`, CUDA, `execution_mode=agent_local`, API 키 0건, 사람 판정 0건
- 다음 명령: `python -m pytest tools/v30/test_ai_reference_v3.py -q` 후 `python tools/v30/ai_reference_v3.py sample`
- 미해결 문제: P2 판정 층별 300건 표본을 뽑고, P2 라벨을 제외한 블라인드 입력으로 PICOS 요소별 3회 독립 AI 판정을 수행해야 한다.
- 보존 중인 선행 변경: 기존 v2.1 `research/screening/llm_screening_runs.jsonl` 추가 400행과 `agent_batches/`, `agent_results/`, `agent_local_runs.jsonl`은 시작 전부터 존재했으며 수정·삭제하지 않는다.
- 명령 실패 기록: P1 질의 검증 회귀 테스트 1회 실패 후 `humans[Mesh]`를 임상 개념 MeSH로 잘못 인정한 원인을 수정했다. P2 첫 실행은 일부 모델 응답의 `confidence` 누락으로 200행 뒤 중단돼 결측값을 보수적으로 `low`로 정규화했다. 다음 실행은 긴 초록이 JSON 출력 지시를 잘라 500행 뒤 중단됐고, append-only 파일을 `research/screening/v3/aborted/20260727T1645Z/`에 보존한 뒤 고정 입력 길이를 적용해 새 실행을 시작했다. 장시간 10배치 명령은 대화 중단과 함께 Windows 코드 `1073807364`로 800행에서 종료됐으며, 100행 단위 명령으로 바꿔 1,000행까지 완료했다. 동일한 실패 원인으로 3회 반복한 명령은 없다.
