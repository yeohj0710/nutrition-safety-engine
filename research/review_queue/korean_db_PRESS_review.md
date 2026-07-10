# 국내 데이터베이스 PRESS 검토 안내

상태: `pending_external_human_review`

대상은 `korean_db_PRESS_review.csv`의 KMbase 20행과 RISS 20행이다. 각 행은 설계 파일럿 응답 원본의 SHA-256에 연결된다. 검토자는 검색 실행자와 독립된 정보전문가 또는 체계적 문헌고찰 경험자여야 한다.

## 검토 순서

1. 질문별 PICO와 짧은 population/exposure 쌍의 대응을 확인한다.
2. 플랫폼의 implicit operator, 문구 처리, 한글·영문 동의어, 하이픈과 약어 동작을 실제 검색에서 확인한다.
3. `sentinel_set.csv`의 알려진 문헌이 플랫폼에 존재하는 경우 회수되는지 확인한다.
4. KMbase의 20개 0건은 부재로 승인하지 않는다. 양성대조 5건과 모순되므로 구문·색인·범위를 먼저 판정한다.
5. RISS의 분할 검색 결과는 중복되므로 건수를 합산하지 않는다.
6. 승인 또는 수정 후 새로운 final run ID로 전체 native export를 실행한다. 현재 파일럿은 final search가 아니다.

## 사람 전용 기록

`reviewer_id`, `reviewed_at`, `decision`, `comments`, `required_revision`은 자동화가 채우지 않는다. `decision`은 각 행의 `allowed_decisions` 중 하나만 사용한다.
