# PRESS 동료검토 큐

상태: `pending_external_human_review`

검토자는 검색식 작성자와 다른 정보전문가 또는 체계적 문헌고찰 경험자여야 한다. 각 행에 `approve`, `return_with_edits`, `record_unavailable` 중 하나와 날짜·검토자 식별자를 기록한다. 단순히 “검토함”으로 닫지 않는다.

## 필수 확인

1. PICO와 검색 개념 대응
2. Boolean·괄호·필드 태그
3. MeSH/Emtree 폭발과 동의어
4. 약어 오탐과 누락
5. 불필요한 제한·필터
6. sentinel 회수
7. 플랫폼별 실제 실행 가능성
8. 결과 수와 학생 workload의 균형

현재 설계 파일럿은 A1/B2 workload 위험을 확인했다. 결과를 본 뒤 유리한 범위로 바꾸는 결정을 허용하지 않는다. 변경은 검색 전 PRESS 사유와 amendment로 고정한다.
