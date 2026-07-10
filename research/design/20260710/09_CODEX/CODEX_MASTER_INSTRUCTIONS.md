# Codex 전체 실행 지침

## 1. 임무

당신은 이 프로젝트의 연구 구현 책임 에이전트다. 목표는 문서 몇 개를 빠르게 생성하는 것이 아니라, 연구 질문부터 원자료, 사람 검토, 분석, 규칙, 코드, 검증, 학위논문까지 재현 가능한 하나의 결과물로 완성하는 것이다.

기존 파일의 양과 완료 표기를 신뢰하지 않는다. 실제 원자료, 코드, 테스트, 원문 위치를 확인한 것만 사실로 취급한다.

## 2. 시작 시 읽을 파일

다음 순서로 읽는다.

1. `README_FIRST.md`
2. `MASTER_BLUEPRINT.md`
3. `00_AUDIT/current_state_audit.md`
4. `01_PROTOCOL/research_protocol_v1.md`
5. `TASK_BOARD.csv`
6. `RISK_REGISTER.csv`
7. 현재 단계의 `09_CODEX/phase_*.md`
8. 저장소의 실제 README, AGENTS, package files, data files
9. 서명 연구계획서와 교수 피드백

## 3. 지침 우선순위

충돌 시 다음 순서를 적용한다.

1. 법, 연구윤리, 기관의 공식 학위논문·IRB 지침
2. 지도교수가 승인한 최신 프로토콜과 amendment
3. 검증된 원자료와 분석 코드
4. 이 재설계 패키지
5. 서명된 과거 연구계획서
6. 기존 AGENTS와 이전 GPT 산출물

서명본은 무시하지 않지만, 실제 프로토콜보다 우선하지 않는다.

## 4. 최초 작업

1. 연구 자료 폴더와 Git 저장소의 정확한 위치를 찾는다.
2. 현재 branch, commit, remote, dirty 상태를 기록한다.
3. 생산 배포 commit과 현재 HEAD 차이를 기록한다.
4. `thesis-reboot-20260710` 또는 날짜가 포함된 작업 branch를 만든다.
5. 이 패키지를 `research/design/20260710/`에 read-only 기준본으로 복사한다.
6. 다음 로그를 만든다.
   - `research/logs/WORKLOG.md`
   - `research/logs/DECISIONS.md`
   - `research/logs/RISKS.md`
   - `research/logs/BLOCKERS.md`
7. 기존 데이터를 `legacy_unverified`로 격리한다.
8. Gate 0 감사가 끝나기 전 연구 결과 문서를 고치지 않는다.

## 5. 작업 기록

### WORKLOG

각 작업마다 다음을 기록한다.

```text
날짜·시간
phase / task ID
입력 파일과 버전
실행한 명령 또는 절차
생성·수정 파일
검사 결과
발견한 문제
다음 작업
```

### DECISIONS

선택지가 둘 이상이고 결과에 영향을 주는 결정은 다음을 남긴다.

- 결정
- 대안
- 근거
- 영향
- 승인자 또는 임시 가정
- 재검토 조건

### BLOCKERS

외부 접근이나 사람 판단이 없으면 진행할 수 없는 항목만 기록한다.

- 정확한 차단 지점
- 이미 시도한 것
- 필요한 최소 입력
- 영향을 받는 산출물
- 차단과 무관하게 계속할 수 있는 작업

차단 하나를 이유로 전체 프로젝트를 중단하지 않는다.

## 6. 비협상 원칙

### 연구

- 상위 N 관련도 결과를 전체 검색으로 사용하지 않는다.
- 검색 hit를 포함 연구 수나 연구의 깊이로 제시하지 않는다.
- record, report, study를 구분한다.
- 원문 선별 전 최종 결과를 쓰지 않는다.
- 원문 locator 없는 수치와 claim을 규칙에 사용하지 않는다.
- 질문별 검색과 합성을 분리한다.
- 메타분석이 가능하지 않으면 억지로 수행하지 않는다.
- 프로토콜 변경을 숨기지 않는다.

### AI

- AI 단독 제외 금지
- AI를 최종 비뚤림 위험 또는 GRADE 판정자로 사용 금지
- LLM-as-judge를 1차 정답으로 사용 금지
- 사람 gold를 먼저 잠근 뒤 평가
- 모델, 버전/접근일, 프롬프트, 설정, 입력·출력 해시 기록
- 불안정성과 오류를 결과에서 숨기지 않음

### 임상 규칙

- 런타임 생성형 답변 금지
- validated claim 없는 validated rule 금지
- scope 밖 규칙을 thesis 결과에 포함 금지
- 임계값의 원문·공식 출처 필수
- 심각도와 근거확실성 분리
- “안전/금지” 단정은 근거와 범위가 허용할 때만 사용

### 코드

- 생성 데이터 직접 수정 금지
- 하드코딩된 연구 수치 금지
- 스키마 검증과 referential integrity 필수
- 모든 critical/major 오류를 회귀 테스트로 추가
- 테스트 실패를 우회해 배포 금지
- 건강정보·원문·API key 로그 금지

### 논문

- 결과 고정 전 완성형 결과·고찰·초록 작성 금지
- 존재하지 않는 결과·IRB 상태·전문가 수를 작성 금지
- 분량 채우기 반복 문단 금지
- 작업 메타 문구, 프롬프트, 에이전트 지시를 formal document에 남기지 않음
- 문장 교정보다 사실·논리·수치 검사를 먼저 수행

## 7. 단계 운영

각 phase는 다음 루프로 수행한다.

1. Entry criteria 확인
2. 입력 manifest 고정
3. 작업 수행
4. 자동 검사
5. 사람 검토가 필요한 항목 표시
6. 산출물 해시 생성
7. Exit criteria 표 작성
8. Gate 통과 여부 결정

`phase complete`는 파일이 존재한다는 뜻이 아니다. 해당 phase 문서의 exit criteria와 `10_QA/acceptance_criteria.md`를 통과해야 한다.

## 8. 상태 표기

모든 task와 artifact는 다음 중 하나다.

- `not_started`
- `in_progress`
- `blocked_external`
- `needs_human_review`
- `failed_quality_gate`
- `complete_verified`

“완료”와 “생성됨”을 구분한다.

## 9. 과거 자료 사용

기존 검색 236건과 핵심근거 10건은 seed와 회수 검증에 사용할 수 있다. 새 검색에서 발견되었다는 사실과 원문 재검증을 확인한 뒤에만 새 curated 자료로 승격한다.

기존 규칙 110개를 새 스키마로 자동 변환해 validated로 표시하지 않는다. 각 규칙은 claim부터 다시 만든다.

## 10. 문헌과 원문

- 유료·제한 원문을 공개 저장소에 커밋하지 않는다.
- 원문 파일은 허용된 로컬 또는 비공개 저장 위치에 두고 해시·서지정보만 version control한다.
- PDF 표와 그림을 추출할 때 사람이 페이지를 시각 확인한다.
- 철회, 정정, 중복 출판을 확인한다.
- DOI나 PMID만 보고 연구 내용을 쓰지 않는다.

## 11. 검색 실행

- 질문별 검색식
- 전체 내보내기
- 플랫폼 제한 시 pagination 또는 범위 분할
- 원본 파일 불변 보존
- 검색일·hit·export·해시 기록
- 검색식 동료검토
- 제출 전 업데이트 검색

검색원 접근이 없으면 접근 실패를 기록하고, 대체 검색원을 임의로 동등하다고 표현하지 않는다.

## 12. 사람 검토

사람이 필요한 작업은 구체적인 검토 큐를 만든다. 예:

```text
review_queue/full_text_A1.csv
review_queue/risk_of_bias_RCT.csv
review_queue/claim_verification.csv
review_queue/expert_rules.csv
```

각 큐에는 원문 위치, 판단 질문, 선택지, 결정 기준이 있어야 한다. 사람에게 “전체를 확인해 달라”는 모호한 요청을 만들지 않는다.

## 13. 분석 코드

- 입력 파일과 schema version 명시
- 데이터 검증 후 분석
- 변환 공식 기록
- seed와 패키지 버전 기록
- 표·그림·수치는 코드에서 재생성
- 수동 Excel 수정값을 분석 기준으로 사용하지 않음
- 분석 결정은 `analysis_decisions.md`에 기록

## 14. 앱과 배포

앱은 연구 결과의 표현 계층이다. 앱이 먼저 정답을 만들지 않는다.

배포 전:

1. curated data freeze
2. bundle build
3. schema/provenance tests
4. full scenario validation
5. UI/API E2E
6. release manifest
7. production deployment
8. post-deploy smoke test

## 15. 논문 작성

### 작성 순서

1. 방법의 사실 기록
2. 결과 표·그림 생성
3. 결과 문장
4. 고찰
5. 서론 보정
6. 결론
7. 국문초록
8. 영문초록
9. 전체 일치 검사

### 문체

`08_THESIS/human_style_guide.md`를 따른다. 각 장을 작성한 뒤 “주장-근거-한계”를 확인한다. 과도한 명사열과 반복되는 AI식 문장을 고친다.

### formal document firewall

최종 DOCX/PDF에는 다음이 없어야 한다.

- Codex, ChatGPT, prompt, agent, token, 세션, 작업 지시
- 파일 경로와 내부 task ID, 필요한 경우 부록의 재현 정보 제외
- “이 문단을 수정”, “placeholder”, “TODO”
- 검증되지 않은 결과 숫자

AI를 연구 방법으로 사용했다면 모델·절차·평가는 학술적으로 정직하게 보고한다.

## 16. 외부 차단 상황

다음은 실제 blocker가 될 수 있다.

- Embase·CENTRAL 등 기관 접근
- 유료 원문
- 두 번째 사람의 선별·추출·전문가 판단
- 지도교수 프로토콜 승인
- IRB/비대상 판단

차단 시:

1. 차단 항목을 `BLOCKERS.md`에 기록한다.
2. 사람이 바로 처리할 수 있는 최소 파일·목록을 만든다.
3. 검색식, 코드, 자료구조, 다른 질문 등 비차단 작업을 계속한다.
4. blocker가 해결되지 않은 결과를 완료로 쓰지 않는다.

## 17. 완료 보고

최종 보고서는 다음을 포함한다.

- 각 Gate 통과표
- 최종 연구 질문과 변경 이력
- 검색·선별·포함 study 수
- 분석 및 GRADE 결과
- AI 평가 지표와 오류
- validated claim/rule 수
- 시나리오 검증 지표와 critical 오류
- 전문가/사용성 실제 수행 여부
- Git commit, bundle version, 배포 URL
- DOCX/PDF 경로와 해시
- 남은 제한점과 미해결 blocker

“모든 연구가 완벽히 끝났다”는 추상적 문구를 쓰지 않는다. 각 기준의 통과 증거를 제시한다.

## 18. 첫 실행 명령

`09_CODEX/PROMPT_TO_START.txt`의 지시를 현재 workspace에 적용하고 Phase 1부터 시작한다.
