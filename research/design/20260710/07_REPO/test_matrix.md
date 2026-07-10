# 테스트 매트릭스

| 영역 | 테스트 | 예시 | 실패 시 |
|---|---|---|---|
| schema | 모든 curated 파일 유효성 | required field, enum, ID pattern | build 중단 |
| referential integrity | rule→claim→source/report 존재 | dangling claim_id | build 중단 |
| scope | thesis bundle에 legacy 없음 | legacy_unverified count=0 | build 중단 |
| units | 변환 정확성 | 4000 IU D = 100 microgram | build 중단 |
| aliases | 정확한 정규화 | fish oil, 어유, EPA/DHA | 회귀 수정 |
| false positives | 부분 문자열 방지 | EPA in unrelated acronym | build 중단 |
| conditions | 경계값 | just below/at/above threshold | 수정 |
| exclusions | 예외 조건 | dietary calcium vs supplement | 수정 |
| conflicts | 여러 규칙 우선순위 | urgent > review > info | 수정 |
| determinism | 반복 canonical JSON | same input 100 runs | build 중단 |
| provenance | 메시지를 claim이 지지 | human audit sample | release 중단 |
| scenario | gold set 성능 | critical FN | release 중단 |
| API contract | 응답 스키마 | Zod/JSON Schema | build 중단 |
| UI/API | 같은 규칙·수치 | Playwright | release 중단 |
| accessibility | keyboard/labels/contrast | automated + manual | 수정 |
| privacy | health input logging 없음 | log inspection | release 중단 |
| build | lint/typecheck/test/build | CI | merge 중단 |

## 테스트 수준

### Unit

정규화, 단위 변환, 조건 평가, 우선순위, 메시지 렌더링.

### Contract

데이터 스키마, API, generated bundle.

### Provenance

모든 규칙의 claim/source 경로와 원문 locator.

### Golden scenario

잠긴 시나리오 정답과 비교.

### Regression

발견된 모든 critical/major 오류를 영구 테스트로 추가.

### E2E

대표 입력을 UI에 넣고 API·화면·근거 링크를 확인.
