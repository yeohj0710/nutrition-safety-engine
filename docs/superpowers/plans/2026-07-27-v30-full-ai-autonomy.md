# v3.0 Full AI Autonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate PubMed-only v3.0 research track whose PICOS design, search, complete screening, AI reference scoring, evidence synthesis, personalization, site outputs, thesis, and reports are produced without human adjudication.

**Architecture:** Keep `data/curated_v2/` and the frozen v2.1 search assets immutable. Write all new retrieval, screening, reference-scoring, and derived outputs under v3-specific paths, then point the site and thesis builders at explicit track manifests. Every numeric claim must be regenerated from saved inputs and hashes.

**Tech Stack:** Python 3, PubMed E-utilities XML, CSV/JSON/JSONL, Next.js 16, TypeScript, Vitest, python-docx, LibreOffice/Poppler QA.

---

This plan executes inline because the user prohibited approval waits and requested uninterrupted progress. The user-provided `goal-objective.md` execution order overrides the older order in `research/protocol/v3.0-full-ai-autonomy-plan.md`.

### Task 1: Freeze v2.1 and establish the v3.0 protocol

**Files:**
- Verify: `research/audit/v21_freeze_manifest.json`
- Create: `research/protocol/protocol-v3.0-full-ai.md`
- Modify: `research/protocol/amendments.csv`
- Create/modify: `research/logs/TIME_BUDGET.md`, `research/logs/DECISIONS_v30.md`, `research/logs/RESUME.md`

- [ ] Confirm tag `v2.1-frozen` points to the v2.1 baseline and verify the frozen `data/curated_v2/evidence_map.csv` SHA-256 is `7fbd8cab64c7ba874ec95c759c9597684151b020e4fdc4f708afbbdabf5aa7c2`.
- [ ] Verify the freeze manifest against the tagged tree without rewriting protected worktree files.
- [ ] Add protocol v3.0 and amendment AM-007, including AI-only PICOS, AI reference naming, zero human decisions, and v2.1 immutability.
- [ ] Run focused protocol and manifest checks, then commit only P0 files.

### Task 2: Generate independent AI PICOS and retrieve PubMed records

**Files:**
- Create: `research/searches_v3/ai_picos/picos_definition.json`
- Create: `research/searches_v3/ai_picos/prompt.txt`, `research/searches_v3/ai_picos/manifest.json`
- Create: `research/searches_v3/<question_id>/pubmed/<run_id>/query.txt`, `efetch_*.xml`, `checksum.sha256`, `response_metadata.json`
- Create: `research/searches_v3/search_log.csv`
- Create: `data/curated_v3/evidence_map.csv`, `data/curated_v3/corpus_manifest.json`
- Create: `tools/v30/pubmed_v3.py`, `tools/v30/test_pubmed_v3.py`

- [ ] Write tests for query validation, ESearch count parsing, EFetch pagination, PubMed-only normalization, duplicate record-question keys, and deterministic hashes.
- [ ] Define 3-6 questions from only the research topic, PubMed-only constraint, and required output schema; save the exact prompt and SHA-256.
- [ ] Probe ESearch counts at no more than three requests per second; narrow before EFetch if the combined cap would exceed 10,000.
- [ ] Save raw XML and request metadata, normalize to the v2-compatible CSV schema, and verify every row is PubMed-derived.
- [ ] Run `python -m pytest tools/v30/test_pubmed_v3.py -q`, record actual counts and hashes, then commit P1 files.

### Task 3: Screen 100% of the v3.0 corpus

**Files:**
- Create: `tools/v30/screen_v3.py`, `tools/v30/test_screen_v3.py`
- Create: `research/screening/v3/decision_prompt.txt`, `screening_runs.jsonl`, `manifest.json`
- Create: `data/curated_v3/llm_screening_classifications.csv`

- [ ] Freeze a prompt derived from `tools/llm_screening.py` with the new PICOS questions and store its hash.
- [ ] Process batches of 100 and append one result per requested `(record_id, question_id)` to the v3-only checkpoint.
- [ ] Force title-only rows to `evidence_basis=title_only`, `confidence=low`, and `insufficient_abstract`.
- [ ] After each five batches, verify exact key coverage and requeue only missing keys; do not claim completion until coverage is `1.0`.
- [ ] Generate the classification CSV and manifest with `execution_mode=agent_local`, distribution, prompt/input hashes, batch hashes, and `run_complete=true` only after validation.
- [ ] Run `python -m pytest tools/v30/test_screen_v3.py -q`, then commit P2 files.

### Task 4: Build a blinded AI reference standard and corrected estimates

**Files:**
- Create: `tools/v30/score_ai_reference_v3.py`, `tools/v30/evaluate_ai_reference_v3.py`
- Create: `tools/v30/test_ai_reference_v3.py`
- Create: `research/validation/screening_ai_reference_v3/`
- Create: `research/synthesis/screener_vs_ai_reference_v3.json`

- [ ] Draw a seeded stratified sample of 300 from P2 decision strata and save frame sizes, sample sizes, inclusion probabilities, and weights.
- [ ] Randomize blinded rows and run three independent element-level PICOS judgments without reading P2 labels.
- [ ] Apply the fixed aggregation rule, retain three-way disagreements as `unresolved`, and calculate inter-round agreement.
- [ ] Compute stratified `sensitivity_vs_ai_reference`, `specificity_vs_ai_reference`, and `agreement_vs_ai_reference` values.
- [ ] Apply Rogan-Gladen correction and 10,000 stratified bootstrap resamples; include up to 20 titled false-positive and false-negative examples.
- [ ] Run `python -m pytest tools/v30/test_ai_reference_v3.py -q`, then commit P3 files.

### Task 5: Regenerate the evidence map, personalization, and site

**Files:**
- Modify: `tools/build_systematic_review_v3.py`, `tools/build_core_evidence_v3.py`
- Create/modify: v3-specific outputs under `research/systematic_review_v3/` and `src/generated/`
- Modify: `research/systematic_review_v3/key_finding_translations_ko.json`
- Modify: relevant tests in `__tests__/`

- [ ] Add explicit v3 track inputs and outputs without overwriting v2.1 artifacts.
- [ ] Require sentence locators and source hashes; mark missing full text as `abstract_only`/`not_observed` and inferences as `ai_inference_unverified`.
- [ ] Record `llm_gate.applied=true`, `regex_passed`, `dropped_by_llm`, and `kept` in the v3 manifest.
- [ ] Expand personalization only for characteristics observed in v3 evidence and record supporting row counts.
- [ ] Emit and fill every Korean translation gap with `translation_authorship=ai_generated`.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`; do not deploy. Commit P4 files.

### Task 6: Regenerate thesis and repository documentation

**Files:**
- Create/modify: `tools/build_systematic_review_thesis_v3.py`
- Modify: `AGENTS.md`, `README.md`, `docs/project_map.md`
- Create: `tools/compare_picos_tracks.py`
- Create: `research/synthesis/picos_track_comparison.json`
- Create: `research/reports/발표원고_v3.0.md`, `research/reports/notion_update.md`
- Create/replace after backup: thesis `.docx` and `.pdf` under the specified G-drive thesis folder

- [ ] Back up current thesis DOCX/PDF with `_v21백업` before replacement.
- [ ] Build title, abstract, introduction, methods, results, discussion, limitations, and conclusion from v3 manifests only.
- [ ] Preserve the retained thesis layout, use installed static Pretendard families for Korean text, render the DOCX to PNGs, inspect every page, and verify the PDF render.
- [ ] Compare question coverage, term Jaccard, MeSH/field tags, hit counts, and PMID intersections/differences between tracks.
- [ ] Correct repository documentation and reserialize the phase-02 evidence manifest from parsed CSV rows; document the intentional phase-07 proxy skip.
- [ ] Write the slide-by-slide Korean script and paste-ready Notion update from manifests.
- [ ] Run focused document and comparison tests, then commit P5 files.

### Task 7: Synchronize deliverables and close the run

**Files:**
- Create: `research/logs/v30_run_report.json`
- Update: `research/logs/TIME_BUDGET.md`, `research/logs/RESUME.md`
- Copy: required artifacts to the specified G-drive appendix, thesis, and presentation folders

- [ ] Back up every existing destination before overwrite and copy only the required final artifacts.
- [ ] Record every copied path in `files_synced` and every reduction or unresolved item with its concrete reason.
- [ ] Populate all report sections from manifests; use `null` rather than estimates for unavailable values.
- [ ] Re-run protected-file SHA checks, focused tests, the full test/build suite, DOCX/PDF visual QA, and `git status`.
- [ ] Commit the final report and synchronized-source state; do not deploy.
