권혁찬 졸업연구(OTC) 채점 arm 마무리 작업이다. **채점 실행 자체는 이미 끝났다** —
아래는 남은 검증과 반영이다. 없는 일을 새로 하지 마라.

## 먼저 읽어라
1. `C:\Users\hjyeo\.claude\projects\C--\memory\MEMORY.md` 와 그 안의
   `otc-v50-repo2-open-items.md`, `shared-ai-screening-protocol.md`,
   `scoring-arm-comparability-setup.md`
2. `C:\dev\otc-nutrient-safety-engine\AGENTS.md`
3. `C:\dev\nutrition-safety-engine\docs\version_map.md` (버전 표기가 두 연구에서 겹친다)
4. `C:\dev\nutrition-safety-engine\research\protocol\protocol-shared-ai-screening.md` §4·§5

## 지금 상태 (2026-07-30 확인)
- repo2 = `C:\dev\otc-nutrient-safety-engine`, 브랜치 `main`, 최신 커밋 `0c5e441`.
  **Codex 담당 저장소다.** 커밋·브랜치 생성은 사용자가 명시 요청할 때만 해라.
- 문헌층 최종 트랙은 **v5.0**이다(v4.0은 폐기·비교 보존). 43,207 선별단위 / 고유 42,822.
  최종 라벨 retain 7,875 / deprioritize 34,965 / uncertain 367.
- **채점 arm 완료.** `research_v3/otc/validation/screening_ai_reference_v50/`
  (blinded_cards 894 · v50_truth_sealed · manifest · SCORER_RUBRIC · rounds ·
  scoring_execution_receipt), 결과는 `research_v3/logs/v50_scoring_report.json`,
  판단기록 `research_v3/logs/DECISIONS_v50_scoring.md`, 요약 `v50_SCORING_FINAL.md`.
- 검증된 값: `labels_locked_before_truth_open: true`, `truth_opened_before_lock: false`,
  잠금 키 이름 정상(`scored_labels_sha256`), bootstrap 10,000 + 전수 층 고정,
  `population_N_sum_asserted: true`(ΣN=43,207), 로건-글래든은
  `algebraic_identity_not_independent_correction` 으로 선언됨, `independent_blinding_ai: true`
  (이 arm은 실행 영수증이 있다), `release_ready: false`.

## 확정된 판단 — 다시 논의하지 마라
- **두 arm 교차 비교와 사람 참조표준은 학위논문 범위 밖이다**(연구자 결정). 두 연구 모두
  선별 정확도를 주장하지 않으므로 설계 수준 일반화가 필요 없다. 새로 벌이지 마라.
- **단 각 연구의 채점 arm 소견은 한계로 그대로 남는다.** 지우거나 톤을 낮추지 마라.
- **명명 규율은 계속 유효하다.** 사람 참조표준이 0건이므로 모든 지표에 `_vs_ai_reference`,
  맨 `sensitivity`·`specificity`·`accuracy`·`gold_standard`·`validated`·`민감도` 금지,
  `independent_blinding`(사람)=false, `release_ready`=false 유지.

## 할 일

### 작업 1. 채점 arm 무결성 검증 (읽기 전용)
아래를 **직접 확인해 수치로 보고**해라. 통과했다고 단언하지 말고 확인한 값을 적어라.
1. 잠금 순서: `scoring_execution_receipt.json` 의 `started_at_utc` <
   `v50_scoring_report.json` 의 `lock.locked_at_utc`, 그리고 정답 개봉이 잠금 이후인지.
2. 카드 맹검: `blinded_cards.json` 894건에 허용 6필드(`record_id·question_id·title·
   abstract·publication_types·mesh_terms`) 밖의 키가 없는지, 층 정보(`base_stratum_id`·
   `sampling_stratum_id`·`weight`)가 없는지 재확인.
3. 층화 완전분할: 층별 모수 합 == 43,207. 표본에 중복 `(record_id, question_id)` 없음.
4. 층 복원: 카드에 층이 없으므로 봉인 파일의 라벨·`adjudication_status` 로 복원한 층별
   표본수가 manifest 설계값과 일치하는지.
5. 명명 위반 스캔: `research_v3/logs/v50_*` 와 `screening_ai_reference_v50/` 전체에서
   맨 금지어(`_vs_ai_reference` 를 제거한 뒤 `validated|gold_standard|민감도|특이도`) 검색.

### 작업 2. 주 추정량을 명시적으로 기록
보고서에 `design_weighted_scorer_retain_prevalence` (0.11950…)는 있는데 **파이프라인 전수
retain 과의 비가 필드로 없다.** 아래를 계산해 같은 이름으로 남겨라(내가 계산한 값과
일치하는지 확인해라).
- `census_retain_share` = 7,875 / 43,207 = **0.18227…**
- `design_based_retain_share` = **0.11950…**
- `retain_share_ratio_scorer_over_pipeline` = **0.6556…** (약 0.66배)
- 이 비의 부트스트랩 95% CI (전수 층 고정, 10,000회)

**이 값은 여형준(2.18배)과 방향이 반대다.** 그 사실을 그대로 적어라. "오차"라고 쓰지 말고
**"파이프라인이 더 많이 남기는 쪽"** 으로 적어라. 그리고 방향이 반대이므로
**과소포함을 공유 설계의 성질로 일반화하지 않는다**를 함께 적어라.

### 작업 3. 판정 기준 범위 기록
`scoring_criteria` 가 `frozen_semantic_adjudication_prompt.md` 인데 이것은 **재판정 층의
명세**다. 결정적 분류기(`agent_screen_v50.py`)의 규칙이 같은 명세에서 나온 것인지 확인하고
`scoring_criteria_scope` 로 어느 층에 대한 명세인지 기록해라. 같은 출처가 아니면, 분류기 층
지표에는 "판정 차이와 기준 차이가 분리되지 않는다"는 한계를 붙여 보고해라.

### 작업 4. 한계 문장 반영
`AGENTS.md` 와 `v50_SCORING_FINAL.md` 계열 문서에 아래 두 줄이 들어가 있는지 확인하고
없으면 넣어라(생성물은 손편집하지 말고 §함정 참조).
- 파이프라인 retain 18.23% 대 채점자 추정 11.95%(비 0.66배) = 채점자가 파이프라인의 retain을
  대량으로 걷어냈다. 불일치 방향도 `retain→deprioritize` 가 지배적이다(raw 155 대 20).
- 여형준 연구는 같은 설계에서 반대 방향(2.18배, 과소포함)이 나왔으므로 두 결과를 하나의
  설계 결론으로 합치지 않는다.

## 함정 (전부 실제로 밟았다)
- **`v50_FINAL.md` 와 `v50_SCORING_FINAL.md` 류 생성물을 손으로 고치지 마라.**
  `finalize_v50_logs.py` 가 만들고 `build_light_run_report_v50.py` 가 읽어 해시를 박으며,
  그 해시가 `v50_protected_final_audit.json` 과 `v50_run_report.json` 두 곳에 기록된다.
  손편집하면 보호 감사에서 위조처럼 잡힌다. 생성기를 고치고 체인을 다시 돌려야 한다.
  게다가 일부가 untracked라 잘못 재생성하면 git으로 복구가 안 된다.
- **`AGENTS.md` 는 `tools/build_v40_reporting.py` 가 write_text로 생성한다.** 문서만 고치면
  다음 빌드에 되돌아가므로 생성기와 문서를 같은 문장으로 함께 고쳐야 한다.
- **UTF-8 소스를 PowerShell로 편집하지 마라.** Windows PowerShell 5.1이 ANSI로 읽어 한글이
  깨진다. Edit/Write 도구만 써라. 한글을 `python -c` 로 넘기지도 마라(따옴표에서 깨진다).
  콘솔이 CP949라 한글 출력도 깨진다 — 결과는 UTF-8 파일로 쓰고 Read로 읽어라.
- **새 산출물을 커밋하기 전에 `.gitattributes` 에 `-text` 로 등록하고**, blob 바이트와 디스크
  바이트가 같은지 `git hash-object --path` 대 `--no-filters` 로 검증해라. autocrlf=true라
  개행 변환이 일어나면 기록된 SHA-256이 전부 깨진다.
- `v40_freeze_manifest.json` 은 산 제약이 아니다. `v3-otc-frozen` 태그 스냅샷이라 커밋된
  AGENTS.md도 이미 그 해시와 다르다.
- **v4.0 문헌층(`literature/{picos,searches,screening}`)과 허가원문 계층
  (`otc/{normalized,rules}`)은 읽기만 해라.** 프로토콜 §6이 수정·삭제를 금지한다.
- 사람 판단 레거시(`research_v3/screening/`, `human_review_minimal/`,
  `human_reference_label`)를 v5 체인에 넣지 마라.

## 완료 보고에 넣을 것
작업 1의 확인값 5개(수치째로), 작업 2의 네 값과 CI, 작업 3의 판단, 작업 4에서 실제로 고친
파일, 그리고 커밋하지 않은 것. **하지 않은 것을 했다고 쓰지 마라.**
