# AI 보조 문헌 선별 성능평가

## 1. 연구 질문

사람 검토에 앞서 AI가 문헌 우선순위를 제안할 때 포함 연구의 누락을 최소화하면서 검토 순서를 개선할 수 있는가?

## 2. 역할 제한

AI 출력은 우선순위와 불확실성 정보다. 최종 결정이 아니다. AI가 `exclude`를 제안해도 사람 검토 없이 제외하지 않는다.

## 3. 자료 분할

- 프롬프트 개발: 최대 50건. 다양한 질문과 포함·제외 이유를 포함한다.
- 최종 평가: 개발 세트와 겹치지 않는 사람이 확정한 기록. 가능하면 전체 나머지 자료를 사용한다.
- 평가 전에 사람의 최종 결정을 잠그고 해시를 기록한다.

기존 236건은 프롬프트 개발·오류 분석에 사용할 수 있지만, 새 검색 결과의 최종 성능을 대신하지 않는다.

## 4. 입력

AI에는 다음만 제공한다.

- title
- abstract
- author keywords
- publication type metadata
- question-specific eligibility summary

사람의 최종 판단, 우선순위, 포함 연구 목록은 평가 시 제공하지 않는다.

## 5. 출력 스키마

```json
{
  "record_id": "REC-...",
  "question_id": "A1",
  "recommendation": "include|uncertain|exclude",
  "priority_score": 0.0,
  "population_match": "yes|no|unclear",
  "exposure_match": "yes|no|unclear",
  "safety_outcome_match": "yes|no|unclear",
  "human_study_match": "yes|no|unclear",
  "reason": "짧고 구체적인 근거",
  "uncertainty": "정보가 부족한 부분"
}
```

## 6. 반복 실행

고정된 입력과 프롬프트로 최소 3회 실행한다. 모델명, 접근일, 설정, 프롬프트 해시, 입력 해시, 출력 해시를 기록한다.

## 7. 1차 지표

- Sensitivity/recall for human-included records
- 95% confidence interval
- Critical false negatives count and detailed error analysis

## 8. 2차 지표

- specificity
- precision/positive predictive value
- negative predictive value
- F2 score
- balanced accuracy
- work saved over sampling at target recall
- calibration by score band
- abstention rate
- repeated-run agreement
- question-specific performance

## 9. 임계값 선택

평가 자료를 본 뒤 가장 좋아 보이는 임계값을 보고하지 않는다. 개발 세트에서 임계값을 정하거나 nested procedure를 사용한다. 목표 recall은 0.95 이상이지만, 통과하지 못하면 사람 우선순위 참고용으로만 유지한다.

## 10. 오류 분석

거짓 음성을 최소한 다음 유형으로 분류한다.

- population 표현 누락 또는 간접 표현
- 복합제·상품명
- 안전성 결과가 초록에 명시되지 않음
- 약어·동음이의어
- 부정문 또는 비교군 해석
- secondary analysis 식별 실패
- 다국어 제목·초록

## 11. 종료 조건

AI 선별 기능이 있어도 사람 선별 절차는 유지한다. AI 성능이 목표를 넘더라도 본 학위논문 범위에서는 자동 제외로 승격하지 않는다.
