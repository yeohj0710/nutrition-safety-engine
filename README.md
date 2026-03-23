# Nutrition Safety Rule Explorer

생성 시각: 2026-03-23

## 목적

이 프로젝트는 건강기능식품, 영양소, 허브 성분에 대한 안전 규칙을 **결정적 규칙 엔진**으로 조회하는 Next.js 앱입니다.

- 로컬 데이터만 사용합니다.
- 규칙 매칭은 재현 가능해야 합니다.
- AI는 선택적 설명 계층일 뿐, 규칙 판정 권한이 없습니다.
- 출처와 근거 청크를 항상 따라갈 수 있어야 합니다.

## 핵심 원칙

- deterministic engine = authoritative layer
- AI explanation = optional presentation layer
- reference data = local versioned assets
- no hidden magic

## 아키텍처

### 1. 데이터 레이어

- 원본 데이터 위치: `data/`
- 정규화 스크립트: `scripts/build-knowledge-index.ts`
- 런타임 인덱스: `src/generated/knowledge-index.json`
- 타입과 검증: `src/types/knowledge.ts`

정규화 결과는 아래 엔터티를 포함합니다.

- `KnowledgeSource`
- `EvidenceChunk`
- `SafetyRule`
- `RuleCondition`
- `RuleOutcome`
- `PersonProfile`
- `EngineQuery`
- `RuleMatch`
- `EngineResponse`

### 2. 결정적 규칙 엔진

- 위치: `src/lib/safety-engine/`
- 입력: `EngineQuery`
- 출력: `EngineResponse`
- 분류:
  - `definitely_matched`
  - `possibly_relevant`
  - `needs_more_info`
  - `excluded`

엔진은 다음 원칙으로 동작합니다.

- 입력이 비어 있다고 해서 자동 배제하지 않습니다.
- 특정 필드가 반드시 필요한 규칙인데 값이 없으면 `needs_more_info`로 보냅니다.
- 수치 비교, 임신/수유/흡연, 약물/질환 상호작용, 제형 조건은 모두 코드로만 평가합니다.
- 정렬과 필터는 결과 표현 계층에서만 적용합니다.

### 3. AI 설명 계층

- 위치: `src/lib/ai/`
- 서버 라우트: `app/api/ai-explain/route.ts`
- 사용 SDK: 공식 `openai` 패키지
- API: Responses API + Structured Outputs

AI 계층은 이미 계산된 `EngineResponse`의 축약본만 입력으로 받습니다.

- matched / possibly relevant / needs more info 규칙 일부
- source title
- 짧은 evidence excerpt
- deterministic reason

AI는 절대 다음을 하지 않습니다.

- 규칙 매칭 판정
- threshold 변경
- severity 변경
- contraindication / interaction 변경
- 숫자값 보정

AI가 실패하면 앱은 그대로 결정적 결과만 보여 줍니다.

## 데이터 흐름

1. `data/`의 원본 파일을 정규화 스크립트가 읽습니다.
2. 스크립트가 `src/generated/knowledge-index.json`을 생성합니다.
3. 서버 전용 로더가 인덱스를 Zod로 검증합니다.
4. `/api/rules/query`가 `EngineQuery`를 받아 결정적 엔진을 실행합니다.
5. 클라이언트는 결과 카드, 근거 패널, 필터를 렌더링합니다.
6. 사용자가 AI 설명을 켜면 `/api/ai-explain`이 최소 payload만 모델에 전달합니다.

## 폴더 가이드

```text
app/
  api/
    ai-explain/
    rules/query/
  rules/[id]/
  sources/
  sources/[id]/
src/
  components/
  generated/
  lib/
    ai/
    knowledge/
    safety-engine/
  types/
scripts/
__tests__/
  fixtures/
```

## 환경 변수

- `OPENAI_API_KEY`
  - 선택 사항입니다.
  - 서버에서만 읽습니다.
  - 없으면 AI 설명 기능은 자동으로 비활성 fallback 응답을 반환합니다.

## 설치와 실행

```bash
npm install
npm run dev
```

주요 명령:

```bash
npm run prepare:knowledge
npm run typecheck
npm run lint
npm run test
npm run build
```

## 정규화 플로우

1. `knowledge_pack.json`이 있으면 우선 사용합니다.
2. 없으면 개별 source / evidence / rules 파일을 읽습니다.
3. 스크립트가 공통 스키마로 정규화합니다.
4. Zod 검증 후 `knowledge-index.json`을 생성합니다.
5. 앱 런타임은 이 단일 JSON 인덱스만 사용합니다.

## 테스트 전략

### 단위 테스트

- 결정적 엔진의 대표 규칙 매칭
- 제형 정보 누락 시 `needs_more_info`
- 일반 참고 규칙의 `possibly_relevant`

### fixture 시나리오

`__tests__/fixtures/`에 실제 데모용 프로필 시나리오를 넣었습니다.

- 32세 여성, 임신 중, 비타민 A 관련 주의
- 29세 여성, 수유 중
- 55세 남성, 흡연자, beta-carotene 관련 주의
- 68세 남성, warfarin 복용, vitamin K 관련 상호작용
- 61세 여성, thiazide 복용, vitamin D/calcium 관련 주의
- 47세 남성, quinolone 항생제 복용, magnesium/calcium/iron 간격 주의
- 정보 부족 케이스: 나이/성별 미입력

이 시나리오는 결정적 분류가 안정적으로 유지되는지 검증합니다.

## UI 가이드

- `/`
  - 좌측: 프로필 및 필터
  - 우측: AI 정리 + 근거 규칙 원문
- `/sources`
  - 검색, 관할권, 근거 수준 필터
- `/sources/[id]`
  - 출처 상세, 연결 규칙, 연결 근거 청크
- `/rules/[id]`
  - 규칙 상세, 지원 출처, 지원 근거 청크

## 안전 제한 사항

- 의학적 진단 도구가 아닙니다.
- 복용 여부의 최종 결정은 임상의 판단을 대체하지 않습니다.
- 로컬 데이터에 없는 최신 규제 변경은 반영되지 않을 수 있습니다.
- free-text memo는 안전한 exact keyword 보조 용도로만 다룹니다.

## 새 출처/규칙 추가 방법

1. `data/`에 새 출처와 근거 청크를 추가합니다.
2. 성분 사전에 alias / category / form을 보완합니다.
3. `safety_rules` 원본에 새 규칙을 추가합니다.
4. `npm run prepare:knowledge`로 정규화 인덱스를 다시 생성합니다.
5. fixture 또는 단위 테스트를 추가합니다.
6. `/sources`와 `/rules/[id]`에서 연결이 잘 보이는지 확인합니다.

## Vercel 배포 메모

- 이 프로젝트는 DB 없이 정적 자산 + 서버 라우트로 동작합니다.
- `OPENAI_API_KEY`는 Vercel 프로젝트 환경 변수에만 설정합니다.
- 서버 전용 로더와 route handler에서만 비밀값을 접근합니다.
- `npm run build`가 배포 전 최종 게이트입니다.

## 남겨둘 만한 개선 후보

- Lighthouse 및 실제 모바일 기기 점검
- source title / evidence excerpt 하이라이트
- 더 많은 fixture 시나리오와 회귀 테스트
- 배포 환경 로그 연동
