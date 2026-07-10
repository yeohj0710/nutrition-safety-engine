# 기존 자료 처리 원칙

## 상태 코드

- `historical_record`: 서명본, 피드백, 연구일지처럼 과정을 증명하는 기록
- `pilot_only`: 검색식 초안, 상위 N 표본, 초기 분류 실험
- `legacy_unverified`: 출처·원문·규칙 검증이 끝나지 않은 데이터
- `candidate_for_revalidation`: 원문부터 다시 확인하면 재사용 가능한 항목
- `superseded`: 새 연구에서 재생성되어 더 이상 분석에 쓰지 않는 항목
- `validated_current`: 새 프로토콜과 품질 기준을 통과한 현재 자료

## 파일군별 처리

| 파일군 | 기본 상태 | 허용 용도 | 금지 용도 |
|---|---|---|---|
| 서명 연구계획서 | historical_record | 주제 역사, 지도교수와의 합의 맥락 | 최종 프로토콜로 자동 간주 |
| 기존 논문 | superseded | 문제점과 양식 참고 | 문단 재사용, 결과 인용 |
| 검색식기록 | pilot_only | seed 논문 회수 검사, 용어 사전 | 최종 PRISMA 수치 |
| 전체후보문헌 236건 | candidate_for_revalidation | 새 검색과 중복 확인, gold seed | 최종 포함 문헌 |
| 핵심근거 10건 | candidate_for_revalidation | 원문 재검토 우선순위 | 원문 미확인 상태 규칙 근거 |
| 기존 knowledge pack | legacy_unverified | 마이그레이션 입력, 회귀 비교 | thesis mode 사용자 출력 |
| 기존 시나리오 5건 | pilot_only | 회귀 테스트 seed | 성능 지표의 분모 |
| 공개 배포 | historical_record | UI·범위 감사 | 최종 연구 결과 |

## 마이그레이션 규칙

1. 기존 레코드는 원래 ID와 파일 해시를 보존한다.
2. 새 ID를 부여할 때 `legacy_id`를 별도 필드에 둔다.
3. 원문과 대조하지 않은 값은 새 `validated` 필드로 승격하지 않는다.
4. 기존 분류나 규칙이 새 판단과 다르면 덮어쓰지 않고 변경 사유를 남긴다.
5. 앱에 보이는 데이터는 `validated_current`만 기본값으로 한다.
