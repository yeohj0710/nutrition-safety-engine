# Nutrition Safety Rule Explorer

생성 시각: 2026-03-23

## 목적

이 프로젝트는 건강기능식품, 영양소, 허브 성분에 대한 안전 규칙을 **결정적 규칙 엔진**으로 조회하는 Next.js 앱입니다.

- 로컬 데이터만 사용합니다.
- 규칙 매칭은 재현 가능해야 합니다.
- AI는 선택적 설명 계층일 뿐, 규칙 판정 권한이 없습니다.
- 출처와 근거 청크를 항상 따라갈 수 있어야 합니다.

## 빠른 진입

새 세션에서 바로 작업을 시작하려면 먼저 `docs/project_map.md`를 보세요.

- 화면 진입점: `app/page.tsx`
- 메인 UI: `src/components/rule-explorer-client.tsx`
- 결과 카드: `src/components/rule-card.tsx`
- 엔진 핵심: `src/lib/safety-engine/index.ts`
- 데이터 로더: `src/lib/knowledge/index.ts`
- 원본 데이터: `data/*.json`
- 테스트: `__tests__/`

## 핵심 원칙

- deterministic engine = authoritative layer
- AI explanation = optional presentation layer
- reference data = local versioned assets
- no hidden magic

여기서 말하는 AI는 **런타임 설명 계층**입니다. 실행 중에 규칙을 바꾸거나 판정을 내리지
않습니다. 문헌을 고르는 **빌드 시점의 LLM 분류 층**은 아래 연구 파이프라인에 따로 있습니다.

## 연구 파이프라인 (protocol v2.1 동결 비교 트랙)

```
PubMed 검색 (질문 5개, 확정 2026-07-13, 원본 XML + 체크섬 보존)
  └ data/curated_v2/evidence_map.csv            20,230 레코드-질문 / 초록 보유 18,015
       ├─ 규칙 기반 이중 프로파일 분류            ai_screening_classifications.csv
       │     tools/build_ai_exploratory_screening.py   (deterministic_dual_profile_v1)
       └─ LLM 탐색 분류                          llm_screening_classifications.csv
             tools/llm_screening.py
                  └ 방식 간 일치·불일치 비교      tools/compare_screening_methods.py
                       └ 정규식 PICOS 추출 + LLM 게이트   tools/build_systematic_review_v3.py
                            └ core evidence      tools/build_core_evidence_v3.py
                                 └ 개인화 규칙 → 웹 UI
```

- 라벨은 `retain` / `deprioritize` / `uncertain` 입니다. 사람의 include·exclude가 아닙니다.
- 사람 gold standard가 없으므로 **민감도·특이도 등 정확도 지표를 산출하지 않습니다**
  (`research/protocol/protocol-v2.0-ai-exploratory.md` §9). 자동 방식 간 일치도만 보고합니다.
- 자세한 내용은 `research/protocol/v2.1-measured-screening-plan.md`를 보세요.

재생성 명령:

```bash
python tools/llm_screening.py                  # LLM 분류 (재개 가능)
python tools/compare_screening_methods.py      # 방식 간 일치도
python tools/build_systematic_review_v3.py     # PICOS 추출 + LLM 게이트
python tools/build_core_evidence_v3.py         # core evidence
npm run prepare:knowledge                      # 앱이 읽는 번들 재생성
```

## 신규 연구 파이프라인 (protocol v3.0 AI 자율 트랙)

v3.0 트랙은 v2.1의 질문, 검색식, 코퍼스와 분리되어 있습니다. v2.1 산출물을 덮어쓰지
않으며, 각 단계의 입력 해시와 실행 기록을 별도 경로에 보존합니다.

```text
research/protocol/protocol-v3.0-full-ai.md
  └ research/searches_v3/                       독립 PICOS·검색식·PubMed 원문·검색 로그
       └ data/curated_v3/evidence_map.csv       독립 코퍼스
            └ research/screening/v30_agent/     에이전트 직접 선별 실행·감사 기록
                 └ data/curated_v3/llm_screening_classifications.csv
                      └ research/validation/screening_ai_reference_v3/
                           └ research/synthesis/screener_vs_ai_reference_v3.json
                                └ research/systematic_review_v30/
                                     ├ core_evidence.csv
                                     ├ key_finding_translations_ko.json
                                     └ personalized_rules.json
                                          ├ research/reports/
                                          └ research/thesis/
```

- `research/systematic_review_v30/`은 PICOS 추출, AI 게이트, 핵심 근거, 한국어 번역,
  개인화 규칙과 각 산출물의 manifest를 보관합니다.
- `research/reports/`는 발표 원고와 업데이트 문서를, `research/thesis/`는 논문 원본과
  PDF를 보관하는 canonical 경로입니다.
- AI 참조표준 비교값은 임상적 정확도가 아닙니다. 필드명은
  `sensitivity_vs_ai_reference`, `specificity_vs_ai_reference`,
  `agreement_vs_ai_reference`, `ai_reference_standard`, `ai_cross_checked`를 그대로 씁니다.

현재 산출물 검증과 근거 번들 재생성 명령:

```bash
python tools/v30/pubmed_v3.py validate                     # 검색·코퍼스 무결성
python tools/v30/agent_screen_batches.py verify            # 선별 커버리지 100% 확인
python tools/v30/agent_reference_sample.py stats           # 참조표준 지표 재계산
npm run validate:v30-evidence
```

새 검색부터 다시 실행할 때의 순서는 다음과 같습니다.

```bash
python tools/v30/pubmed_v3.py probe
python tools/v30/pubmed_v3.py fetch
python tools/v30/pubmed_v3.py validate

# 선별: 배치를 만들고 에이전트가 직접 판정한 뒤 커버리지를 검증한다.
python tools/v30/agent_screen_batches.py batch --view-dir <작업폴더>
python tools/v30/agent_screen_batches.py collect
python tools/v30/agent_screen_batches.py verify
python tools/v30/agent_screen_batches.py finalize

# 참조표준: 층화표본을 뽑고 라운드별로 축을 채점한 뒤 다수결·통계를 낸다.
python tools/v30/agent_reference_sample.py sample
python tools/v30/agent_reference_sample.py rounds --round 1 --view-dir <작업폴더>
python tools/v30/agent_reference_sample.py collect --round 1
python tools/v30/agent_reference_sample.py vote
python tools/v30/agent_reference_sample.py stats --iterations 10000

npm run build:v30-evidence
npm run validate:v30-evidence
```

선별과 참조표준 채점은 스크립트가 판정을 생성하지 않습니다. 스크립트는 배치와
블라인드 뷰를 만들고, 에이전트가 쓴 판정 파일을 수집·검증·집계하는 역할만 합니다.

## 아키텍처

### 1. 데이터 레이어

- 원본 데이터 위치: `data/`
- 정규화 스크립트: `scripts/build-knowledge-index.ts`
- 런타임 인덱스: `src/generated/legacy/knowledge-index.json`
  - 이 인덱스 파일은 저장소에 커밋되어 있으며, `build` 스크립트(`next build`)는 이 파일을 다시 생성하지 않습니다.
  - `data/`를 수정했다면 빌드 전에 반드시 `npm run prepare:knowledge`를 실행해 인덱스를 재생성하세요. 그러지 않으면 빌드된 앱이 오래된 인덱스를 그대로 서빙합니다.
  - `npm run dev`의 감시자는 `data/knowledge_pack.json` 저장 시 재생성을 트리거하지만, 실제 입력은 `data/legacy_unverified/baseline-33658e3/` 스냅샷으로 고정되어 있습니다. 앱에 반영하려면 이 스냅샷 쪽을 수정해야 합니다.
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

- 서버 라우트: `app/api/personalized-safety/route.ts`
- 지원 모듈: `src/lib/multi-value-input.ts`, `src/lib/personalized-safety-examples.ts`, `research/systematic_review_v30/personalized_rules.json`
- 사용 방식: 별도 SDK 없이 `fetch`로 OpenAI Responses API(`https://api.openai.com/v1/responses`)를 직접 호출합니다. `openai` npm 패키지는 의존성에 없습니다.
- API: Responses API + Structured Outputs(json_schema)

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
2. 스크립트가 `src/generated/legacy/knowledge-index.json`을 생성합니다.
   - 개발 서버(`npm run dev`)에서는 이 생성 과정이 자동 감시됩니다.
3. 서버 전용 로더가 인덱스를 Zod로 검증합니다.
4. `/api/rules/query`가 `EngineQuery`를 받아 결정적 엔진을 실행합니다.
5. 클라이언트는 결과 카드, 근거 패널, 필터를 렌더링합니다.
6. 사용자가 AI 설명을 켜면 `/api/personalized-safety`가 최소 payload만 모델에 전달합니다.

## 폴더 가이드

```text
app/
  api/
    personalized-safety/
    rules/query/
  rules/[id]/
  sources/
  sources/[id]/
src/
  components/
  generated/
  lib/
    knowledge/
    safety-engine/
    personalized-safety-examples.ts
    multi-value-input.ts
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

### Python 환경

Python 리서치/검색 파이프라인(`tools/`, `tools/search_pipeline/`)은 Next.js 앱과 분리되어 동작합니다.

- `requirements.txt`: 체계적 문헌 검색 파이프라인의 기본 의존성(`requests`, `rispy`, `playwright` 등). 파이프라인을 실행하려면 이 파일을 설치합니다.
- `requirements-research.lock.txt`: 리서치/논문 검증 도구 체인을 재현하기 위한 고정(pinned) 잠금 파일.
- `requirements-v3.txt`: systematic review v3 산출물(문서·PDF 생성 등) 검증용 고정 의존성.

## 정규화 플로우

1. `data/knowledge_pack.json`이 있으면 그 파일만 단일 원본으로 사용합니다.
2. `knowledge_pack.json`이 깨져 있거나 필수 섹션이 빠져 있으면 즉시 실패합니다.
3. `knowledge_pack.json`이 아예 없을 때만 개별 source / evidence / rules 파일을 레거시 fallback으로 읽습니다.
4. 스크립트가 공통 스키마로 정규화합니다.
5. Zod 검증 후 `src/generated/legacy/knowledge-index.json`을 생성합니다.
6. 앱 런타임은 이 생성된 단일 JSON 인덱스만 사용합니다.

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
4. 개발 중에는 저장만 해도 자동 반영되고, 수동 검증이나 배포 전에는 `npm run prepare:knowledge`로 다시 생성합니다.
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
