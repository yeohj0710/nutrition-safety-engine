# 졸업논문 연구 재설계 패키지

이 패키지는 기존 산출물을 조금 다듬는 문서가 아니다. 연구 질문, 문헌검색, 선별, 원문평가, 대규모 언어모델 보조 작업, 근거 합성, 규칙 설계, 프로그램 검증, 학위논문 작성이 하나의 추적 가능한 연구 사슬을 이루도록 다시 설계한 실행 규격이다.

## 먼저 내려야 할 결론

현재 자료는 **완성된 체계적 검토나 검증 연구가 아니다.** 검색 결과 중 관련도 상위 일부만 저장했고, 제목·초록 자동분류 결과를 최종 포함 문헌처럼 보이게 사용했으며, 원문 선별과 비뚤림 위험 평가가 완료되지 않았다. 규칙 후보 중에는 아직 원문 확인이 필요하다고 표시된 항목이 있고, 앱에 표시되는 범위도 연구계획서의 범위를 넘어선다. 기존 논문은 이 미완료 상태를 결과처럼 정리한 뒤 반복 문장과 부록으로 분량을 채웠다.

따라서 다음 원칙을 적용한다.

1. 기존 자료는 `legacy_unverified` 상태로 보존하되 연구 결과로 재사용하지 않는다.
2. 서명된 연구계획서는 역사적 방향과 행정 기록으로 존중하지만, 실제 논문의 프로토콜로 자동 간주하지 않는다.
3. 먼저 연구 범위를 고정하고 프로토콜 변경 기록을 남긴다.
4. 검색 결과 수, 저장 수, 선별 수, 포함 연구 수, 근거 주장 수, 규칙 수를 서로 다른 단위로 관리한다.
5. AI는 우선순위 지정과 정보추출을 돕지만, 제외 판단이나 임상 문장 확정의 단독 결정자가 될 수 없다.
6. 앱은 검증된 규칙만 불러오고, 연구 범위 밖 기능은 별도 탐색 모드로 분리한다.
7. 논문 본문은 데이터와 분석을 고정한 뒤 작성한다. 문서 페이지 수를 완료 기준으로 삼지 않는다.

## 권장 최종 연구 제목

**고위험 임상상황에서 영양보충제 안전성 근거의 체계적 구조화와 규칙 기반 상담지원 도구 개발 및 검증: 항응고제 복용과 칼슘옥살산 신결석 위험을 중심으로**

영문 제목:

**Systematic Structuring of Dietary Supplement Safety Evidence and Development and Validation of a Rule-Based Counseling Support Tool for High-Risk Clinical Contexts: Anticoagulant Use and Calcium Oxalate Stone Risk**

## 연구의 세 구성요소

- **연구 1: 체계적 근거검토.** 다섯 개의 사전 지정 질문을 각각 검색하고, 연구 단위로 선별·추출·비뚤림 위험 평가·근거확실성 평가를 수행한다.
- **연구 2: AI 보조 절차의 성능평가.** 사람이 확정한 정답 자료와 비교하여 문헌 우선순위 지정과 정보추출의 성능, 오류, 재현성을 정량화한다.
- **연구 3: 규칙 기반 도구 개발 및 검증.** 확인된 근거 주장만 규칙으로 변환하고, 전문가가 작성한 임상 시나리오로 안전성 선별 성능과 근거 추적 가능성을 검증한다.

## Codex가 읽을 순서

1. `README_FIRST.md`
2. `MASTER_BLUEPRINT.md`
3. `00_AUDIT/current_state_audit.md`
4. `01_PROTOCOL/research_protocol_v1.md`
5. `09_CODEX/CODEX_MASTER_INSTRUCTIONS.md`
6. `TASK_BOARD.csv`
7. 해당 단계의 `09_CODEX/phase_*.md`

## 패키지의 핵심 산출물

- `MASTER_BLUEPRINT.md`: 전체 설계의 단일 기준 문서
- `09_CODEX/CODEX_MASTER_INSTRUCTIONS.md`: Codex 실행 원칙과 단계별 승인 규칙
- `01_PROTOCOL/research_protocol_v1.md`: 연구 프로토콜 초안
- `02_RETRIEVAL/search_strategy_spec.md`: 검색 재실행 규격
- `03_SCREENING/screening_manual.md`: 사람 중심 선별 매뉴얼
- `04_EXTRACTION/llm_extraction_protocol.md`: AI 정보추출 평가 절차
- `05_SYNTHESIS/rule_authoring_manual.md`: 근거에서 규칙으로 변환하는 기준
- `06_VALIDATION/validation_protocol.md`: 규칙 엔진과 사용 시나리오 검증
- `07_REPO/repo_redesign_spec.md`: 저장소 구조와 데이터 계약
- `08_THESIS/human_style_guide.md`: 사람이 쓴 학위논문 문체 기준
- `10_QA/acceptance_criteria.md`: 완료 선언 전 통과해야 할 기준

## 현재 확인한 입력 위치

- 핵심 서명본: `여형준/01 제출 문서/연구계획서_여형준_260618_서명본.pdf`
- 기존 졸업논문: `여형준/01 제출 문서/졸업논문_여형준_260618.pdf`
- 기존 근거 CSV: `여형준/02 근거 CSV/`
- 교수 피드백: `여형준/05 작업 자료/기타 메모/260406_피드백.txt`, `260413 피드백.txt`
- 구현 저장소: `https://github.com/yeohj0710/nutrition-safety-engine`
- 확인한 배포: `https://nutrition-safety-engine.vercel.app/`

## 완료의 의미

완료는 PDF 쪽수, 앱 배포, 검색 hit 수 중 어느 하나로 결정하지 않는다. 프로토콜, 원자료, 선별 결정, 원문 근거, 분석 코드, 규칙, 검증 시나리오, 논문 표와 수치가 같은 식별자와 같은 데이터 버전을 참조하고, 모든 품질 기준을 통과한 상태만 완료다.
