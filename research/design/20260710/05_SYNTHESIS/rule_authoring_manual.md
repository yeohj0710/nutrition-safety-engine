# 근거에서 규칙으로 변환하는 작성 매뉴얼

상태: `human_authoring_guide_not_validated_rules`

규칙은 진단이나 처방을 자동 결정하지 않는다. 입력 조건에서 확인할 위험, 필요한 추가정보, 전문가 상담 또는 모니터링 필요성을 일관되게 표시한다. 검증된 claim이 없는 규칙은 만들지 않는다.

## 1. 작성 순서

1. 질문별 검증된 GRADE 결과와 `verification_status=validated` claim을 선택한다.
2. claim의 population·exposure·outcome·한계를 rule 적용 범위로 옮긴다.
3. 조건과 제외조건을 구조화된 JSON으로 작성한다.
4. 정보가 부족할 때 필요한 항목을 `missing_information_json`에 기록한다.
5. action class와 severity를 정한다.
6. 사용자 메시지와 내부 rationale을 분리한다.
7. 독립 전문가 검토와 독립 gold scenario 검증을 연결한다.
8. 모든 선행 조건을 통과한 뒤에만 `validation_status=validated`로 변경한다.

## 2. 필수 계보

각 규칙은 다음을 재현할 수 있어야 한다.

`rule_id → claim_id → certainty_id → extraction_id → report_id → source_id → source byte/locator`

- `claim_ids`에는 하나 이상의 검증된 claim만 기록한다.
- claim과 rule의 `question_id`가 같아야 한다.
- claim certainty와 연결된 GRADE certainty가 같아야 한다.
- 지지 source는 저장소 내부의 non-legacy 경로여야 하며 SHA-256이 일치해야 한다.
- expert review와 independent scenario evidence가 `validation_evidence_json`에 있어야 한다.

## 3. 조건과 범위

- `scope_status`: thesis 범위에 포함되는 규칙만 `in_scope` 후보가 된다.
- `conditions_json`: 성분·용량·병용약·질환·검사값 등 실제 입력으로 평가 가능한 조건만 사용한다.
- `exclusions_json`: 연구 근거가 적용되지 않는 집단이나 상황을 명시한다.
- `missing_information_json`: 안전한 판단에 필요한데 입력되지 않은 정보를 열거한다.
- 문자열 부분일치로 성분이나 약물을 판정하지 않는다. 정규화된 ID·단위·연산자를 사용한다.

## 4. action class와 severity

허용 action class는 schema와 registry validator를 따른다. 일반 원칙은 다음과 같다.

- 정보 확인: 추가 용량·기간·병용약·검사값 필요
- 모니터링 고려: 검증된 근거가 모니터링 필요성을 뒷받침
- 전문가 상담: 상호작용·고위험 조건·불확실성 때문에 개인 판단을 넘김
- 긴급 평가: 독립 전문가가 합의한 중대한 위험 조건에만 사용

severity는 근거 확실성만으로 정하지 않는다. 위해의 중대성·가역성·발생 가능성·정보 결측을 함께 검토하고 근거와 판단을 분리해 기록한다.

## 5. 메시지 작성

- 사용자 메시지는 무엇을 확인해야 하는지 먼저 말한다.
- 확정 진단·처방·중단 지시를 하지 않는다.
- 근거가 제한적이면 제한적이라고 명시한다.
- `효과 없음`과 `근거 부족`을 구분한다.
- 내부 rationale에는 claim ID와 제한사항을 포함한다.

## 6. 검증 시나리오

최소한 다음 경계를 독립 gold scenario에 포함한다.

- 단위만 다른 동등 입력
- 임계값 바로 아래·같음·바로 위
- 부분 문자열 오탐 가능 입력
- 병용약·질환·연령·임신 등 제외조건
- 필수정보 누락
- 동일 입력 반복 실행
- legacy 규칙과 충돌할 수 있는 입력

민감도·정밀도·exact match·critical false negative·결정성을 보고한다. synthetic scenario 결과는 실제 독립 gold 성능으로 보고하지 않는다.

## 7. 승격 금지 조건

다음 중 하나라도 해당하면 thesis mode에 노출하지 않는다.

- 검증된 claim 또는 GRADE 없음
- 원문 locator·source SHA-256 불일치
- 사람 extraction/RoB 검증 미완료
- 독립 전문가 검토 없음
- 독립 scenario 검증 없음
- `validation_status`가 draft·pending·rejected
- legacy 또는 synthetic fixture에서 유래
