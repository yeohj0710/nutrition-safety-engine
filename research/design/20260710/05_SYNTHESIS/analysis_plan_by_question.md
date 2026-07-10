# 질문별 분석 매트릭스

| 질문 | 1차 결과 | 가능한 효과크기 | 주요 층화 | 정량합성 주의점 |
|---|---|---|---|---|
| A1 | INR/TTR, bleeding, thromboembolism | MD, RR, HR | supplement vs intake change; VKA type | crossover 구조, INR 정의 차이 |
| A2 | major/CRNM/any bleeding | RR, HR | VKA/DOAC; EPA-only/mixed; antiplatelet | 일반 인구 시험의 간접성 |
| B1 | incident/recurrent stone, urine calcium | RR, HR, MD | dietary/supplemental; timing; formulation | calcium+D 병용 분리 |
| B2 | hypercalciuria, hypercalcemia, stone | RR, HR, MD | D alone/D+calcium; daily/bolus | 대리결과와 사건 분리 |
| B3 | urinary oxalate, stone | RR, HR, MD | sex; dose; short/long term | 식이 노출과 보충제 분리 |

## 분석 자료셋

- `analysis_study_level.csv`: 연구별 독립 효과크기
- `analysis_outcome_level.csv`: 결과·시점별 long format
- `analysis_exclusions.csv`: 합성에서 제외된 값과 이유
- `analysis_decisions.md`: 변환, 합성, 민감도 분석 결정

## 코드 규칙

- 원자료를 수동 복사해 그래프를 만들지 않는다.
- 모든 표와 그림은 분석 자료와 코드에서 재생성 가능해야 한다.
- 난수 seed와 패키지 버전을 기록한다.
- 결과 반올림은 표시 단계에서만 수행한다.
