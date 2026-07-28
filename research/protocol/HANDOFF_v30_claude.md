# v3.0 인수 지시서 — Claude Code 세션용

이전 에이전트의 작업을 인계받아 여형준 졸업논문 v3.0 연구를 실제 완료 상태까지 끝낸다.
질문하거나 중간 승인을 기다리지 말고, 합리적 판단을 `research/logs/DECISIONS_v30.md` 에
기록하며 계속 진행한다.

작업 루트 `C:\dev\nutrition-safety-engine`

---

## 0. 가장 중요한 원칙 — 판정 주체는 너다

**모든 판정을 너 자신이 직접 수행한다. 로컬 언어모델을 절대 띄우지 마라.**

이전 실행이 실패한 원인이 정확히 이것이다. "너 자신이 분류기다"를 로컬 모델 실행으로
해석해 `Qwen/Qwen2.5-3B-Instruct` 를 GPU 에 올려 선별과 참조표준 채점을 모두 수행했고,
결과가 쓸 수 없는 품질로 나왔다. 다음을 전면 금지한다.

- transformers, vllm, llama.cpp, ollama 등으로 모델을 로드하는 코드를 작성하거나 실행
- 허깅페이스 캐시 모델 사용
- OpenAI 등 외부 LLM API 또는 번역 API 호출

문헌 선별, 참조표준 채점, 한국어 번역, 논문 집필 **전부 네가 직접 판단하고 작성한다.**
Python 스크립트는 배치 생성, 결과 검증, 통계 계산, 파일 빌드에만 쓴다.
판정이나 번역 자체를 스크립트나 모델에 위임하지 마라.

**서브에이전트를 만들거나 사용하지 마라.** 혼자 진행한다.

---

## 1. 먼저 읽을 것

1. `C:\Users\hjyeo\.codex\attachments\2dad3cc3-2ad5-4360-956a-3cfc2857a99a\goal-objective.md`
   전체를 UTF-8 로 읽어라. 대부분 유효하다. **이 지시서와 충돌하면 이 지시서가 우선한다.**
2. `AGENTS.md`, `research/protocol/v3.0-full-ai-autonomy-plan.md`,
   `research/protocol/protocol-v3.0-full-ai.md`, `research/protocol/amendments.csv`
3. `research/logs/RESUME.md`, `research/logs/DECISIONS_v30.md`, `research/logs/TIME_BUDGET.md`
4. `research/systematic_review_v30/manifest.json`, `core_manifest.json`, `validation.json`
5. `tools/v30/build_site_v3.py`, `tools/v30/test_build_site_v3.py`

`git status --short`, 최근 커밋, 현재 매니페스트를 직접 확인하라.
**현재 파일 상태가 권위다.**

---

## 2. 보호 대상 — 절대 수정·삭제·스테이징 금지

v2 자료:

- `data/curated_v2/evidence_map.csv`
- `research/searches/`
- `research/screening/llm_screening_runs.jsonl`
- `research/validation/screening_gold/`
- `.gitattributes`
- `src/generated/legacy/knowledge-index.json`

사용자 소유 미추적 자료 (작업 시작 전부터 존재):

- `research/screening/agent_batches/`
- `research/screening/agent_local_runs.jsonl`
- `research/screening/agent_results/`

`llm_screening_runs.jsonl` 에는 작업 시작 전부터 사용자 변경 약 400행이 있다.
**절대 커밋하지 마라.** `git add .` 을 쓰지 마라. 관련 파일만 선택 커밋하라.
`git reset --hard`, `git checkout -- <user file>`, 대량 삭제를 사용하지 마라.

---

## 3. 인수 상태

### 유효 — 그대로 쓴다

P1 완료. AI 가 독립적으로 PICOS 5개(HRS1~HRS5)와 PubMed 검색식을 정의하고 실검색했다.

- 코퍼스 2,209건 (초록 보유 1,968 / 제목만 241)
- 코퍼스 SHA-256 `3142e525...b4d3`
- 원시 ESearch·EFetch XML, query, 메타데이터, 체크섬 보존
- `research/searches_v3/`, `data/curated_v3/evidence_map.csv`

### 폐기 — 다시 한다

P2 선별과 P3 참조표준 채점 **둘 다 로컬 3B 모델이 수행했다.**

- P2: retain 334 / deprioritize 1,548 / uncertain 327
- P3: `sensitivity_vs_ai_reference 0.478`, `agreement_vs_ai_reference 0.350`,
  보정 retain 409.7 CI [139.1, 853.4] — CI 가 6배 범위라 아무것도 말할 수 없다
- 그 위에 세워진 P4 산출물: regex_passed 1,627 → dropped_by_llm 1,325 → kept 302 →
  core 75 (질문당 15). 질문에 따라 alias 직접 근거가 1~3건뿐이다

**alias 근거가 모자라는 것은 선별기 품질 문제의 증상이다.**
인수 문서가 제안한 "다른 core 근거로 5건까지 패딩"은 하지 마라.
제대로 재선별하면 근거가 늘어난다. 재선별 후에도 부족하면 그때 판단한다.

### 미완 — 이어서 한다

P4 코드는 완성돼 있고 한 번 성공했다. 데이터만 바뀌면 그대로 재사용 가능하다.
P5 는 문서·논문·비교도구·발표원고·노션 전부 미완이다.
현재 `git status` 의 미커밋 작업 파일은 중단 상태이므로 완성품으로 가정하지 말고 검토하라.

---

## 4. 실행 순서

P0 → P2 → P3 → P3.5 → P4 → P5 → P6.

### P0 — 3B 산출물 폐기 격리

git 히스토리를 조작하지 마라. 파일을 옮겨 격리한다.

- v3.0 트랙의 3B 선별·채점 산출물을 `research/screening/v30_discarded_local3b/` 로 이동하라.
  어떤 파일이 해당하는지는 매니페스트의 `execution_mode` 와 모델 필드로 식별하라.
  **v2.1 트랙 파일과 사용자 소유 파일은 건드리지 마라.**
- 3B 가 채점한 P3 산출물(`research/synthesis/screener_vs_ai_reference_v3.json` 등)도 같이 옮겨라
- 그 폴더에 `README.md` 를 만들어 한 문단으로 적어라: 소형 로컬 모델을 사용한 중단된
  실행 시도이며 판정 품질이 연구 요건에 미달해 폐기했다. v3.0 체인의 입력·정답·근거·
  비교 대상 어디에도 사용하지 않는다.
- `research/logs/DECISIONS_v30.md` 에 폐기 결정과 사유를 기록하라
- **논문, 발표 원고, Notion, 최종 보고서, 매니페스트 어디에도 이 실행을 언급하지 마라.**
  결과 비교 절을 만들지 마라. 존재하지 않는 것으로 취급하라

### P2 — 에이전트 직접 재선별 (2,209행)

1. 판정 프롬프트를 확정해 `research/screening/v30_agent/prompts/screening_prompt.md` 에
   저장하고 SHA-256 을 기록하라. 실행 중 절대 바꾸지 마라
2. 기준은 `tools/llm_screening.py` 의 SYSTEM 과 v3.0 PICOS 질문(HRS1~HRS5)을 따르되,
   에이전트가 읽기 좋은 형태로 정리하라
3. 라벨은 `retain` / `deprioritize` / `uncertain`. 사람의 include/exclude 가 아니다
4. 배치를 만들어라. `research/screening/v30_agent/batches/`, 배치당 40~60행.
   각 배치는 `{batch_id, input_sha256, rows:[{record_id, question_id, title, abstract}]}`
   **경로가 `research/screening/agent_batches/`(사용자 소유)와 겹치지 않게 하라**
5. **네가 배치를 읽고 직접 판정한다.** append-only JSONL
   `research/screening/v30_agent/checkpoints.jsonl`
   줄 스키마 `{record_id, question_id, decision, reason_codes, confidence, evidence_basis, status}`
6. 제목만 있는 241행은 `evidence_basis=title_only`, `confidence` 상한 `low`,
   `reason_codes` 에 `insufficient_abstract` 강제. **전량 2,209행을 대상으로 한다**
7. fallback 이나 파싱 실패라는 개념이 없어야 한다. 판단이 어려우면 `uncertain` 을 쓰고
   이유를 남겨라
8. 배치 5개마다 커버리지 검증. 요청한 `(record_id, question_id)` 가 정확히 한 번씩
   돌아왔는지 확인하고 누락을 재배치하라. **100% 가 될 때까지 반복하라**
9. 배치 10개마다 선택 커밋하라. 세션이 끊기면 체크포인트에서 재개하라.
   **부분 커버리지를 완료로 쓰지 마라**
10. 매니페스트 `research/screening/v30_agent/manifest.json`:
    `screener: "agent_direct"`, 커버리지, 프롬프트 해시, 입력 해시, 판정 분포,
    근거 형태별 분포, 배치 목록과 해시, `run_complete`
11. 커밋하라

### P3 — 에이전트 직접 참조표준 채점

1. P2 판정 결과를 strata 로 층화 무작위 표본 300건을 뽑아라.
   층별 프레임 크기·표본 수·가중치·시드를 매니페스트에 기록하라
2. 블라인드 파일에 P2 라벨·confidence·reason_codes·batch_id 를 절대 넣지 마라
3. **P2 와 다른 프롬프트를 써라.** 주제 적합성을 통째로 묻지 말고 P·I·C·O·S 를 각각
   평가한 뒤 **코드의 명시적 규칙**으로 종합 라벨을 도출하라. 프롬프트와 해시를 저장하라
4. 라운드별로 행 순서를 독립 무작위화하고 시드를 기록하라. 3회 독립 판정 후 다수결.
   세 라벨이 모두 다르면 `unresolved` 로 남기고 건수를 보고하라
5. 라운드 간 일치율과 κ 를 기록하라
6. 층화 가중치를 적용해 산출하라. **단순 평균을 쓰지 마라**
7. Rogan–Gladen 보정 + 층화 부트스트랩 10,000회로 코퍼스 수준 retain 규모의
   점추정과 95% CI 를 계산하라
8. 위양성·위음성 사례를 실제 제목과 함께 각각 최대 20건 기록하라
9. 출력 `research/synthesis/screener_vs_ai_reference_v3.json`.
   블라인드 표본·라운드별 출력·프롬프트·해시·매니페스트를 재현 가능한 위치에 보존하라
10. 통계 함수에 테스트를 추가하라. 층화 가중, Rogan–Gladen, 부트스트랩 CI
11. `research/validation/screening_gold/` 420건은 v2.1 트랙 표본이다. 건드리지 마라
12. 커밋하라

### 명명 규칙 (위반 금지)

```
sensitivity   → sensitivity_vs_ai_reference
specificity   → specificity_vs_ai_reference
accuracy      → agreement_vs_ai_reference
gold standard → ai_reference_standard
validated     → ai_cross_checked
true positive → reference_positive_classifier_positive
```

AI 참조 판정은 진실 정확도가 아니라 내부 참조 판정이라고 명확히 적는다.
논문 본문에서도 "민감도"를 단독으로 쓰지 말고 "AI 참조표준 대비 민감도"로 쓰고,
첫 등장 시 참조표준이 AI 로 생성됐음을 각주로 명시하라.

### P3.5 — 코퍼스 충분성 판단

재선별 결과로 `tools/v30/build_site_v3.py all` 을 돌려 core evidence 수를 확인하라.

- **질문당 core 근거가 10건 이상이면** 코퍼스는 충분하다. P4 로 진행하라
- **질문당 10건 미만이면** 검색식이 좁았던 것이다. `picos_definition.json` 의 검색식을
  네가 다시 검토해 넓히고, PubMed E-utilities 로 추가 검색해 코퍼스를 보강한 뒤
  추가분만 P2 와 동일한 프롬프트로 선별하라. 총 코퍼스 상한 8,000행
- 어느 쪽이든 판단 근거와 수치를 `DECISIONS_v30.md` 에 기록하라
- **관련 없는 근거로 5건을 채우는 패딩은 하지 마라.** 근거가 부족하면 부족하다고 보고하라

### P4 — 사이트 재생성·번역·테스트·빌드

#### P4-1. 재생성

```
python tools\v30\build_site_v3.py all
python -m unittest tools.v30.test_build_site_v3 -v
```

`manifest.json` 에 `llm_gate.applied=true` 와 `regex_passed`, `dropped_by_llm`, `kept` 가
기록돼야 한다.

#### P4-2. 한국어 번역 재작성

core evidence 집합이 바뀌었으므로 기존 번역 75건은 유효하지 않다.
**네가 직접 전부 다시 작성하라.** 외부·로컬 번역 모델을 호출하지 마라.

- `research/systematic_review_v30/key_finding_translations_ko.json`
- 메타데이터를 `translation_authorship: "ai_generated"`, `author: "Claude"` 로 갱신하라
- 원문 의미를 바꾸지 마라. 수치·단위·방향(증가/감소)을 임의로 바꾸면 안 된다
- 문장 단위 locator 의 원문 무결성을 위해 **길이 제한으로 자르지 마라**
- 사람이 채울 빈칸을 남기지 마라. 전부 채워라

#### P4-3. 오래된 v2 고정 테스트 교체

`__tests__/personalized-safety-api.test.ts` 를 전부 읽고 최소 수정하라.

- 과거 v2 PMID 와 정확한 순위를 요구하는 assertion 제거
- 대신 v3 불변조건 검증: 선택 근거 존재, `record_id` 가 `pubmed:` 로 시작,
  alias 가 가리키는 v3 `question_id` 에 속함, 직접 관련 근거가 먼저 배치됨,
  `evidence_lineage.track === "v3.0_full_ai_autonomy"`, `source_question_id` 정확
- 용량 파싱·상호작용·fallback 동작 검증은 유지
- `key_finding.length <= 280` 제한은 제거하라. 비어 있지 않음과 원문 locator 일치를 검증하라
- 존재하지 않는 옛 PMID 를 억지로 새 자료에 섞지 마라

`__tests__/personalized-safety-ui-contract.test.ts` 의 소개 문장을 현재 문장으로 갱신하라.

> 수술 전후, 만성콩팥병, 임신, 간질환, 항응고 치료 상황에서 보충제 용량과 병용약,
> 기저질환을 문헌 근거와 비교해요.

다음 경계 테스트는 반드시 유지하라: `ai-exploratory-boundary`, `thesis-mode-boundary`,
`legacy-mode-boundary`. **테스트를 무의미하게 약화하거나 삭제하지 마라.**

#### P4-4. 전체 검증

```
python tools\v30\build_site_v3.py all
python -m unittest tools.v30.test_build_site_v3 -v
npm run typecheck
npm run lint
npm test
npm run build
```

실패하면 실제 공통 원인을 고치고 다시 실행하라.
**배포하지 마라. `npx vercel`, `npm run dev`, `next start` 를 실행하지 마라.**

P4 관련 파일만 선택 커밋하라. P5 문서, 사용자 dirty 파일, 미완성 도구를 함께 넣지 마라.

### P5-1 — 졸업논문 재생성

기존 논문
`G:\내 드라이브\여형준님\24 전공심화실습(1)\여형준\02_졸업논문\여형준_졸업논문_최종본.docx`

먼저 같은 폴더에 백업을 만들어라. 기존 파일을 삭제하지 마라.

- `여형준_졸업논문_최종본_v21백업.docx`
- `여형준_졸업논문_최종본_v21백업.pdf`

이미 백업이 있으면 해시와 내용을 확인하고 함부로 덮어쓰지 마라.

참조 논문 SHA-256 `3891F6EC84FBF6862F4639CD5F530DE5988C832A26B8B16B6AAE3B598633AF74`
로컬 사본 `research/thesis/etc/template_v21/reference_v21.docx`
기존 자료가 있을 수 있다: `section_audit.txt`, `style_evidence.json`,
`render_manual/reference_v21.pdf`

기존 논문의 페이지 구성·여백·제목 체계·스타일을 템플릿 권위로 삼아라.
python-docx 또는 기존 빌더로 v3.0 논문을 작성하라.

필수 장: 제목 · 초록 · 서론 · 방법 · 결과 · 고찰 · 한계 · 결론

방법에 반드시 포함:

- AI 가 PICOS 와 PubMed 검색식을 정의함, 정의 프롬프트 해시, 검색 실행 일시
- 신규 코퍼스 규모, AI 선별 coverage 100%
- 선별과 참조 판정을 모두 에이전트가 직접 수행했으며 별도 모델을 호출하지 않았음
- AI 참조 판정의 생성·채점 방식
- 사람의 연구 의사결정 0건

한계에 반드시 포함:

- `ai_reference_standard` 는 진실 정확도가 아니라 내부 참조 판정임
- 분류기와 참조 판정이 같은 모델이므로 독립성이 부분적임
- 사람의 연구 의사결정 0건
- PubMed 단일 자료원
- 접근하지 못한 원문을 근거로 과대 해석하지 않음

**모든 수치는 매니페스트에서 읽어라.** 기억이나 이 지시서의 숫자를 하드코딩하지 마라.

한국어 글꼴은 설치된 정적 Pretendard 계열을 쓰고 **Word XML 에서 Pretendard 문자열이
실제로 기록됐는지 확인하라.** 시각 확인만으로 적용됐다고 주장하지 마라.

PDF 변환은 `C:\Program Files\LibreOffice\program\soffice.com` 을 직접 사용하라
(`soffice.exe` 는 실패한 적이 있다). **PDF 전체 페이지를 이미지로 렌더해 잘림·겹침·
빈 페이지·깨진 한글·표 넘침을 직접 눈으로 확인하라.**

최종 파일은 기존 정식 파일명에 덮어쓰되 백업을 먼저 완료하라.
중간 렌더와 감사 파일은 `research/thesis/etc/` 아래에 둬라.

### P5-2 — 저장소 문서와 비교 도구

`AGENTS.md`, `README.md`, `docs/project_map.md` 를 검토·완성하라.

- 존재하지 않는 `data/systematic_search/` 경로 제거 또는 실제 경로로 교체
- v3.0 트랙 구조와 명명 규칙 설명
- v2.1 은 사람 정의 비교 트랙, v3.0 은 AI 정의 주 트랙
- v2 보호 대상과 경계 설명. 실제 생성 경로만 기록

`tools/compare_picos_tracks.py` 가 중단 상태로 있다. 검토·완성 후 실행하라.
출력 `research/synthesis/picos_track_comparison.json`
필수 비교: AI 질문이 기존 A1~B3 을 어떻게 포괄하는지, 질문 수, 검색식 용어 Jaccard,
MeSH 사용 비교, hit 수, PMID 교집합, v2 전용 PMID, v3 전용 PMID, 입력 파일과 해시, 계산 방식.
**수치를 하드코딩하지 마라.**

`tools/test_phase02_evidence_bytes.py` 도 중단 상태다. 관련 builder·validator 를 찾아
원인을 확인하라. 알려진 원인은 CSV 파싱 내용은 같지만 일부는 LF, 일부는 CRLF 로 기록돼
13건 바이트 검증이 실패하는 것이다.

- 파싱한 CSV 를 공식 직렬화 방식으로 다시 기록해 바이트를 정규화하라
- 관련 phase02 매니페스트를 다시 생성하라
- 사용자 원본을 덮어써야 하면 `etc` 아래에 백업하라
- 보호된 `data/curated_v2/evidence_map.csv` 를 수정하지 마라. `.gitattributes` 도 마찬가지
- 회귀 테스트를 실행하라
- `validate:phase07:proxy` 는 사람 이중선별 자료가 없어 의도적 skip 이다.
  억지로 통과시키지 말고 skip 이유를 보고서에 기록하라

### P5-3 — 발표 원고

`research/reports/발표원고_v3.0.md`

- **PPTX 를 만들지 마라. 디자인 작업을 하지 마라**
- 슬라이드 단위, 슬라이드별 실제 발화 문장 3~5개
- 전문용어는 첫 사용 때 쉬운 말로 설명. 필요하면 짧은 비유
- 과장 표현 금지. 수치는 매니페스트에서만 읽기
- 네 가지 설계 주장 각각에 대해 참/거짓과 근거를 설명
- AI 참조 판정의 한계를 명확히 설명
- 사이트가 배포되지 않았고 빌드까지만 검증됐다고 명시

### P5-4 — Notion 업데이트 원고

`research/reports/notion_update.md` — 붙여넣기만 하면 되는 완성본.
대상 https://app.notion.com/p/3753b1f9b9ae814bb314dc1deb743dfa

필수 구성: 현재 상태(2026-07-28 갱신) / 핵심 수치 / 네 가지 설계 주장별 참·거짓과 증거 /
방법 요약 / 경계와 한계 / 코드·빌드 상태 / 공식 문서 위치 / 다음 단계

Notion 접근 도구가 **실제로 이미 제공되는 경우에만** 직접 갱신하라. 없으면 설치·로그인
시도로 시간을 쓰지 말고 `notion_updated: false` 와 이유를 기록하라.
직접 갱신할 수 있다면 `[대체됨]` 같은 누적 절을 만들지 말고 상단 현재 상태를 교체하라.

### P6 — G 드라이브 동기화·로그·최종 검증

기준 `G:\내 드라이브\여형준님\24 전공심화실습(1)\여형준\`

- `03_연구부록\` : picos_definition.json, screener_vs_ai_reference_v3.json,
  picos_track_comparison.json, v30_run_report.json, amendments.csv,
  protocol-v3.0-full-ai.md, 신규 v3 트랙 매니페스트 전체, notion_update.md
- `02_졸업논문\` : 재생성한 최종 DOCX·PDF, 기존 파일의 `_v21백업` 사본
- `06_발표자료\` : 발표원고_v3.0.md

덮어쓰기 전에 안전한 백업 여부를 확인하라. 복사 후 원본과 사본의 SHA-256 을 비교하고
`files_synced` 에 목록과 검증 결과를 기록하라.
`90_legacy` 폴더와 기존 원본 자료를 삭제하거나 재구성하지 마라.

로그 갱신: `research/logs/TIME_BUDGET.md`, `RESUME.md`, `WORKLOG.md`, `DECISIONS_v30.md`

`research/logs/v30_run_report.json` 필수 필드:
claims(네 가지 설계 주장별 참·거짓과 근거 경로), phases, corpus, screening(coverage·
판정 분포·프롬프트 해시·execution mode), ai_reference(표본 수·unresolved·라운드 간 agreement·
sensitivity_vs_ai_reference·specificity_vs_ai_reference·agreement_vs_ai_reference·
보정 추정치와 95% CI), track_compare, site(llm_gate_applied·core evidence 수·개인화 규칙 수·
번역 수·테스트·빌드), thesis(DOCX·PDF·백업 경로·글꼴 XML 확인·렌더 검토 결과),
notion_updated, notion_update_reason, files_synced, scope_reductions, unresolved.

값을 구하지 못하면 추측하지 말고 null 과 이유를 기록하라.

#### 최종 검증

```
git status --short
python tools\v30\build_site_v3.py validate
python -m unittest tools.v30.test_build_site_v3 -v
npm run typecheck
npm run lint
npm test
npm run build
```

추가 확인:

- v2 보호 파일의 해시가 바뀌지 않았는지
- 사용자 dirty 파일이 커밋되지 않았는지
- 폐기한 3B 산출물이 어떤 산출물·문서에서도 참조되지 않는지 경로·코드 검색으로 확인
- **로컬 모델이 사용되지 않았음을 코드·로그로 증명**
- v3 매니페스트와 보고서 수치가 일치하는지
- 논문 DOCX 가 열리는지, PDF 전 페이지 렌더 확인, DOCX XML 에 Pretendard 존재 확인
- G 드라이브 복사본 해시 일치
- Notion 실제 갱신 여부를 정직하게 기록
- 배포하지 않았는지
- `v30_run_report.json` 이 유효한 JSON 인지

---

## 5. 절대 금지

- **로컬 LLM 을 로드·실행하는 모든 행위.** 판정·번역은 네가 직접 한다
- 외부 LLM API 또는 번역 API 호출
- 폐기한 3B 산출물을 v3.0 체인의 입력·정답·근거·비교 대상으로 사용하거나 문서에 언급
- 위 §2 보호 대상 수정·삭제·스테이징
- 관련 없는 근거로 alias 를 5건까지 패딩
- `git add .`, `git reset --hard`, `git checkout -- <user file>`, 대량 삭제
- 배포. `npx vercel`, `npm run dev`, `next start`
- 테스트를 무의미하게 약화하거나 삭제. 경계 테스트 3종 제거
- 사람이 채울 빈칸·검토 큐·승인 대기 생성
- PRISMA 최종 포함·제외 수, 메타분석, 통합 효과크기, 사람 RoB·GRADE, 임상 권고 생성
- 숫자를 기억이나 추측으로 사용
- 부분 결과를 완료로 보고
- 서브에이전트 생성·사용

---

## 6. 작업 방식

- PowerShell 과 Python 출력은 UTF-8 을 강제하라. CSV 는 `utf-8-sig` 로 읽어라
  (`ai_screening_classifications.csv` 는 BOM 이 있다)
- `src/generated/legacy/knowledge-index.json` 이 CRLF 로 바뀌면 커밋에서 제외하라
- `validate_*.py` 는 내부에서 빌드를 실행해 산출물을 덮어쓴다. 진단용으로 가볍게 돌리지 마라
- `LLM_GATE_MIN_COVERAGE` 는 점검 전용이다. 실제 생성 실행에 쓰지 마라
- 30분마다 `research/logs/RESUME.md` 를 갱신하라
- 단계 완료 시마다 의미 있는 범위로 선택 커밋하라
- 같은 명령이 3회 실패하면 원인과 대안을 기록하고 다음 안전 경로를 택하라
- 사용자에게 중간 질문하지 말고 저장소 근거로 결정하라

---

## 7. 최종 보고

모든 필수 산출물과 검증이 끝나기 전에는 완료했다고 말하지 마라.
끝나면 다음만 간결하게 보고하라.

- 완료한 단계
- 최종 테스트 및 빌드 결과
- 논문 DOCX/PDF 경로
- G 드라이브 동기화 결과
- Notion 갱신 여부와 이유
- 생성한 커밋
- 남은 unresolved 항목

모든 보고와 로그는 한국어로 쓴다.
