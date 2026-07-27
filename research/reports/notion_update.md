# 졸업논문 연구 현황 (v3.0 트랙)

## 현재 상태 (2026-07-28 갱신)

연구 질문과 검색식 정의부터 문헌 선별, 참조 판정, 한국어 번역, 논문 집필까지 전 과정을 AI 가 수행하는 v3.0 트랙을 구축하고 산출물을 확정했다. 사람이 정의한 v2.1 트랙은 지우지 않고 비교 트랙으로 보존했다.

- 선별 커버리지 100% (2,209/2,209행)
- 사람의 연구 의사결정 0건
- 사이트를 https://nutrition-safety-engine.vercel.app 에 배포했고 공개 응답이 v3.0 근거를 반환하는 것을 확인했다

## 핵심 수치

| 항목 | 값 |
| --- | --- |
| 질문 수 | 5 |
| 코퍼스(레코드-질문 단위) | 2,209 |
| 고유 문헌 | 2,168 |
| 초록 보유 / 제목만 | 1,968 / 241 |
| 선별 retain / deprioritize / uncertain | 1,705 / 461 / 43 |
| 참조표준 표본 / unresolved | 300 / 0 |
| sensitivity_vs_ai_reference | 0.987 (95% CI 0.968–1.000) |
| specificity_vs_ai_reference | 0.516 (95% CI 0.466–0.575) |
| agreement_vs_ai_reference | 0.785 |
| 겉보기 retain 규모 | 1,705 |
| Rogan–Gladen 보정 retain 규모 | 1,264 (95% CI 1,165–1,359) |
| 근거 번들 kept / 핵심 근거 / 개인화 규칙 / 번역 | 1,353 / 75 / 35 / 75 |

## 설계 주장 네 가지

**1. AI 가 PICOS 와 검색식을 정한다 — 참**

질문 5개와 PubMed 검색식을 AI 에이전트(OpenAI Codex GPT-5)가 정의했고 이 단계의 사람 판정은 0건이다. 정의 프롬프트 SHA-256 b8fd37a2463eab37b24e45174ae29c06f45450d92d9606cbdc50e82a6838e510, 정의 결과 SHA-256 70e4749529fb2ad9db6bf7c7c45456b9761d7958a27ee728371ae68015f3912f. 정의 입력에서 기존 질문 목록, 기존 검색식 초안, 기존 검색 결과 수치를 명시적으로 배제했다.

증거: `research/searches_v3/ai_picos/picos_definition.json`, `research/searches_v3/ai_picos/prompt.txt`, `data/curated_v3/corpus_manifest.json`

**2. PubMed 만 쓴다 — 참**

코퍼스 자료원 분포는 pubmed 2,209건이며 비-PubMed 행은 없다. source_constraint 는 pubmed_only다.

증거: `data/curated_v3/corpus_manifest.json`, `data/curated_v3/evidence_map.csv`

**3. 검색된 문헌 100% 를 AI 가 선별한다 — 참**

코퍼스 2,209행 전량을 판정해 커버리지 100%를 달성했다. 판정 주체는 agent_direct이며 선별용 모델 호출 0회, 외부 API 호출 0회, 사람 판정 0건이다.

증거: `research/screening/v30_agent/manifest.json`, `data/curated_v3/llm_screening_classifications.csv`

**4. AI 가 고른 문헌으로 개인 맞춤 요약을 만든다 — 참**

선별 라벨을 게이트로 적용해 근거 번들 1,353행, 핵심 근거 75건, 개인화 규칙 35건, 한국어 번역 75건을 생성했고 공개 API 응답의 evidence_lineage.track 이 v3.0_full_ai_autonomy 로 고정된다. 다만 별칭별 후보 근거 수가 적은 질문이 있어 근거 폭은 선행 트랙보다 좁다.

증거: `research/systematic_review_v30/core_manifest.json`, `research/systematic_review_v30/validation.json`, `research/systematic_review_v30/personalized_rules.json`

## 방법 요약

1. AI 가 질문 5개와 PubMed 검색식을 정의했다(프롬프트 SHA-256 `b8fd37a2463eab37b24e45174ae29c06f45450d92d9606cbdc50e82a6838e510`).
2. 2026-07-26T16:36:28+00:00 에 검색을 실행해 코퍼스 2,209행을 만들었다.
3. 에이전트가 2,209행 전량을 직접 판정했다. 선별용 모델 호출 0회, 외부 API 호출 0회.
4. 층화 표본 300건을 블라인드 상태로 3라운드 축 채점하고 코드 규칙으로 참조 라벨을 도출했다.
5. 층화 가중과 Rogan–Gladen 보정, 층화 부트스트랩 10,000회로 코퍼스 규모를 추정했다.
6. 근거 번들과 개인화 규칙을 재생성하고 한국어 번역 75건을 직접 작성했다.

## 경계와 한계

- `ai_reference_standard` 는 사람 gold standard 가 아니다. 보고한 값은 임상 정확도가 아니라 `ai_cross_checked` 결과다.
- 분류기와 참조 판정을 같은 모델이 수행해 독립성이 부분적이다. 특히 라운드 2·3 은 축 셀 0/1500 만 달라 사실상 재현이었다.
- 자료원은 pubmed_only 하나뿐이다.
- 원문 위치 확보 0건. 읽지 않은 원문으로 해석을 넓히지 않았다.
- PRISMA 최종 포함·제외 수, 메타분석, 통합 효과크기, RoB·GRADE, 임상 권고는 만들지 않았다.

## 코드·빌드 상태

- `npm run typecheck` 통과, `npm run lint` 통과, `npm test` 통과, `npm run build` 통과
- `research/systematic_review_v30/validation.json` 의 valid = true
- **배포 완료.** https://nutrition-safety-engine.vercel.app (배포 ID dpl_A2dXBwXXA8D4sha3StyBcRrev3eW). 공개 API 응답의 `evidence_lineage.track` 이 `v3.0_full_ai_autonomy` 로 확인됐다.

## 공식 문서 위치

- 논문: `research/thesis/thesis_v30.docx`, `research/thesis/thesis_v30.pdf`
- G 드라이브: `02_졸업논문\여형준_졸업논문_최종본.docx` / `.pdf` (기존 파일은 `_v21백업` 으로 보존)
- 프로토콜: `research/protocol/protocol-v3.0-full-ai.md`
- 참조표준 결과: `research/synthesis/screener_vs_ai_reference_v3.json`
- 트랙 비교: `research/synthesis/picos_track_comparison.json`
- 발표 원고: `research/reports/발표원고_v3.0.md`

## 다음 단계

1. 사람 2인 이상이 같은 층화 표본을 독립 판정해 기준 정답을 만든다. 그 뒤에야 민감도·특이도를 임상적 의미로 해석할 수 있다.
2. 자료원을 PubMed 밖으로 확장한다.
3. 원문 접근이 가능한 부분집합에서 초록 기반 판정과 원문 기반 판정의 차이를 측정한다.
4. 별칭별 근거 폭이 좁은 질문을 확인하고 검색식 확장 여부를 판단한다.
