# v3.0 자율 실행 재개 기록

갱신 시각: 2026-07-27 12:00 KST

- 현재 단계: P6 최종 검증 진행 중. P0~P5 는 모두 완료했다.
- 실행 방식: 선별·참조표준 채점·한국어 번역·논문 집필을 모두 에이전트가 직접 수행했다.
  로컬 언어모델을 로드하지 않았고 외부 LLM·번역 API 를 호출하지 않았다.
  선별 매니페스트의 `model_invocations`, `external_api_calls`, `human_decisions` 는 모두 0 이다.
- 신규 코퍼스: `data/curated_v3/evidence_map.csv` 2,209 레코드-질문 행, PubMed 단일 자료원.
  초록 보유 1,968행, 제목만 241행.
- 선별: 커버리지 1.0(2,209/2,209). 감사 로그는 `research/screening/v30_agent/`.
- AI 참조표준: 층화 표본 300건을 3회 독립 판정. 산출물
  `research/synthesis/screener_vs_ai_reference_v3.json`.
  라운드 2와 3의 축 판정이 완전히 동일하므로 그 쌍의 κ 는 재검사 신뢰도 근거로 쓰지 않는다.
- 핵심 결과: 겉보기 retain 규모가 Rogan–Gladen 보정 후 줄어든다. 점추정과 95% CI 는
  매니페스트에서 읽는다. 문서에 숫자를 하드코딩하지 않는다.
- 사이트: `tools/v30/build_site_v3.py all` 로 재생성했고 `llm_gate.applied=true` 다.
  한국어 번역 75건을 에이전트가 직접 다시 작성했다.
- 논문: `research/thesis/thesis_v30.docx` / `.pdf`. G 드라이브 정식 파일명에 반영했고
  기존 v2.1 본은 `_v21백업` 으로 보존했다.
- 발표 원고 `research/reports/발표원고_v3.0.md`, Notion 원고 `research/reports/notion_update.md`.
- Notion: 색인 페이지 하위에 `260728 연구 진행 — 완전 AI 자율 트랙 (v3.0)` 페이지를 만들고
  목록에 연결했다. 기존 문서를 덮어쓰지 않았다.
- G 드라이브: `tools/sync_gdrive_v30.py` 로 14건을 복사하고 SHA-256 을 전건 비교했다.
  결과는 `research/logs/gdrive_sync_v30.json`.
- 배포하지 않았다. `npm run build` 까지만 확인한다.
- 보존 중인 선행 변경: 시작 전부터 존재한 `research/screening/llm_screening_runs.jsonl` 추가분,
  `research/screening/agent_batches/`, `agent_results/`, `agent_local_runs.jsonl`,
  `data/curated_v2/llm_screening_classifications.csv` 는 사용자 소유이므로 수정·스테이징하지 않는다.
- 남은 unresolved 항목은 `research/logs/v30_run_report.json` 의 `unresolved` 에 있다.

## 할일

- [ ] **참조표준 교차검증 arm 실행** — 블라인드 300건 채점을 Codex 에 넘기고 결과를 받는다.
  인계 지시서 `research/validation/screening_ai_reference_v3/codex_arm/README.md`,
  받은 뒤 `python tools/v30/codex_reference_arm.py verify|compare <응답파일>`.
  실행하면 unresolved 2건(라운드 동일, 독립성 부분적)이 해소된다. Codex 에 Claude 의 P2 라벨과
  기존 라운드 응답을 절대 보여주지 말 것.
- [ ] 데모 예시 재구성 — 오메가-3·칼슘은 후보 근거가 1건뿐이라 대표 예시로 부적절하다.
  후보 근거가 많은 조합으로 교체한다(비타민 K 7건, 비타민 C 5건).
- [ ] `narrative_assessment` 의 `decision_changed` 거부 조건 검토 — 판단 보존 검사를 완화할지는
  별도 판단이 필요하다. 되돌아간 경로도 근거 기반이라 급하지 않다.
