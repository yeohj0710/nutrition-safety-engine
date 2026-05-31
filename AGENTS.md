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
- Primary data source: `data/knowledge_pack.json`
- Runtime index: `src/generated/knowledge-index.json`

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
