# Project Map

새 세션에서 빠르게 진입하기 위한 파일 맵입니다. 길게 설명하지 않고, "어디를 먼저 열어야 하는지"만 적습니다.

생성/갱신 시각: 2026-03-23

## 1. 앱 진입점

- `app/page.tsx`
  - 메인 규칙 탐색 화면.
- `app/layout.tsx`
  - 루트 레이아웃.
- `app/globals.css`
  - 전역 스타일, 폰트 변수, 기본 테마.
- `app/api/rules/query/route.ts`
  - 결정적 규칙 엔진 API.
- `app/api/ai-explain/route.ts`
  - 선택적 AI 요약 API.
- `app/sources/page.tsx`
  - 출처 브라우저 목록 페이지.
- `app/sources/[id]/page.tsx`
  - 출처 상세 페이지.
- `app/rules/[id]/page.tsx`
  - 규칙 상세 페이지.

## 2. UI 컴포넌트

- `src/components/rule-explorer-client.tsx`
  - 메인 검색 폼, 결과 필터, 결과 목록.
- `src/components/rule-card.tsx`
  - 규칙 결과 카드.
- `src/components/source-browser-client.tsx`
  - 출처 목록 검색/필터 UI.

## 3. 엔진 / 로직

- `src/lib/safety-engine/index.ts`
  - 핵심 규칙 평가 엔진.
  - `runSafetyEngine()`이 최종 진입점.
  - `evaluateCondition()`, `evaluateRule()`이 분류 핵심.
- `src/lib/references.ts`
  - PubMed/DOI 링크 우선순위, 출처/근거 표시 보조 함수.
- `src/lib/knowledge/index.ts`
  - 서버 전용 knowledge index 로더와 browse/detail helper.
- `src/lib/knowledge/normalize.ts`
  - `data/` 원본을 런타임용 index로 정규화.
- `src/lib/ai/config.ts`
  - AI 사용 가능 여부, 환경 변수 설정.
- `src/lib/ai/schema.ts`
  - AI 요청/응답 schema.
- `src/lib/ai/explainSafetyResults.ts`
  - deterministic 결과를 AI 설명용 payload로 요약.

## 4. 타입 / 생성물

- `src/types/knowledge.ts`
  - Zod schema와 핵심 타입 정의.
  - `EngineQuery`, `RuleMatch`, `EngineResponse`, `KnowledgeIndex` 등.
- `src/generated/knowledge-index.json`
  - 앱이 실제로 읽는 단일 런타임 인덱스.
  - 수정하지 말고 `npm run prepare:knowledge`로 재생성.
  - `npm run dev` 중에는 `data/knowledge_pack.json` 저장 시 자동으로 다시 생성됨.

## 5. 데이터 원본

- `data/knowledge_pack.json`
  - 기본 단일 원본. 있으면 이 파일만 읽음.
  - 깨져 있거나 필수 섹션이 없으면 정규화가 실패함.
- `data/source_registry.json`
  - 레거시 분리 원본. `knowledge_pack.json`이 없을 때만 fallback으로 사용.
- `data/evidence_chunks.json`
  - 레거시 분리 원본. `knowledge_pack.json`이 없을 때만 fallback으로 사용.
- `data/ingredients.json`
  - 레거시 분리 원본. `knowledge_pack.json`이 없을 때만 fallback으로 사용.
- `data/safety_rules.json`
  - 레거시 분리 원본. `knowledge_pack.json`이 없을 때만 fallback으로 사용.
- `data/package_meta.json`, `data/manifest.json`
  - 패키지 메타데이터.
- `data/sample_evaluation_input.json`
  - 샘플 엔진 입력.
- `data/sample_user_profile.json`, `data/sample_engine_output.json`
  - 샘플 프로필/출력.

## 6. 스크립트 / 스키마 / 산출물

- `scripts/build-knowledge-index.ts`
  - 정규화 스크립트 실행 진입점.
- `schemas/*.schema.json`
  - 데이터/엔진 관련 JSON schema.
- `exports/*`
  - CSV/XLSX 형태의 내보내기 결과물.

## 7. 테스트

- `__tests__/safety-engine.test.ts`
  - 대표 규칙 매칭 회귀 테스트.
- `__tests__/fixture-scenarios.test.ts`
  - fixture 기반 시나리오 테스트.
- `__tests__/ai-explain.test.ts`
  - AI 설명 계층 테스트.
- `__tests__/fixtures/*.json`
  - 임신, 수유, 흡연, warfarin, quinolone 등 시나리오 fixture.

## 8. 문서

- `README.md`
  - 전체 개요와 실행 방법.
- `docs/source_map.md`
  - 출처 목록 요약.
- `docs/extension_guide.md`
  - 규칙/데이터 확장 체크리스트.
- `AGENTS.md`
  - 에이전트 작업 규칙.
- `CLAUDE.md`
  - 문서 진입 포인터.

## 9. 보통 작업 시작 순서

1. 화면 수정: `app/page.tsx` -> `src/components/rule-explorer-client.tsx` -> `src/components/rule-card.tsx`
2. 엔진 수정: `src/lib/safety-engine/index.ts` -> `src/types/knowledge.ts` -> 관련 테스트
3. 출처/근거 수정: 보통 `data/knowledge_pack.json` -> `src/lib/knowledge/normalize.ts`
   - 개발 서버에서는 저장 즉시 자동 반영, 수동 검증/배포 전에는 `npm run prepare:knowledge`
4. 출처 화면 수정: `app/sources/page.tsx` -> `src/components/source-browser-client.tsx` -> `app/sources/[id]/page.tsx`
5. AI 설명 수정: `app/api/ai-explain/route.ts` -> `src/lib/ai/*`

## 10. 작업 후 기본 확인

- `npm run prepare:knowledge`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- 필요 시 `npm run build`
