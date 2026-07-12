# 근거 주장 작성 체크리스트

상태: `human_authoring_guide_not_results`

claim은 검증된 추출·RoB·합성·GRADE 이후에만 작성한다. 검색 hit, proxy 점수, legacy 자료, AI 단독 출력은 claim의 근거가 될 수 없다.

## 작성 전

- [ ] `question_id`가 A1~B3 중 하나이며 프로토콜 범위와 일치한다.
- [ ] 포함 연구와 report–study 연결이 사람 검증을 마쳤다.
- [ ] claim이 사용하는 모든 수치는 `verification_status=verified`인 추출행으로 재현된다.
- [ ] 직접 근거와 이차 근거가 분리되어 있다.
- [ ] 해당 결과의 GRADE 행이 두 검토자 합의와 날짜를 갖췄다.

## 문장 내용

- [ ] 한 문장에는 하나의 중심 주장만 있다.
- [ ] population·exposure·comparator·outcome·timepoint가 필요한 만큼 구체적이다.
- [ ] 효과 방향과 크기, 신뢰구간 또는 불확실성을 원자료와 동일하게 표현한다.
- [ ] `연관`을 `인과`로, `보고되지 않음`을 `0` 또는 `효과 없음`으로 바꾸지 않는다.
- [ ] 통계적 유의성을 임상적 중요성으로 과장하지 않는다.
- [ ] subgroup·surrogate·간접근거의 제한을 숨기지 않는다.
- [ ] 적용 가능한 집단과 적용하면 안 되는 예외를 명시한다.
- [ ] GRADE certainty와 표현 강도가 일치한다.

## 계보와 검증

- [ ] `support_json`에 source·report·study·extraction·certainty ID가 있다.
- [ ] 지지 quote와 locator, quote SHA-256이 실제 source byte에서 재현된다.
- [ ] `certainty`가 연결된 GRADE 행의 `final_certainty`와 같다.
- [ ] `limitations_json`과 `applicability_notes`가 비어 있지 않거나 비어 있는 이유가 검증됐다.
- [ ] 독립 검토자가 claim 문장과 계보를 확인했다.
- [ ] `verification_status=validated` 전에는 thesis bundle이나 rule에 사용하지 않는다.

## 금지

- AI가 만든 문장을 원문 대조 없이 채택
- 여러 결과·시점·집단을 한 claim으로 합침
- 임의 메타분석 또는 결과를 본 뒤 선택한 분석
- source locator 없는 수치
- legacy 또는 synthetic fixture의 승격
- 건강행동을 단정하는 처방 문장
