<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## What this repository is

One study and one site. The study builds an AI-selected evidence map for supplement safety
in five high-risk clinical situations; the site is the deterministic lookup tool over it.
Earlier tracks (v1.0, v2.0/v2.1, v3.0) were removed on 2026-07-28 — they exist in git history
and are not part of the thesis. Do not reintroduce them or cite their numbers.

## Why paths still say `v40`

Artifact paths carry a `v40` / `v4` marker (`research/searches_v4/`,
`research/systematic_review_v40/`, `research/screening/v40_agent/`, `data/curated_v4/`,
`tools/v40/`). **Do not rename them.** `research/logs/v40_run_report.json` is a sealed ledger
that records 297 artifact paths with SHA-256, and 296 of them contain that marker — including
the `raw_source_path` on every evidence record. Renaming silently breaks the recorded chain,
and the ledger cannot be regenerated: `tools/v40/finalize_run_report_v4.py` compares
`git status` against a hardcoded baseline and refuses to run once the tree is committed.
The marker is provenance, not a version label.

## The site

- Page: `app/page.tsx` — the only route.
- API: `app/api/personalized-safety/route.ts`.
- Input UI: `src/components/personalized-safety-query.tsx`.
- Situations and axes: `src/lib/clinical-situations.ts`. These strings must match
  `question_id` and `personalization_axis` in the rules file exactly.
- Data: `research/systematic_review_v40/{manifest,core_manifest,personalized_rules}.json`.

How the lookup works: each situation has a `base` rule holding that question's core evidence,
and each personalization axis holds the subset of those papers that actually report that
axis. A filled input box becomes an axis; the result is the intersection. An empty form
returns the situation's core evidence. A situation missing an axis (HRS2 has no `sex` rule)
must be reported as unapplied, never silently filtered.

Two rules the site must not break:

- **No clinical direction.** The rules carry `clinical_recommendation: false`,
  `decision_authority: "none"`, `output_scope: "evidence_linking_only"`. The site links
  evidence and shows where each sentence came from. It does not tell anyone to start, stop,
  or change a dose. `__tests__/personalized-safety-ui-contract.test.ts` enforces this.
- **No external model call.** The thesis claims a deterministic tool, so the same input must
  return the same evidence. A previous implementation called OpenAI for input normalization
  and summaries; that key is shared with a production service and exhausting it stops that
  service too.

## The research pipeline

- Protocol: `research/protocol/protocol-v4.0-mecir-search.md`, amendment `AM-008`.
- Single ledger: `research/logs/v40_run_report.json` — phases A–E, `completion_conditions`,
  `remaining_unresolved_items`. Judgment record: `research/logs/DECISIONS_v40.md`.
  Post-run facts (commit, push, deploy) go in `research/logs/v40_delivery_receipt.json`,
  never by editing the ledger.
- Questions: HRS1_PERIOPERATIVE, HRS2_KIDNEY_DISEASE, HRS3_PREGNANCY, HRS4_LIVER_DISEASE,
  HRS5_ANTICOAGULATION. Corpus 48,031 record-question rows, PubMed only, 2022-01-01–2026-07-28.
- Screening is a two-layer agent method, not per-record inference. A deterministic text
  classifier the agent authored and audited (`tools/v40/agent_screen_worker.py`,
  `v40_deterministic_text_assist_3.3.0`) labelled all 48,031 rows; the agent read and
  re-adjudicated the 616 boundary cases (1.3%) in
  `research/screening/v40_agent/semantic_adjudications.json`, which override the worker.
  Describe it that way. "The agent screened 100%" without that clause reads as per-record
  LLM reading and is the first thing a reviewer will challenge.
- Result: retain 3,374 / deprioritize 44,597 / uncertain 60, coverage 1.0, zero human
  decisions, zero screening-model calls. Evidence bundle 1,899 rows, core evidence 75
  (cap 15 per question), personalization rules 34.

### Disclosed weaknesses — keep them disclosed

- The raw classifier rules differed from the agent re-adjudication on 226 of 616 boundary
  cases (36.7%). That 226 is not a decision-disagreement count: it decomposes into 77
  decision flips (12.5%) and 149 rows where only reason codes or confidence differed
  (24.2%). Of the 77 flips, 53 were retain → deprioritize.
- **The scoring arm found the screening retains too little.** An independent blinded second
  reading of a stratified probability sample (1,033 rows, `_vs_ai_reference` metrics) puts
  the retain share at 15.33% (95% CI 10.17–21.12%) against the pipeline's 7.02%
  — 2.18×. `specificity_vs_ai_reference` is 88.52%, so roughly 11.5% of the 44,597
  deprioritize rows would have been retained by the second reading. The evidence bundle
  may therefore be missing relevant records. Details: `research/synthesis/screener_vs_ai_reference_v40.json`.
- 1,475 of 3,374 retain rows (43.7%) were dropped by the bundle's regex gate.
- All 44,597 deprioritize rows carry `off_topic`, so exclusion reasons are not broken down.
- The 60 `uncertain` rows are all abstract-less; the label means missing text, not doubt.
- PubMed only. No second database, no grey literature, no citation searching.

### The scoring arm (done 2026-07-30)

The screening has now been measured against an **AI reference standard**, not a human one.
There are still zero human decisions, so `independent_blinding` stays false and every metric
name carries its comparator (see the naming rule below).

- Directive: `research/protocol/HANDOFF_v40_scoring.md`. Judgment record:
  `research/logs/DECISIONS_v40_scoring.md`. Tools: `tools/v40_scoring/`.
- Design: stratified probability sample, seed `20260729`, SHA-256 rank ordering. Four
  stratum families exhaustively partition all 48,031 rows (ΣN = 48,031): worker-retain and
  worker-deprioritize at 36 per question, plus the 57 `uncertain` rows and all 616
  adjudicated boundary rows as censuses. n = 1,033.
- Blinding: cards carry only `record_id, question_id, title, abstract, publication_types,
  mesh_terms`; a leak check passed and labels were hash-locked before the sealed truth was
  opened (`lock_receipt.json`, `truth_opened_before_lock: false`).
- Population-weighted result: `agreement_vs_ai_reference` 86.95%,
  `sensitivity_vs_ai_reference` 66.23%, `specificity_vs_ai_reference` 88.52%,
  `precision_vs_ai_reference` 30.35%, `f1_vs_ai_reference` 41.63%, Cohen κ 0.463
  (unweighted, 3-class). Per layer: worker classifier κ 0.423, agent adjudication κ 0.494.
- **Rogan–Gladen adds nothing in this design and must not be cited as corroboration.**
  Because the strata are defined on the reference labels, the weighted marginal reproduces
  the census retain count exactly, and the Se/Sp fed into the correction come from the same
  sample; substituting N = P + Q collapses it to the design-based estimator (observed gap
  5.8e-16). Only externally estimated Se/Sp would make it a correction.

Still missing: any human-adjudicated reference, a second database, grey literature, and
citation searching.

## Naming rule (violating it invalidates the reporting)

There is no human gold standard. Metrics must name their source:
`sensitivity_vs_ai_reference`, `specificity_vs_ai_reference`, `agreement_vs_ai_reference`,
`ai_reference_standard`, `ai_cross_checked`. Never a bare `sensitivity`, `specificity`,
`accuracy`, `gold_standard`, or `validated`. `independent_blinding` means human blinding and
stays false. `release_ready` stays false — deployment is not clinical release approval.

## Operational traps

- `.gitattributes` pins every research path `-text`. With `core.autocrlf=true` an unmarked
  file is checked out with CRLF, which rewrites the LF inside quoted CSV abstract fields and
  breaks the recorded hashes with no content change. Recovery record:
  `research/logs/reproducibility_diagnosis_20260720.md`.
- Large payloads are local-only with hashes in `research/logs/v40_local_only_manifest.json`
  (2,007 files, 1,336 MiB): efetch XML, `data/curated_v4/evidence_map.csv` (over GitHub's
  100 MiB file limit), `v40_agent/batches/`, `etc/failed_classifier_*/`.
- `.vercelignore` must exclude the raw research data or deployment dies with
  `Upload aborted`. Uploading everything is about 1.4 GB; excluded it is under 60 MB.
- Deployment is Vercel CLI only (`npx vercel --prod --yes`). There is no GitHub integration,
  so pushing does not deploy.
- `tools/search_pipeline/` is kept for the unresolved second-database gap. Do not remove
  `embase_adapter.py` unless the user explicitly asks.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` after site changes.
