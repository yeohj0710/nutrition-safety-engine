# Phase 5. 자료추출, 질평가, AI 추출 평가

## 목적

포함 연구의 핵심 정보를 원문 위치와 함께 추출하고, AI 추출의 정확성과 오류를 사람 정답과 비교한다.

## Entry

- 포함 study/report 잠금
- 추출 사전과 RoB 도구 확정

## 작업

1. 사람 추출 pilot
2. 모든 포함 보고물 추출
3. 핵심 숫자 이중 확인
4. study-report 중복 결과 정리
5. 설계별 비뚤림 위험 독립 평가
6. AI 프롬프트 개발 세트 분리
7. 평가 세트 반복 실행
8. 필드별 정확성, locator, unsupported claims 분석
9. 사람 시간과 수정 부담 측정
10. gold 수정이 필요한 경우 이력 보존

## 산출물

- verified extraction table
- risk-of-bias table and visualization data
- AI raw runs and manifests
- AI field-level metrics
- AI error taxonomy
- extraction decisions log

## Exit

- 규칙에 쓰일 모든 값이 verified
- 원문 locator 누락 0건 for critical fields
- RoB 독립·합의 판단 존재
- AI 평가와 프롬프트 개발 자료 분리
- 모델·프롬프트·입출력 버전 재현 가능
