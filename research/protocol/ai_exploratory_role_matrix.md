# AI 탐색 연구 역할·권위 경계

실행 모드: `ai_exploratory`

| 작업 | 실행 주체 | decision_authority | 허용 출력 | prohibited |
|---|---|---|---|---|
| 검색자료 정규화 | 결정론적 코드 | source transformation | 해시·식별자·검색단위 | 최종 검색 승인 주장 |
| 중복 후보 생성 | 결정론적 코드 | candidate grouping only | 동일 식별자·제목 후보 | 사람의 동일 연구 판정 |
| 문헌 분류 | 두 자동 프로필 | none | retain/deprioritize/disagreement | 사람 include/exclude, PRISMA 수치 |
| 자동 추출 | AI·결정론적 parser | none | 직접 관찰값·locator·불확실성 | 미관찰 수치 추정, 사람 검증 주장 |
| 기술적 합성 | 결정론적 코드 | descriptive only | 분포·접근성·재현성 | 메타분석, RoB, GRADE, 임상 결론 |
| 잠정 주장 | AI 구조화 | provisional only | source-bound 탐색 문장 | validated claim 승격 |
| 엔진 검증 | 합성 fixture·테스트 | software behavior only | 결정성·계보·금지행동 누출 | 독립 gold·임상 성능 주장 |

모든 v1 사람 검토 파일은 보존한다. 비어 있는 사람 필드를 AI 값으로 채우지 않으며, v2 완료를 사람 검토 완료로 표시하지 않음이 불변조건이다.

