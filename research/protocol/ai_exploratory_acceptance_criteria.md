# Protocol v2 AI 탐색 연구 완료 기준

## 연구 경계

- [x] v1 기록과 사람 검토 큐를 삭제·수정하지 않는다.
- [x] v2가 체계적 문헌고찰이 아님을 명시한다.
- [x] 사람 선별·합의·GRADE·임상 검증을 주장하지 않는다.
- [ ] 모든 v2 산출물이 별도 경로·상태·manifest를 가진다.

## 검색·분류

- [x] 실제 확보한 검색 원본과 해시만 사용한다.
- [x] 19,961 PubMed record-question unit을 누락 없이 분류한다.
- [x] 자동 분류는 `retain/deprioritize/disagreement`만 사용한다.
- [x] PRISMA 최종 포함·제외 수를 만들지 않는다.
- [x] ClinicalTrials.gov·KoreaMed 단위를 v2 비순위 후보 체계로 통합한다.

## 추출·합성

- [x] 관찰값·초록값·미관찰값을 분리한다.
- [x] 모든 지도 행에 원자료 해시와 가능한 locator를 연결한다.
- [x] 기술 분포만 생성하고 효과 통합·RoB·GRADE를 수행하지 않는다.
- [x] 접근하지 못한 자료를 근거 부재로 해석하지 않는다.

## 주장·엔진

- [x] v2 잠정 주장이 `validated_thesis_scope`로 승격되지 않는다.
- [x] 도구가 복용·용량·중단·의뢰 임상행동을 출력하지 않는다.
- [x] v2 출력의 legacy_unverified 누출 0건이다.
- [x] 동일 입력 결정성 100%, 계보 완전성 100%다.

기술 검증 결과: 합성 fixture 120개를 각 3회 실행했고 exact question routing 120/120, 결정성 120/120, 계보 완전성 120/120, 임상행동·legacy 누출·near-match 오경로는 모두 0이었다. 이는 독립 gold 또는 임상 성능평가가 아니다.

## 논문·재현성

- [ ] 자연스러운 한국어 DOCX/PDF가 v2 설계와 일치한다.
- [ ] 모든 수치가 코드에서 재생성된다.
- [ ] DOCX/PDF 전 페이지 시각검사가 통과한다.
- [ ] 최종 manifest, clean commit, 로컬 런타임 검증이 통과한다.
