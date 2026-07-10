# Phase 3. 전체 검색과 중복 제거

## 목적

상위 N 제한 없이 질문별 전체 검색결과를 보존하고 record-report-study 구조의 기반을 만든다.

## Entry

- protocol v1.0 고정
- 검색식 동료검토 완료 또는 의견 반영 기록
- 데이터베이스 접근 결정

## 작업

1. 질문×데이터베이스별 최종 검색 실행
2. 검색식, 날짜, hit, export, 해시 기록
3. 내보내기 한계가 있으면 분할 전수 export
4. 등록자료원과 보조 검색
5. raw 파일 불변 보존
6. 서지 정규화
7. 자동 중복 후보 생성
8. 사람 확인 큐 생성
9. record→report 후보 연결
10. 기존 236건과 sentinel 회수 확인

## 산출물

- raw search directories
- `search_log.csv`
- `records.csv`
- `duplicate_candidates.csv`
- `deduplication_decisions.csv`
- `search_recall_check.md`

## Exit

- 모든 실행의 total hits와 export 수 설명 가능
- top-N relevance truncation 없음
- raw file 해시 존재
- 중복 표본 감사 통과
- 검색 누락 의심 sentinel에 대한 설명 존재
