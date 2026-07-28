<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Navigation

Before exploring the repo from scratch, check `docs/project_map.md`.

- Main page: `app/page.tsx`
- Main client UI: `src/components/rule-explorer-client.tsx`
- Result card UI: `src/components/rule-card.tsx`
- Safety engine: `src/lib/safety-engine/index.ts`
- Knowledge loader/normalizer: `src/lib/knowledge/`
- Primary data source: `data/knowledge_pack.json` (exploratory; index builds read `data/legacy_unverified/baseline-33658e3/`)
- Runtime index: `src/generated/legacy/knowledge-index.json`

## Thesis track: v4.0 only

The thesis is written from **v4.0 alone**. v2.1 and v3.0 stay in the repository as the
provenance chain and must not be deleted, but they are history, not thesis content. Do not
mix their numbers into v4.0 reporting, and do not revive the v3.0 reference-standard arm at
`research/validation/screening_ai_reference_v3/codex_arm/` — it scores the 2,209-row v3.0
corpus, which the thesis no longer uses.

Two things are missing before v4.0 is thesis-complete:

1. **Scoring arm.** v4.0 has screening but nothing measuring it. There is no reference
   standard and no human decisions. Directive: `research/protocol/HANDOFF_v40_scoring.md`.
2. **Site wiring.** The site still serves v3.0 evidence. v4.0 has never been wired to it.

## Research Pipeline (protocol v4.0 MECIR search redesign — current thesis track)

- Protocol: `research/protocol/protocol-v4.0-mecir-search.md`. Amendment `AM-008`.
- Single ledger: `research/logs/v40_run_report.json` (phases A–E, `completion_conditions`,
  `remaining_unresolved_items`). Judgment record: `research/logs/DECISIONS_v40.md`.
  The ledger is a sealed snapshot. `tools/v40/finalize_run_report_v4.py` cannot be re-run
  after a commit — its guard compares `git status` against a hardcoded baseline. Post-run
  facts go in `research/logs/v40_delivery_receipt.json` instead.
- Questions: HRS1_PERIOPERATIVE, HRS2_KIDNEY_DISEASE, HRS3_PREGNANCY, HRS4_LIVER_DISEASE,
  HRS5_ANTICOAGULATION. Corpus 48,031 record-question rows, PubMed only, 2022-01-01–2026-07-28.
- Screening is a two-layer agent method, not per-record inference. A deterministic text
  classifier the agent authored and audited (`tools/v40/agent_screen_worker.py`,
  `v40_deterministic_text_assist_3.3.0`) labelled all 48,031 rows; the agent read and
  re-adjudicated the 616 boundary cases (1.3%) in
  `research/screening/v40_agent/semantic_adjudications.json`, which override the worker.
  Say it that way. "The agent screened 100%" without that clause reads as per-record LLM
  reading and is the first thing a reviewer will challenge.
- Result: retain 3,374 / deprioritize 44,597 / uncertain 60, coverage 1.0, zero human
  decisions, zero screening-model calls. Evidence bundle 1,899 rows, core evidence 75
  (cap 15 per question), personalization rules 34.
- Disclosed weaknesses, keep them disclosed: the raw rules differed from the agent
  re-adjudication on 226 of 616 boundary cases (36.7%); 1,475 of 3,374 retain rows (43.7%)
  were dropped by the bundle's regex gate; all 44,597 deprioritize rows carry `off_topic`,
  so exclusion reasons are not broken down; the 60 `uncertain` rows are all abstract-less.
- Large payloads are local-only with hashes in `research/logs/v40_local_only_manifest.json`
  (2,007 files, 1,336 MiB): efetch XML, `data/curated_v4/evidence_map.csv` (over GitHub's
  100 MiB file limit), `v40_agent/batches/`, `etc/failed_classifier_*/`.
- `.gitattributes` pins every v4.0 path `-text`. Files whose SHA-256 the ledger records
  (`DECISIONS_v40.md`, `amendments.csv`, the protocol md) break on a fresh clone without it.
- `.vercelignore` must exclude v4.0 raw data or deployment dies with `Upload aborted`.
  Do not exclude `research/screening/` wholesale — `src/lib/final-research-validation.ts`
  imports JSON from it.
- Same naming rule as v3.0: `sensitivity_vs_ai_reference`, `specificity_vs_ai_reference`,
  `agreement_vs_ai_reference`, `ai_reference_standard`, `ai_cross_checked`. Never a bare
  `sensitivity`, `accuracy`, `gold_standard` or `validated`.
- `release_ready` stays false. Deployment is not clinical release approval.

## Research Pipeline (protocol v2.1 frozen comparison track)

- Corpus: `data/curated_v2/evidence_map.csv` — 20,230 record-question rows, 18,015 with an abstract.
- Two automated classifiers run over the same corpus:
  - rule-based `deterministic_dual_profile_v1` → `data/curated_v2/ai_screening_classifications.csv`
  - LLM exploratory (`tools/llm_screening.py`) → `data/curated_v2/llm_screening_classifications.csv`
- `tools/build_systematic_review_v3.py` keeps the regex PICOS extraction (it supplies sentence
  locators and doses) and applies the LLM `retain` decision as an additional topical gate.
- Labels are `retain` / `deprioritize` / `uncertain` — never human include/exclude.
- **Do not add sensitivity, specificity, precision, recall, F1 or accuracy to v2.1 outputs.** There
  is no human gold standard; `protocol-v2.0-ai-exploratory.md` §9 forbids reporting them. Only
  agreement between automated methods may be reported (`tools/compare_screening_methods.py`).
- `research/validation/screening_gold/` holds a frozen 420-row stratified sample that is deliberately
  unused. Do not wire it into any output without an explicit protocol amendment.
- Plan of record: `research/protocol/v2.1-measured-screening-plan.md`.

## Research Pipeline (protocol v3.0 full AI autonomy track)

- Protocol: `research/protocol/protocol-v3.0-full-ai.md`.
- Searches and raw PubMed records: `research/searches_v3/`.
- Independent corpus and screening output: `data/curated_v3/evidence_map.csv` and
  `data/curated_v3/llm_screening_classifications.csv`.
- Screening audit trail: `research/screening/v30_agent/` (batches, append-only
  `checkpoints.jsonl`, frozen prompt, manifest). The agent judges every row directly;
  no screening model is invoked.
- AI reference standard: `research/validation/screening_ai_reference_v3/`; synthesized comparison:
  `research/synthesis/screener_vs_ai_reference_v3.json`.
- PICOS extraction, core evidence, Korean translations and personalized rules:
  `research/systematic_review_v30/`.
- Keep v2.1 and v3.0 files separate. Never overwrite `data/curated_v2/`, `research/searches/`,
  `research/validation/screening_gold/` or the v2.1 screening logs with v3.0 output.
- The v3.0 reference is AI-generated, not a human gold standard. Use only the explicit names
  `sensitivity_vs_ai_reference`, `specificity_vs_ai_reference`,
  `agreement_vs_ai_reference`, `ai_reference_standard` and `ai_cross_checked`. Do not shorten
  these names to clinical accuracy claims such as `sensitivity`, `specificity`, `accuracy`,
  `gold_standard` or `validated`.
- Rebuild and validate the site evidence bundle with `npm run build:v30-evidence` and
  `npm run validate:v30-evidence`.

## Research Search Pipeline Context

- The thesis briefing should stay PubMed-centered for now. The Notion lab-meeting explanation intentionally omits Embase because it is harder to explain live.
- The Embase implementation still exists in `tools/search_pipeline/embase_adapter.py` as internal follow-up work. Do not remove it unless the user explicitly asks.
- The systematic search pipeline is Python-based and separate from the Next.js runtime:
  - Code: `tools/search_pipeline/`
  - Frozen v2.1 search outputs and log: `research/searches/` and `research/searches/search_log.csv`
  - Independent v3.0 search outputs and log: `research/searches_v3/` and
    `research/searches_v3/search_log.csv`
  - Versioned corpora: `data/curated_v2/evidence_map.csv` and `data/curated_v3/evidence_map.csv`
- Treat `data/knowledge_pack.json` as exploratory scoping data only. Thesis evidence must trace to
  the versioned search logs and corpora listed above.
- Current presentation framing: PubMed API prototype is implemented and actually run; Embase is implemented as a later RIS export automation path, but not part of the simple 260601 Notion explanation.
