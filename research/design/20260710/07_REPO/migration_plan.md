# 기존 데이터와 코드 마이그레이션 계획

## 0. 동결

- 현재 기본 브랜치, 생산 커밋, 데이터 파일 해시를 기록한다.
- `legacy-baseline-YYYYMMDD` tag를 만든다.
- 기존 데이터는 `data/legacy_unverified`로 복사하거나 manifest로 참조한다.

## 1. 프로파일링

- source, evidence chunk, ingredient, rule 수
- 중복 ID와 끊어진 참조
- scope 밖 성분
- 원문 locator 유무
- validation status 유무
- 하드코딩된 홈페이지 수치

## 2. ID 매핑

`legacy_source_id`, `legacy_rule_id`를 보존한다. 새 ID는 의미 있는 안정 ID로 생성한다. 기존 ID를 새 검증 상태로 자동 승격하지 않는다.

## 3. source/report/study 분리

기존 `source`가 논문, 기관 페이지, evidence chunk를 혼합했는지 확인한다. 서지 출처와 추출 주장, 연구 단위를 분리한다.

## 4. claim 재작성

기존 evidence chunk마다:

1. 원문 확보
2. 정확한 인용과 위치 확인
3. 대상·노출·결과 범위 확정
4. claim 작성
5. 두 번째 사람 검증

통과하지 못한 chunk는 legacy에 남긴다.

## 5. rule 재작성

기존 규칙을 그대로 복사하지 않는다. 검증된 claim에서 새 규칙을 작성하고, 기존 규칙은 회귀 비교에만 사용한다.

## 6. 엔진 병렬 운영

- `legacy_engine`
- `validated_engine`

같은 시나리오로 비교하고 차이를 기록한다. 새 엔진이 성능 기준을 통과할 때 기본값을 전환한다.

## 7. UI 전환

검색 hit, 후보문헌, 규칙 수를 첫 화면 품질 지표로 사용하지 않는다. 사용자 결과와 연구 감사 정보를 분리한다.

## 8. 폐기

새 release 후에도 legacy를 즉시 삭제하지 않는다. 재현성과 비교를 위해 read-only로 보존한다. 공개 배포에서는 접근되지 않게 한다.
