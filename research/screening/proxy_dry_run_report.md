# 선별 proxy dry run 보고

상태: `synthetic_proxy_no_decision_authority`

## 목적

사람 선별 전 큐·해시·반복성·불일치 기록 구조를 시험했다. 실제 AI 모델 성능평가가 아니며, 포함·제외·PRISMA 결과가 아니다.

## 실행

- 분석 단위: 19,961 record-question
- proxy A: sensitivity-first 용어 신호
- proxy B: structured-conservative 용어 신호
- 모든 19,961건: `requires_human_review=true`
- proxy 단독 제외: 0건
- 사람 판정: 0건
- 최종 판정: 0건
- 두 proxy 추천 불일치: 4,224건
- 사람 교육용 무작위 pilot queue: 질문별 10건, 총 50건, seed `20260710`

## 해석 제한

높음·중간·낮음은 검토 순서용 synthetic 신호다. 낮음도 제외하지 않는다. 사람 gold가 잠기기 전 sensitivity, specificity, precision, F2, 작업절감률을 계산하지 않는다. 실제 AI 모델·프롬프트 평가도 사람 gold와 개발/평가 분할 후 별도 실행한다.
