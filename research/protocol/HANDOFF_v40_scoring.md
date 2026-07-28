# v4.0 채점 인수 지시서 — 새 세션용

v4.0 선별을 채점하는 독립 AI 참조표준을 만들어 v4.0 을 논문 완결 상태까지 끝낸다.
질문하거나 중간 승인을 기다리지 말고, 판단은 `research/logs/DECISIONS_v40_scoring.md` 에
기록하며 계속 진행한다. 보고와 로그는 한국어로 쓴다.

작업 루트 `C:\dev\nutrition-safety-engine`

---

## 0. 판정 주체는 너다

**모든 채점을 네가 직접 수행한다. 로컬 언어모델을 절대 띄우지 마라.**

이전 v3.0 실행이 실패한 원인이 정확히 이것이다. "너 자신이 채점자다"를 로컬 모델 실행으로
해석해 `Qwen/Qwen2.5-3B-Instruct` 를 GPU 에 올렸고 결과가 쓸 수 없는 품질로 나왔다.

- transformers, vllm, llama.cpp, ollama 등으로 모델을 로드하는 코드를 작성하거나 실행 금지
- 허깅페이스 캐시 모델 사용 금지
- 외부 LLM API 호출 금지
- **서브에이전트 생성·사용 금지.** 혼자 진행한다

Python 스크립트는 표본 추출, 맹검 카드 생성, 결과 검증, 통계 계산, 파일 빌드에만 쓴다.
채점 판정 자체를 스크립트나 모델에 위임하지 마라. 네가 초록을 읽고 판정한다.

---

## 1. 먼저 읽을 것

1. `AGENTS.md` — 특히 "Thesis track: v4.0 only" 와 v4.0 파이프라인 절
2. `research/logs/v40_run_report.json` — 단일 원장. phase_a~e 와 remaining_unresolved_items
3. `research/logs/DECISIONS_v40.md` — 선별이 어떻게 이루어졌는지
4. `tools/v40/agent_screen_worker.py` — 네가 채점할 대상의 판정 논리

이전 트랙(v1.0·v2.0/v2.1·v3.0)은 2026-07-28 에 저장소에서 제거했다. 참조표준 선례를
보고 싶으면 git 히스토리의 `research/validation/screening_ai_reference_v3/` 와
`research/synthesis/screener_vs_ai_reference_v3.json` 을 읽어라. 구조만 참고하고
수치는 가져오지 마라. 그 트랙은 논문에 들어가지 않는다.

`git status --short`, 최근 커밋, 현재 매니페스트를 직접 확인하라.
**현재 파일 상태가 권위다.**

---

## 2. 무엇을 채점하는가

v4.0 선별은 두 층이다. 이 구분이 채점 설계의 핵심이다.

- **작업기 층**: `tools/v40/agent_screen_worker.py` 가 48,031 행 전량에 라벨을 부여했다
- **재판정 층**: 경계 사례 616 건은 에이전트가 원문을 읽고 재판정해 작업기 라벨을 덮어썼다
  (`research/screening/v40_agent/semantic_adjudications.json`)

표본의 각 행이 어느 층에서 최종 라벨을 받았는지 `label_source` 로 표시하고
(`worker` 또는 `adjudication`), 지표를 **전체·작업기 층·재판정 층 셋으로 나눠 보고**한다.
두 층은 성격이 다르므로 합쳐서만 보고하면 안 된다.

---

## 3. 표본 설계

층화 무작위 표본 **420 건**. 시드는 `20260729` 로 고정하고 기록한다.

| 층 | 모수 | 표본 |
|---|---|---|
| 질문별 `deprioritize` | 44,597 | 질문당 30, 합 150 |
| 질문별 `retain` | 3,374 | 질문당 30, 합 150 |
| `uncertain` | 60 | **전수 60** |

합 360 + 60 = 420. `uncertain` 은 60 건뿐이라 표본이 아니라 전수다.
층별 가중치는 `w_h = 층 모수 / 층 표본수` 로 계산한다.

표본 크기를 모수에 비례시키지 마라. 층별 추정 정밀도가 필요 표본을 정하지 모수 크기가
정하지 않는다.

---

## 4. 맹검

채점 카드에는 다음만 넣는다.

`record_id`, `question_id`, `title`, `abstract`, `publication_types`, `mesh_terms`

**넣으면 안 되는 것**: v4.0 판정(`decision`), `reason_codes`, `confidence`,
`label_source`, 작업기 규칙 이름, 재판정 여부, 정규식 패턴명.

카드를 만든 뒤 v4.0 판정이 들어 있지 않은지 프로그램으로 검사하고, 그 검사가 통과한
해시를 기록한 다음에 채점을 시작한다. 채점을 끝내고 라벨을 잠근(해시 고정) 뒤에만
정답과 대조한다. 잠금 시각이 대조 시각보다 앞서는지 산출물에 남긴다.

한 번에 다 읽으려 하지 말고 30 건 단위로 끊어 읽어라. 도구 출력 한도를 넘으면 카드가
잘려서 초록 뒷부분을 못 본 채 판정하게 된다.

판정은 v4.0 과 같은 어휘를 쓴다: `retain` / `deprioritize` / `uncertain`.
사유 코드도 같은 8종을 쓴다.

---

## 5. 통계

- 층화 가중 지표: `sensitivity_vs_ai_reference`, `specificity_vs_ai_reference`,
  `precision_vs_ai_reference`, `f1_vs_ai_reference`, `agreement_vs_ai_reference`
- Rogan–Gladen 보정으로 겉보기 retain 3,374 건의 보정 추정치와 95% CI 를 낸다
- 층화 부트스트랩 10,000 회, Wilson 95% CI, Cohen κ
- 지표는 전체 / `label_source=worker` / `label_source=adjudication` 셋으로 나눈다

**명명 규칙 (위반 시 연구 무효).** 사람 gold 가 0 건이므로 맨 `민감도`, `sensitivity`,
`accuracy`, `gold_standard`, `validated` 를 쓰지 마라. 반드시 `_vs_ai_reference` 형태로
출처를 표기한다. `ai_reference_standard`, `ai_cross_checked` 도 같은 규칙이다.

`independent_blinding`(사람)은 false 를 유지한다. AI 맹검은 `independent_blinding_ai` 를
쓴다. `release_ready` 는 false 를 유지한다.

---

## 6. 산출 경로

- `research/validation/screening_ai_reference_v40/` — 카드, 라운드, 잠금 해시, manifest
- `research/synthesis/screener_vs_ai_reference_v40.json` — 대조 결과와 지표
- `research/logs/DECISIONS_v40_scoring.md` — 판단 기록
- `research/logs/v40_scoring_report.json` — 단일 원장

원장은 `v40_run_report.json` 의 최상위 키 구조를 따른다:
`schema_version` / `track` / `generated_at` / `run_status` / `git` / `protocol` /
`phase_*` / `completion_conditions` / `remaining_unresolved_items` / `artifact_index`.
`completion_conditions` 는 불리언 사전, `remaining_unresolved_items` 는 `{item, detail}`
배열로 쓰고 불리한 수치는 수치째로 적는다.

---

## 7. 절대 금지

- `research/logs/v40_run_report.json` 수정. 봉인된 스냅샷이다.
  `tools/v40/finalize_run_report_v4.py` 는 커밋 이후 재실행되지 않는다(가드가 거부한다)
- `research/screening/v40_agent/` 의 선별 산출물 수정·삭제
- 제거된 이전 트랙(v1.0·v2.0/v2.1·v3.0)의 산출물을 git 히스토리에서 되살려 v4.0 체인에
  넣는 것. 여기에는 v3.0 참조표준 arm 과 사람 라벨 표본 420 건이 포함된다.
  코퍼스도 질문도 다르므로 수치를 섞으면 안 된다
- 메타분석, 통합 효과크기, RoB, GRADE, 임상 권고
- 완료하지 못한 것을 완료했다고 쓰는 것

---

## 8. 완료 조건

1. 420 건 전부 채점되고 라벨이 잠겨 있다
2. 잠금 시각이 정답 대조 시각보다 앞선다는 것이 산출물로 증명된다
3. 맹검 카드에 v4.0 판정이 들어 있지 않았다는 검사가 통과했다
4. 지표가 전체·작업기 층·재판정 층 셋으로 보고된다
5. Rogan–Gladen 보정 retain 추정치와 95% CI 가 나온다
6. 맨 `민감도` 표기가 산출물 어디에도 없다
7. `v40_scoring_report.json` 이 생성되고 커밋됐다

배포는 이 작업의 범위가 아니다. 사이트 연동은 별개 작업이며
`AGENTS.md` 의 "Thesis track: v4.0 only" 절에 남은 항목으로 적혀 있다.
