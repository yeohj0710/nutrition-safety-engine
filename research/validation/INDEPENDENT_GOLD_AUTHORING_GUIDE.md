# 독립 gold scenario 작성 안내

상태: `external_human_authoring_required_not_gold`

대상 파일은 `independent_gold_scenario_authoring_queue.csv`의 120행이다. 질문별 24행씩 배정되어 있다. 이 큐의 빈 행이나 synthetic scenario는 gold가 아니다.

## 역할 분리

- 저자 1: 프로토콜과 검증된 rule 범위를 보고 입력·기대행동을 독립 작성
- 저자 2: 저자 1의 답과 엔진 출력을 보지 않고 독립 작성
- 합의자: 두 초안을 비교하고 불일치를 근거와 함께 해결
- 엔진 구현자: gold 저자·합의자로 참여하지 않음
- 전문가 검토자: gold 작성과 별도로 임상 타당성을 평가

`author_1_id`, `author_2_id`, `adjudicator_id`는 모두 달라야 한다. 역할 충돌은 ID와 사유를 기록하고 해당 행을 gold로 승격하지 않는다.

## 작성 순서

1. `question_id`, `protocol_sha256`, `thesis_bundle_sha256`을 확인한다.
2. 저자 1이 `author_1_input_json`과 `author_1_expected_actions_json`을 작성한다.
3. 저자 2가 독립적으로 `author_2_input_json`과 `author_2_expected_actions_json`을 작성한다.
4. 합의자가 두 초안과 검증된 claim/rule 계보를 대조한다.
5. 합의 결과를 `adjudicated_input_json`, `adjudicated_expected_actions_json`에 기록한다.
6. 누락 시 중대한 위해가 될 rule ID를 `critical_failure_labels_json` 배열에 기록한다.
7. 작성·합의 시각을 ISO 8601로 기록한다.
8. 아래 방식으로 `gold_row_sha256`을 계산한다.
9. `status=adjudicated_independent_gold_candidate`로 바꾼다.
10. builder와 evaluator를 실행한다. 120개 모두 통과하기 전 성능값을 보고하지 않는다.

## JSON 형식

입력은 JSON object다. 엔진 입력 schema에 정의된 키만 사용하고 단위가 있는 값은 정규화 가능한 구조로 쓴다.

기대행동은 JSON array다. 각 항목은 최소한 다음 두 문자열을 포함한다.

```json
[{"rule_id":"RULE-...","action_class":"..."}]
```

기대행동이 없으면 `[]`을 쓴다. `critical_failure_labels_json`은 기대행동에 실제 존재하는 `rule_id` 문자열만 담는 배열이다.

## 행 해시

CSV 헤더 순서대로 `gold_row_sha256`을 제외한 모든 셀을 U+001F 구분자로 연결하고 UTF-8 byte의 SHA-256을 계산한다. 공백·JSON key 순서·시각·status가 바뀌면 해시를 다시 계산한다.

```python
hashlib.sha256("\x1f".join(row[field] for field in fields if field != "gold_row_sha256").encode("utf-8")).hexdigest()
```

## scenario 구성

질문별 24개에는 최소한 다음 경계를 고르게 포함한다.

- 명확한 규칙 발동·비발동
- 임계값 바로 아래·같음·바로 위
- 단위 변환과 동등 입력
- 부분 문자열 오탐 가능 입력
- 병용약·질환·연령 등 적용 제외조건
- 필수정보 누락
- 여러 규칙 동시 발동과 우선순위
- critical false negative 가능 상황

실제 환자정보를 사용하지 않는다. 연구자가 만든 가상 입력만 사용한다.

## 성능 보고 금지 조건

- curated gold가 120개 미만
- 두 저자와 합의자가 독립적이지 않음
- thesis bundle SHA 불일치
- 행 SHA 불일치
- 기대행동 JSON 또는 critical label 오류
- validated rule/claim이 없음
- critical false negative가 존재하지만 release 허용으로 표시됨

synthetic safe-empty 120건의 100% 결정성은 독립 gold 성능이 아니다.
