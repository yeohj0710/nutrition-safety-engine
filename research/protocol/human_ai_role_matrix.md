# 사람·AI 역할과 동결 지표

| 단계 | 사람 권한 | AI 허용 | AI 금지 | 동결 지표 |
|---|---|---|---|---|
| 제목·초록 선별 | 최종 include/exclude/uncertain | 우선순위·불확실성 제안 | 단독 제외 | sensitivity, critical FN, specificity, precision, NPV, F2, WSS, 반복 일치율 |
| 원문 선별 | 두 검토자 독립 결정·합의 | 구조화 보조 | 최종 판정 | agreement와 불일치 수; AI 성능 주요 결과 아님 |
| 추출 | 사람 추출·핵심 숫자 이중 확인 | 별도 JSON 추출 | 사람 값을 덮어쓰기 | 필드 F1, 숫자·단위·locator 정확도, unsupported-claim rate |
| RoB/GRADE | 독립 사람 판단·합의 | 근거 위치 후보 | 최종 등급 | 사람 간 합의와 합의 후 판단 |
| claim/rule | 원문 의미 검토와 승인 | 초안 구조화 | 자동 validated 승격 | locator completeness 100%, rule-to-validated-claim 100% |
| 시나리오 | 구현 독립 검토자 정답·합의 | synthetic proxy만 별도 | proxy를 gold로 표시 | sensitivity, precision, exact match, critical FN, evidence-link, determinism, Wilson CI |

개발 세트 최대 50건. 최종 평가 세트와 중복 금지. 사람 gold 해시를 AI 실행 전에 고정한다. 동일 설정으로 최소 3회 실행한다. 본 연구에서는 목표 recall을 충족해도 자동 제외를 허용하지 않는다.
