# 저장소 감사 범위와 첫 작업

## 현재 확인된 사실

- 저장소: `yeohj0710/nutrition-safety-engine`
- 프레임워크: Next.js
- 공개 배포: `nutrition-safety-engine.vercel.app`
- 감사 시점 생산 배포는 정상 응답
- ZIP의 작업 메모가 가리키는 주요 경로:
  - `data/knowledge_pack.json`
  - `src/lib/safety-engine/index.ts`
  - `scripts/build-knowledge-index.ts`
  - `src/generated/knowledge-index.json`
  - `src/components/rule-explorer-client.tsx`
  - `docs/project_map.md`

## 소스 수준에서 반드시 확인할 항목

1. 실제 HEAD, 기본 브랜치, 태그, dirty 상태
2. 데이터가 생성되는 단일 원천과 하드코딩된 수치
3. 규칙 상태가 런타임 필터에 반영되는지
4. 생성형 AI 호출이 런타임 경로에 있는지
5. 사용자 입력 파싱과 단위 변환
6. alias 충돌, 부분 문자열 일치, 부정문 처리
7. rule priority와 여러 규칙 충돌 처리
8. evidence/source 링크 무결성
9. API 응답과 화면의 데이터 계약
10. 테스트가 실제 연구 범위와 중대한 거짓 음성을 포착하는지
11. 환경변수, 비밀키, 개인정보 로그
12. 배포에서 생성 데이터가 최신인지

## Gate 0 산출물

- `repo_inventory.json`
- `dependency_audit.md`
- `data_lineage.md`
- `hardcoded_counts_report.md`
- `rule_scope_report.csv`
- `test_gap_report.md`
- `deployment_baseline.json`

## 주의

기존 작업 메모의 테스트 통과 기록은 2026년 6월 상태다. 최신 커밋에 대한 검증으로 간주하지 않는다. Codex는 현재 저장소를 새로 열고 모든 명령을 다시 실행해야 한다.
