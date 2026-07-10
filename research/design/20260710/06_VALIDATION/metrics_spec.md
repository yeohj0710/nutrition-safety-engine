# 검증 지표 정의

## 1. 분류 단위

지표 계산 전에 분석 단위를 명시한다.

- scenario-level primary action
- scenario-action pair
- scenario-rule pair
- scenario-claim link
- missing-information prompt

서로 다른 단위의 수치를 하나의 정확도로 합치지 않는다.

## 2. Sensitivity

`TP / (TP + FN)`

고위험 action이 정답인 시나리오 중 엔진이 해당 action을 반환한 비율이다.

## 3. Precision

`TP / (TP + FP)`

엔진이 반환한 action 또는 규칙 중 정답 허용 집합에 속한 비율이다.

## 4. F1과 F2

F1은 precision과 recall을 같은 비중으로, F2는 recall에 더 큰 비중을 둔다. 안전성 선별에서는 F2를 보조 지표로 사용한다.

## 5. Exact set match

예측된 규칙 집합과 허용 정답 집합이 정확히 일치하는 시나리오 비율이다. 허용 가능한 대체 규칙 집합이 있으면 평가 코드에 사전 정의한다.

## 6. Critical false negative

정답이 `urgent_referral` 또는 `avoid_until_review`인데 엔진이 이를 반환하지 않고 낮은 행동만 제시한 경우다. 단순 누락정보 반환이 허용되는지는 시나리오 정답에 사전 정의한다.

## 7. Evidence-link accuracy

반환된 claim/source link가 실제 규칙과 연결되어 있고, 원문 위치가 존재하며, 메시지를 지지하는 비율이다. 자동 링크 무결성과 사람 의미 검토를 구분한다.

## 8. Deterministic repeatability

동일한 commit, bundle, 입력으로 반복한 결과의 canonical JSON이 완전히 같은 비율이다.

## 9. Work Saved over Sampling

AI 선별 평가에서 목표 recall을 유지하며 사람이 보지 않아도 되는 비율을 계산한다. 본 연구에서는 자동 제외에 사용하지 않으므로, 실제 절감이라기보다 잠재적 우선순위 효율로 해석한다.

## 10. 신뢰구간

- 비율: Wilson 95% CI
- 두 엔진 쌍 비교: McNemar exact 또는 적절한 방법
- 연속 시간: 분포를 보고 mean/SD 또는 median/IQR

## 11. 분모 공개

모든 표에는 분자, 분모, 제외된 사례 수를 함께 쓴다. “정확도 95%”만 쓰지 않는다.
