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

## Research Pipeline (protocol v2.1)

- Corpus: `data/curated_v2/evidence_map.csv` — 20,230 record-question rows, 18,015 with an abstract.
- Two automated classifiers run over the same corpus:
  - rule-based `deterministic_dual_profile_v1` → `data/curated_v2/ai_screening_classifications.csv`
  - LLM exploratory (`tools/llm_screening.py`) → `data/curated_v2/llm_screening_classifications.csv`
- `tools/build_systematic_review_v3.py` keeps the regex PICOS extraction (it supplies sentence
  locators and doses) and applies the LLM `retain` decision as an additional topical gate.
- Labels are `retain` / `deprioritize` / `uncertain` — never human include/exclude.
- **Do not add sensitivity, specificity, precision, recall, F1 or accuracy anywhere.** There is no
  human gold standard; `protocol-v2.0-ai-exploratory.md` §9 forbids reporting them. Only agreement
  between automated methods may be reported (`tools/compare_screening_methods.py`).
- `research/validation/screening_gold/` holds a frozen 420-row stratified sample that is deliberately
  unused. Do not wire it into any output without an explicit protocol amendment.
- Plan of record: `research/protocol/v2.1-measured-screening-plan.md`.

## Research Search Pipeline Context

- The thesis briefing should stay PubMed-centered for now. The Notion lab-meeting explanation intentionally omits Embase because it is harder to explain live.
- The Embase implementation still exists in `tools/search_pipeline/embase_adapter.py` as internal follow-up work. Do not remove it unless the user explicitly asks.
- The systematic search pipeline is Python-based and separate from the Next.js runtime:
  - Code: `tools/search_pipeline/`
  - Search outputs: `data/systematic_search/`
  - PubMed search log: `data/systematic_search/search_runs.csv`
  - Retrieved records: `data/systematic_search/retrieved_records.csv`
- Treat `data/knowledge_pack.json` as exploratory scoping data only. Final thesis evidence should come from new systematic search logs under `data/systematic_search/`.
- Current presentation framing: PubMed API prototype is implemented and actually run; Embase is implemented as a later RIS export automation path, but not part of the simple 260601 Notion explanation.
