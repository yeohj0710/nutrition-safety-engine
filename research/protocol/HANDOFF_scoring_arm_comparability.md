# 두 채점 arm 비교 가능성 세팅 (2026-07-30)

상위 규칙은 `protocol-shared-ai-screening.md` §4다. 이 문서는 그 §4를 **두 연구의 결과를
나란히 놓고 하나의 질문에 답하기 위해** 무엇을 고정하고 무엇을 달라도 되게 둘지 정한다.

## 0. 이 비교가 답하려는 질문 하나

> 여형준 v4.0에서 관측된 **선별의 계통적 과소포함**(파이프라인 전수 retain 7.02% 대
> 채점자 설계기반 추정 15.33%, 95% CI 10.17~21.12, 비 **2.18배**)이
> **이 파이프라인 고유의 결함인가, 아니면 이 선별 설계 전반의 성질인가.**

두 연구는 같은 선별 구조(결정적 분류기가 코퍼스 100% → AI가 부분집합 재판정 → 사람 0건)를
쓴다. 그래서 권혁찬 v5.0 채점 arm이 이 질문의 결정적 시험이다. 다른 부수 지표
(일치율·κ)는 이 질문에 답하지 못한다 — **비교의 주 대상은 retain 비율의 비 하나다.**

## 1. 시급한 것 — 사전지정 창이 아직 열려 있다

2026-07-30 확인 시점의 repo2 상태: `status: prepared_for_blinded_scoring`,
`v50_truth_sealed.json` 의 `opened_before_lock: false`, 라운드 23개 배포, 수집된 판정 0건.
**즉 정답을 아직 열지 않았다.**

따라서 §4 해석 규칙(아래 §5)을 **지금 적어야 사전지정이 된다.** 정답을 연 뒤에 "어느 결과가
무엇을 뜻하는지"를 정하면 사후 해석이고, 방향성 소견의 설명력이 크게 떨어진다.
이 문서를 커밋한 시각이 사전지정 시각이다.

## 2. 반드시 동일해야 하는 것 — repo2 현황 대조

repo2 실제 값은 `research_v3/otc/validation/screening_ai_reference_v50/manifest.json`
과 `scoring_execution_receipt.json` 에서 읽었다(읽기만 했다).

| # | 고정 항목 | 여형준 v4.0 | 권혁찬 v5.0 | 상태 |
|---|---|---|---|---|
| 1 | 코퍼스 완전분할 층화 (ΣN = 선별단위 총수) | ΣN 48,031 | `partition_is_exhaustive: true`, `population_total: 43,207` | **충족** |
| 2 | 층을 참조표준 라벨·층 기준으로 정의 | 작업기 라벨 × 질문 + 층 | `partition_axes: [final_label, adjudication_status, question_id]` | **충족** |
| 3 | 결정적 순위 `SHA-256(seed｜question_id｜record_id)` 오름차순, 시드 기록 | seed `20260729` | `rank_function` 동일, seed `20260730-v50-scoring-arm` | **충족** (시드는 달라야 함) |
| 4 | 카드 6필드만 (`record_id·question_id·title·abstract·publication_types·mesh_terms`) | 동일 | `allowed_fields` 정확히 6개 | **충족** |
| 5 | 카드에 층 정보 없음 | 없음 | `forbidden_keys` 에 `base_stratum_id`·`sampling_stratum_id`·`weight` 포함 | **충족** |
| 6 | 누출 검사 전건 통과 | 1,033 통과 | `blinding_check.passed: true`, 894 통과 | **충족** |
| 7 | 정답 열기 전 해시 잠금 + 영수증 | `lock_receipt.json`, `truth_opened_before_lock: false` | `opened_before_lock: false`, 잠금 영수증은 아직 없음 | **진행 중** |
| 8 | 판정 기준 = 그 연구의 동결 프롬프트 | `screening_prompt.md` | `frozen_semantic_adjudication_prompt.md` (영수증에 unchanged 기록) | **충족·단 §4 주의** |
| 9 | 초록 없으면 `confidence=low` 강제 | 강제 | 분류기 층에서 위반 0건 확인 | **충족** |
| 10 | 채점 중 선례 문서 누적 | `SCORER_RUBRIC.md` 선례 23종 | `SCORER_RUBRIC.md` 존재 | **충족** |
| 11 | 층화 부트스트랩, **전수 층 고정**, 반복 10,000 | 10,000, 전수 층 고정 | manifest에 반복수·고정 규칙 기록 없음 | **공백 → §3** |
| 12 | 설계기반 가중 retain 추정치와 전수 retain 을 **둘 다** 보고 | 보고함 | 보고 대상으로 선언된 기록 없음 | **공백 → §3** |
| 13 | 로건-글래든을 교차확인으로 제시하지 않음 | `rogan_gladen_is_tautological_here: true` | 선언 없음 | **공백 → §3** |
| 14 | 지표 이름에 비교 상대 (`_vs_ai_reference`) | 전부 부착 | 규칙은 AGENTS.md 에 있음 | 산출 시 확인 |
| 15 | `independent_blinding`(사람) = false, `independent_blinding_ai` 는 층별·영수증 있을 때만 | false 유지 | `false` / `None` + `pending_label_lock` | **충족**(올바르게 보류) |
| 16 | 채점 라벨을 재판정 라벨로 재사용 금지 | 금지 준수 | 준수 필요 | 산출 시 확인 |
| 17 | `release_ready` = false | false | false | **충족** |

## 3. 채워야 할 공백 넷 (repo2 산출 단계에서)

1. **주 추정량을 선언하고 보고한다.** 최소 이 네 값을 같은 이름으로 낸다.
   `census_retain_share`(전수), `design_based_retain_share`(층화 가중 추정),
   그 **95% CI**, 그리고 **비**(`retain_share_ratio_scorer_over_pipeline`).
   이것이 없으면 2.18배와 비교할 대상이 없다.
2. **부트스트랩 명세를 기록한다.** 층화 부트스트랩 **10,000회**, 표본 층은 층 내 복원추출,
   **전수 층(불변식 실패 등)은 고정**. 반복수가 다르면 CI 폭을 나란히 못 놓는다.
3. **로건-글래든을 쓸 경우 항등식임을 선언한다.** 층을 참조표준 라벨로 정의했으므로 repo2도
   같은 환원이 일어난다. `rogan_gladen_is_tautological_here` 를 남기고 교차확인으로 쓰지 않는다.
4. **잠금 영수증 키 이름을 맞춘다.** `scored_labels_sha256`·`scored_rows`
   (`sha256`·`rows` 아님). repo1에서 이 오독으로 잠금 해시가 null 로 들어간 적 있다.

## 4. 달라도 되는 것 — 다만 반드시 기록한다

이 차이들은 결함이 아니다. 감추면 결함이 된다.

- **층 구성과 표본 크기.** repo1 n=1,033(질문별 36 + `uncertain` 57 전수 + 재판정 616 전수),
  repo2 n=894(확률층당 38 + 불변식 실패 전수). repo2는 `uncertain` 2,246과 재판정 5,000을
  **전수로 두지 않는다** — 7,246건 채점은 비현실적이고, 확률표본으로 두는 것이 §4-2
  ("모수에 비례시키지 말고 층별 정밀도로 정한다")에 맞다.
- **그 결과 층별 정밀도가 다르다.** repo1의 재판정 층은 전수라 표집오차 0이고 층 단독 CI가
  한 점(79.87%)으로 수축했다. repo2의 재판정 층은 표본이므로 CI가 생긴다.
  **층별 수치를 나란히 놓을 때 "한쪽은 전수, 한쪽은 표본"을 같이 적는다.**
- **카드의 관측 가능성 분포.** repo1 초록 부재 232/1,033(22.5%)·MeSH 미색인 265,
  repo2 초록 부재 219/894(24.5%)·MeSH 미색인 106. 초록 부재 비율은 비슷하고 MeSH 결측은
  repo2가 낮다.
- **시드·코퍼스·질문.** 달라야 한다(같은 시드를 쓰면 안 된다). 질문 의미도 다르다 —
  영양보충제 안전성 대 국내 일반의약품 중복복용.
- **채점자.** repo1은 이 세션, repo2는 Codex(OpenAI GPT-5, `codex_thread_id` 영수증 있음).
  제공자가 다른 것은 오히려 유리하다(같은 곳에서 같이 틀릴 가능성이 낮다).

### §4-8 에 딸린 주의 하나

repo1은 동결 **선별** 프롬프트가 두 층 모두의 명세였다(D-07). repo2가 쓰는
`frozen_semantic_adjudication_prompt.md` 는 **재판정 층의 명세**다. 결정적 분류기
(`agent_screen_v50.py`)의 규칙이 같은 명세에서 나온 것이 아니면, 분류기 층을 이 프롬프트로
채점한 결과에는 "판정 차이"와 "기준 차이"가 섞인다. 분류기 규칙의 출처를 확인해
`scoring_criteria_scope` 로 **어느 층에 대한 명세인지** 기록한다. 확인이 안 되면 분류기 층
지표에 이 한계를 붙여 보고한다.

## 5. 해석 규칙 — 정답을 열기 전에 고정한다

repo2의 `retain_share_ratio_scorer_over_pipeline` 와 그 95% CI 를 기준으로 한다.
"과소포함"은 비 > 1 이고 **CI가 1을 포함하지 않는 경우**로만 인정한다.

| repo2 결과 | 결론으로 인정하는 것 | 인정하지 않는 것 |
|---|---|---|
| 과소포함, 같은 방향 (비 > 1, CI가 1 제외) | 한 파이프라인의 우연이 아니다. **공유 선별 설계**(결정적 분류기 전량 라벨 + 좁은 경계 재판정)가 과소포함 쪽으로 기운다는 소견. 두 논문의 한계 절에 같은 문장으로 적는다. | 원인이 특정 규칙·임계값이라고 지목하는 것. 코퍼스·질문이 다르므로 기전은 이 자료로 안 나온다. |
| CI가 1을 포함 (차이 미검출) | 여형준 소견을 **재현하지 못했다.** repo2의 표본 크기(894)로는 그 크기의 차이를 잡을 검정력이 부족할 수 있으므로, 검정력 진술을 함께 적는다. | "문제가 없다"로 읽는 것. 미검출은 부재의 증거가 아니다. |
| 비 < 1 (과대포함, CI가 1 제외) | 방향이 반대다. 이 지표가 코퍼스·질문 특성에 지배된다는 뜻이므로 **설계 수준의 결론을 어느 쪽으로도 내지 않는다.** | 여형준 소견을 반박한 것으로 쓰는 것. |

어느 경우든 공통으로 붙는 단서: **사람 참조표준이 0건이므로 두 arm 모두 AI 판정 두 개
사이의 불일치를 재고 있다.** 어느 쪽도 정답이 아니고, 따라서 "선별 정확도"가 아니라
"두 독립 판정의 계통적 차이"로만 서술한다.

## 6. 비교표 필드 명세

두 arm이 끝나면 아래 필드를 **같은 이름으로** 한곳에 모은다. 이름이 다르면 비교가 비공식으로
남는다. 권장 위치: 이 폴더에 `scoring_arm_comparison.json`.

```
study, track, corpus_units, unique_papers,
sample_n, stratum_families, census_strata, probability_strata,
seed, rank_function,
census_retain_share, design_based_retain_share, design_based_retain_ci95,
retain_share_ratio_scorer_over_pipeline, ratio_ci95,
agreement_vs_ai_reference, agreement_vs_ai_reference_unweighted,
sensitivity_vs_ai_reference, specificity_vs_ai_reference,
cohen_kappa_vs_ai_reference_unweighted,
per_layer_kappa, disagreement_count,
abstract_absent_cards, mesh_absent_cards,
bootstrap_iterations, census_strata_fixed,
rogan_gladen_is_tautological_here,
independent_blinding, independent_blinding_ai_by_layer, release_ready,
scorer_provider, scoring_criteria_path, scoring_criteria_scope
```

여형준 v4.0 쪽 값은 `research/synthesis/screener_vs_ai_reference_v40.json` 과
`research/logs/v40_scoring_report.json` 에 이미 있다.

## 7. 이 시험이 답하지 못하는 것

- **통제된 실험이 아니다.** 코퍼스·질문·분류기·채점자가 모두 다르다. 같은 방향이 나와도
  "설계 탓"을 인과로 확정할 수 없고, 두 사례에서 같은 방향이 관측됐다는 소견까지다.
- **표본이 둘이다.** n=2 로는 설계 수준 일반화가 안 된다.
- **사람 참조표준을 대체하지 못한다.** 두 arm이 일치해도 둘 다 같은 방향으로 틀렸을 수 있다.
  사람 판정 참조표준은 두 연구 공통으로 여전히 공백이다.
