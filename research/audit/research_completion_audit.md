# 연구 종료 조건 감사

현재 결론: 연구 미완료. 열린 종료 게이트 17개.

AI 사전검토와 실제 사람·외부 수행을 구분했습니다.

## G01 · PubMed final retrieval

- 상태: `agent_work_complete_human_search_claim_open`
- 남은 조건: Final-search claim awaits completion of all planned sources.
- 필요한 수행 주체: `research_team`

## G02 · RISS final rerun

- 상태: `external_action_open`
- 남은 조건: Run 20 approved split queries and preserve native exports without summing overlaps.
- 필요한 수행 주체: `authenticated_database_operator`

## G03 · KMbase search repair

- 상태: `external_action_open`
- 남은 조건: Repair operator semantics, verify known-item recall, and rerun 20 queries.
- 필요한 수행 주체: `database_searcher`

## G04 · Licensed database exports

- 상태: `external_access_open`
- 남은 조건: Obtain Embase and Scopus or Web of Science exports.
- 필요한 수행 주체: `institutional_account_holder`

## G05 · Title/abstract screening

- 상태: `agent_prereview_complete_human_decisions_open`
- 남은 조건: Two genuinely independent reviewers must screen and adjudicate eligible records.
- 필요한 수행 주체: `independent_human_reviewers`

## G06 · Report-to-study linkage

- 상태: `agent_prereview_complete_human_links_open`
- 남은 조건: Validate report clusters for records retained after human screening.
- 필요한 수행 주체: `human_reviewers`

## G07 · Registry screening and linkage

- 상태: `agent_prereview_complete_human_decisions_open`
- 남은 조건: Validate 207 registry records and 500 PubMed-link candidates.
- 필요한 수행 주체: `human_reviewers`

## G08 · KoreaMed screening and linkage

- 상태: `agent_prereview_complete_human_decisions_open`
- 남은 조건: Validate 62 title-only records and 35 exact-title link candidates.
- 필요한 수행 주체: `human_reviewers`

## G09 · Full-text screening

- 상태: `agent_partial_fulltext_research_human_eligibility_open`
- 남은 조건: Obtain all eligible full texts and record one primary exclusion reason per excluded report.
- 필요한 수행 주체: `independent_human_reviewers`

## G10 · Data extraction

- 상태: `agent_partial_extraction_human_verification_open`
- 남은 조건: Double-check study characteristics and effect estimates for included studies.
- 필요한 수행 주체: `independent_human_extractors`

## G11 · Risk of bias

- 상태: `agent_signal_map_complete_human_judgment_open`
- 남은 조건: Complete design-appropriate domain judgments with support.
- 필요한 수행 주체: `trained_human_assessors`

## G12 · GRADE

- 상태: `agent_preparation_complete_human_judgment_open`
- 남은 조건: Rate certainty for each critical outcome after verified synthesis.
- 필요한 수행 주체: `grade_review_team`

## G13 · Quantitative or narrative synthesis

- 상태: `agent_descriptive_draft_human_gates_open`
- 남은 조건: Synthesize only verified included studies; pool only when clinically and statistically appropriate.
- 필요한 수행 주체: `research_team`

## G14 · Expert content review

- 상태: `external_review_open`
- 남은 조건: Qualified experts must assess scope, accuracy, and wording.
- 필요한 수행 주체: `external_domain_experts`

## G15 · Usability evaluation

- 상태: `external_study_open`
- 남은 조건: Conduct the planned usability study with real participants.
- 필요한 수행 주체: `human_participants_and_research_team`

## G16 · Independent scenario gold and engine evaluation

- 상태: `external_human_gold_open`
- 남은 조건: Two independent authors plus adjudication must create the gold set before final metrics.
- 필요한 수행 주체: `independent_human_authors`

## G17 · Final freeze, thesis, and manifest

- 상태: `downstream_gates_open`
- 남은 조건: Freeze verified data, regenerate thesis/figures/FINAL_MANIFEST, and audit all cross-artifact numbers.
- 필요한 수행 주체: `research_team`
