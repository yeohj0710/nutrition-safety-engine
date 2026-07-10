# Phase 1. 저장소·자료 감사와 격리

## 목적

현재 저장소와 연구 자료의 실제 상태를 증거로 확정하고, legacy와 새 연구 영역을 분리한다.

## Entry

- 재설계 패키지를 읽음
- repo와 자료 폴더에 읽기 접근 가능

## 작업

1. Git remote, branch, commit, tag, status, 최근 배포 기록
2. 파일·디렉터리 inventory와 SHA-256
3. package/dependency/Node/Python 환경
4. 현재 데이터 source→evidence→rule→UI 계보
5. 하드코딩된 숫자와 범위 문구 검색
6. 규칙 상태, 성분·상황 범위, 끊어진 참조
7. 테스트 명령 재실행과 실패 분석
8. 공개 배포 대표 입력 smoke test
9. 기존 CSV 수치 불일치 재현
10. `legacy_unverified` manifest 생성

## 산출물

- `research/audit/repo_inventory.json`
- `research/audit/data_lineage.md`
- `research/audit/deployment_baseline.json`
- `research/audit/hardcoded_counts_report.md`
- `research/audit/rule_scope_report.csv`
- `research/audit/test_gap_report.md`
- `data/legacy_unverified/manifest.json`

## 금지

- 기존 규칙을 validated로 일괄 표시
- 앱 숫자를 현재 연구 결과로 확정
- 감사 중 논문 본문을 다듬는 작업

## Exit

- 현재 HEAD와 생산 배포를 구분해 설명 가능
- 기존 데이터의 생성 경로를 추적 가능
- legacy가 새 bundle 기본 입력에서 제외됨
- 현재 테스트 결과가 새 로그에 있음
- 모든 치명적 공백이 risk/task에 등록됨
