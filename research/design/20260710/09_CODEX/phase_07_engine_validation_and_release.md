# Phase 7. 엔진 개편, 독립 검증, 배포

## 목적

검증된 규칙만 사용하는 결정적 엔진을 만들고, 독립 gold 시나리오와 전문가 검토로 평가한다.

## Entry

- claim/rule registry source-verified
- repo target architecture 승인

## 작업

1. curated data와 generated bundle 분리
2. 입력 정규화·단위·alias 개편
3. scope/validation filter 구현
4. deterministic action prioritization
5. provenance resolver
6. unit/contract/provenance tests
7. 독립 120 scenario gold 작성·잠금
8. full engine validation
9. 오류 심각도 분석과 수정
10. 모든 critical/major 오류 regression test
11. 전문가 내용 검토와 해결
12. 조건부 사용성, 승인 시만
13. UI/API E2E
14. release manifest와 production deploy
15. post-deploy smoke test

## 산출물

- refactored repository
- test reports
- locked scenario gold
- validation metrics and CIs
- expert review results
- release bundle, tag, manifest
- production deployment record

## Exit

- critical FN 0 또는 release 보류와 투명한 실패 보고
- provenance 100%
- determinism 100%
- thesis mode legacy 0
- CI 전체 통과
- 배포 commit과 manifest 일치
