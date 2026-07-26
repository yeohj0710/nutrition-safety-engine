# v3.0 자율 실행 재개 기록

갱신 시각: 2026-07-27 08:20 KST

- 현재 단계: P3 완료 — P4 신규 코퍼스 근거지도·개인화·사이트 연결 시작
- 완료: v2.1 동결 상태 확인; 프로토콜 v3.0과 AM-007 채택; AI가 독립적으로 5개 PICOS 질문과 PubMed 검색식을 정의; ESearch 사전 확인 2,209행; 원시 EFetch XML 13개와 체크섬 보존; `data/curated_v3/evidence_map.csv` 2,209행 생성
- 신규 코퍼스: PubMed 2,209/2,209행; 초록 보유 1,968행; 제목만 241행; 고유 `(record_id, question_id)` 2,209개; 코퍼스 SHA-256 `3142e5259bd44acec1eb270aa66f9ff4d791e8c78013525a666f65a8bdc5b4d3`
- 현재 선별: canonical 체크포인트 2,209행; 커버리지 1.0; 배치 감사 로그 23개; 분포 `deprioritize=1,548`, `retain=334`, `uncertain=327`; 체크포인트 SHA-256 `29056acd5b7f12757c013159fce71ccbf16d4c9c248f8eb79ee9bf7180c21824`
- 실행 방식: 로컬 `Qwen/Qwen2.5-3B-Instruct` 스냅샷 `aa8e72537993ba99e69dfaafa59ed015b17504d1`, CUDA, `execution_mode=agent_local`, API 키 0건, 사람 판정 0건
- AI 참조표준: P2 세 라벨 층에서 각 100건, 총 300건; 층 가중치 `deprioritize=15.48`, `retain=3.34`, `uncertain=3.27`; 3개 라운드 모두 300/300건; `unresolved=5`; 평균 라운드 간 일치도 `0.7677777778`
- 층화 지표: `sensitivity_vs_ai_reference=0.4783487784`, `specificity_vs_ai_reference=0.9233021413`, `agreement_vs_ai_reference=0.3503945628`; Rogan-Gladen 보정 retain 규모 `409.7449`, 95% CI `[139.1208, 853.4010]`; 부트스트랩 유효 반복 10,000회
- 다음 명령: 신규 v3.0 코퍼스를 입력으로 근거지도와 core evidence를 생성하도록 기존 빌더 경계를 확장하고 집중 테스트를 실행한다.
- 미해결 문제: 신규 track 전용 파생 경로, 문장 locator, `llm_gate.applied=true`, 관찰 가능한 개인화 축, 한국어 번역을 생성해야 한다.
- 보존 중인 선행 변경: 기존 v2.1 `research/screening/llm_screening_runs.jsonl` 추가 400행과 `agent_batches/`, `agent_results/`, `agent_local_runs.jsonl`은 시작 전부터 존재했으며 수정·삭제하지 않는다.
- 명령 실패 기록: P1 질의 검증 회귀 테스트 1회 실패 후 `humans[Mesh]`를 임상 개념 MeSH로 잘못 인정한 원인을 수정했다. P2 첫 실행은 일부 모델 응답의 `confidence` 누락으로 200행 뒤 중단돼 결측값을 보수적으로 `low`로 정규화했다. 다음 실행은 긴 초록이 JSON 출력 지시를 잘라 500행 뒤 중단됐고, append-only 파일을 `research/screening/v3/aborted/20260727T1645Z/`에 보존한 뒤 고정 입력 길이를 적용해 새 실행을 시작했다. 장시간 10배치 명령은 대화 중단과 함께 Windows 코드 `1073807364`로 800행에서 종료됐으며, 100행 단위 명령으로 바꿔 1,000행까지 완료했다. P3 표본 생성은 직접 실행 시 `tools` 패키지 경로 오류로 1회 중단돼 모델 캐시 탐색 함수를 P3 도구 내부로 옮겼다. 2차 판정은 모델 JSON의 허용값 따옴표 누락으로 100건 뒤 중단돼 허용값만 복구하는 파서를 추가했다. 동일한 실패 원인으로 3회 반복한 명령은 없다.
