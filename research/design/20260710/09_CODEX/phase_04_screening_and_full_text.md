# Phase 4. 제목·초록 및 원문 선별

## 목적

사람 판단을 중심으로 최종 포함 study/report를 확정하고 PRISMA 자료를 만든다.

## Entry

- 중복 제거 완료
- screening manual과 reviewer 교육 완료
- 독립 판정 저장 구조 준비

## 작업

1. pilot screening과 기준 조정
2. 전수 1차 제목·초록 선별
3. 전수 include/uncertain + 제외 표본 이중검토
4. AI priority는 별도 blind run으로 생성
5. 불일치 합의
6. 원문 확보와 상태 기록
7. 모든 원문 이중검토
8. 한 가지 주된 제외 이유
9. report-study linkage
10. final PRISMA와 제외 목록
11. AI screening gold 잠금 및 성능 분석

## 산출물

- `screening_decisions.csv`
- `full_text_log.csv`
- `excluded_full_text.csv`
- `reports.csv`, `studies.csv`
- PRISMA data and figure
- AI screening runs, metrics, error report

## Exit

- 모든 record/report 최종 상태 존재
- 원문 제외마다 이유 존재
- 포함 study와 report 수 구분
- reviewer agreement와 audit 결과 보고
- AI 단독 제외 0건
- gold set 해시 고정
