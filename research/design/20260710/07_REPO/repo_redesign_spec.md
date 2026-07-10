# 저장소 재설계 사양

## 1. 목표

저장소는 웹 화면을 만드는 코드와 연구 데이터를 한 파일에 섞지 않는다. 검색 원자료부터 앱 결과까지 모든 변환을 재현하고, 검증되지 않은 legacy 규칙이 사용자 화면에 노출되지 않도록 한다.

## 2. 목표 구조

```text
nutrition-safety-engine/
  AGENTS.md
  README.md
  package.json
  research/
    protocol/
      protocol.md
      amendments.csv
      registration/
    searches/
      A1/
      A2/
      B1/
      B2/
      B3/
    screening/
    extraction/
    synthesis/
    validation/
    thesis/
    logs/
      WORKLOG.md
      DECISIONS.md
      RISKS.md
      BLOCKERS.md
  data/
    raw/                    # immutable; large/licensed files may be ignored or DVC-managed
    interim/                # normalized and deduplicated records
    curated/
      sources.csv
      records.csv
      reports.csv
      studies.csv
      screening_decisions.csv
      extractions.csv
      risk_of_bias.csv
      certainty.csv
      claims.jsonl
      rules.jsonl
      scenarios.csv
    gold/
      screening_gold.csv
      extraction_gold.csv
      scenario_gold.csv
    legacy_unverified/
      manifest.json
    schemas/
      *.schema.json
    releases/
      <bundle_version>/
  scripts/
    retrieve/
    normalize/
    dedupe/
    screen/
    extract/
    synthesize/
    rules/
    validate/
    thesis/
    release/
  src/
    app/
    domain/
      types.ts
      schemas.ts
    engine/
      normalize-input.ts
      unit-conversion.ts
      match-rules.ts
      prioritize.ts
      render-message.ts
      resolve-provenance.ts
    evidence/
      load-bundle.ts
      scope-filter.ts
    generated/
      thesis-bundle.json
      release-metadata.json
    components/
  tests/
    unit/
    contract/
    provenance/
    scenarios/
    regression/
    e2e/
  docs/
    architecture.md
    data-lineage.md
    deployment.md
    methods/
    decisions/
```

## 3. 데이터의 단일 기준

- `data/curated`가 연구 데이터의 논리적 기준이다.
- 앱은 curated 파일을 직접 임의 해석하지 않는다.
- `scripts/release/build-bundle`이 스키마·추적성 검사를 수행한 뒤 `src/generated/thesis-bundle.json`을 만든다.
- 생성 파일은 사람이 직접 수정하지 않는다.
- 화면 숫자는 bundle에서 계산한다. 코드 문자열에 적지 않는다.

## 4. 데이터 상태

모든 claim과 rule은 상태를 가진다.

### claim

- draft
- human_verified
- validated
- retired

### rule

- draft
- source_verified
- expert_reviewed
- scenario_validated
- validated
- retired

### scope

- validated_thesis_scope
- exploratory_demo
- legacy_unverified
- retired

기본 사용자 화면은 `validated_thesis_scope + validated`만 로드한다.

## 5. 엔진 처리 순서

1. 입력 스키마 검증
2. 성분·약물·질환 alias 정규화
3. 단위 변환과 원래 값 보존
4. 필요한 계산 수행
5. 후보 규칙 선택
6. 필수 조건·제외 조건 평가
7. 누락정보 계산
8. action class와 severity 기준 정렬
9. 중복 메시지 병합
10. claim/source provenance 연결
11. canonical JSON 출력

각 단계는 순수 함수에 가깝게 작성하고 단위 테스트한다.

## 6. 생성형 AI 경계

- 런타임 API와 UI는 LLM을 호출하지 않는다.
- AI는 `scripts/extract` 또는 연구용 실험 디렉터리에서만 호출한다.
- 모델 출력은 `data/interim/ai_runs`에 저장하고 검증 후에만 curated로 이동한다.
- API 키와 원문은 로그에 남기지 않는다.

## 7. 앱 모드

### Counseling mode

입력된 상황에서 검증된 행동, 누락정보, 간단한 근거를 보여준다. 검색 hit 수나 자동 후보 수를 품질 지표처럼 보여주지 않는다.

### Research audit mode

연구자용으로 다음을 보여준다.

- bundle version과 commit
- 규칙·claim·source 상태별 수
- 질문별 근거확실성
- validation 결과
- 검색·선별 흐름
- 업데이트일

두 모드는 URL, 권한 또는 명확한 탭으로 분리한다.

## 8. UI 결과 구조

1. 가장 중요한 행동
2. 감지된 조건
3. 추가로 필요한 정보
4. 근거 요약과 확실성
5. 적용 범위와 한계
6. 출처
7. 도구의 역할과 한계

관련 후보문헌 12건을 사용자 결과 아래 나열하는 방식은 제거하거나 연구 감사 화면으로 이동한다. 후보문헌은 검증된 근거와 같은 의미가 아니다.

## 9. API 계약

응답은 최소 다음을 포함한다.

```json
{
  "request_id": "...",
  "bundle_version": "...",
  "engine_commit": "...",
  "normalized_input": {},
  "actions": [],
  "missing_information": [],
  "matched_rules": [],
  "evidence_claims": [],
  "limitations": [],
  "scope": "validated_thesis_scope"
}
```

정렬 순서와 ID가 결정적이어야 한다.

## 10. 관찰 가능성과 로그

- 입력 원문이나 건강정보를 생산 로그에 저장하지 않는다.
- 필요한 경우 request ID, bundle version, 오류 코드, 성능 시간만 익명 기록한다.
- 개발·검증 환경에서는 시나리오 ID를 기록한다.
- 로그 정책을 README와 개인정보 문구에 명시한다.

## 11. 릴리스

각 연구 릴리스는 다음을 가진다.

- semantic bundle version
- Git commit
- 데이터 manifest와 SHA-256
- 스키마 버전
- 테스트 결과
- known limitations
- 규칙 상태별 수
- 검증 시나리오 결과
- 배포 URL과 시간

## 12. 완료 기준

`07_REPO/ci_acceptance.md`와 `10_QA/acceptance_criteria.md`를 모두 통과해야 한다.
