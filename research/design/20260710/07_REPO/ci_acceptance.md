# CI와 릴리스 승인 기준

## Pull request 필수 검사

```text
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run test:contract
npm run test:provenance
npm run test:scenarios:smoke
npm run build
python tools/validate_research_bundle.py <research-root>
```

실제 저장소 명령에 맞춰 package scripts를 구현한다.

## Release candidate 추가 검사

- 전체 gold scenario 실행
- critical false negative 0
- thesis scope에 legacy rule 0
- evidence link 무결성 100%
- API/UI 일치
- 프로덕션 빌드 smoke test
- release manifest 생성
- 데이터와 코드 tag 생성

## 보호 규칙

- generated 파일만 바뀌고 source 데이터가 바뀌지 않은 PR 금지
- 스키마 변경 시 migration과 version bump 필수
- 규칙 변경 시 관련 시나리오 추가 또는 수정 필수
- 임계값 변경 시 source/claim 근거 필수
- CI 우회 merge 금지

## 배포 후 확인

- 배포 commit과 release manifest 일치
- 대표 시나리오 5개 smoke test
- 사용자 화면에 bundle version 표시 또는 감사 화면에서 확인 가능
- 오류 로그에 건강정보가 남지 않는지 확인
