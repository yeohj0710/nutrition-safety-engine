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
