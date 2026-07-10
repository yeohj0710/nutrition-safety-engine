# Phase 01 data lineage audit

Audit date: 2026-07-10  
Baseline commit: `33658e3a9ee8dbf6d21ac94a5aa49202b5bf22e5`

## Default thesis path

```text
data/curated/{sources,reports,studies,extractions,risk_of_bias,claims,rules}.jsonl
  -> scripts/build-thesis-bundle.ts
  -> src/generated/thesis-bundle.json
  -> src/evidence/load-thesis-bundle.ts
  -> src/engine/run-thesis-engine.ts
  -> app/api/rules/query/route.ts
  -> app/page.tsx
```

Only `validated` records in `validated_thesis_scope` can enter the generated bundle. Phase 01 inputs are intentionally empty: 0 claims and 0 rules. The default response is deterministic and does not read legacy paths.

## Explicit legacy path

```text
data/legacy_unverified/baseline-33658e3/knowledge_pack.json
  -> scripts/build-knowledge-index.ts
  -> src/lib/knowledge/normalize.ts
  -> src/generated/legacy/knowledge-index.json
  -> src/lib/knowledge/index.ts
  -> src/lib/safety-engine/index.ts
  -> app/api/legacy/rules/query/route.ts
  -> app/legacy/**
```

The 36-file move manifest and SHA comparison report 0 mismatches. Legacy content is reachable only through `/legacy` or `/api/legacy/**`, carries `legacy_unverified`, and is excluded from sitemap/indexing. It remains available for baseline reproduction, not thesis evidence.

The quarantined pack contains 126 sources, 34 ingredients, 176 evidence chunks, and 110 rules. Identifier linkage is structurally intact, but semantic validity is not established. Thirty chunks use search snippets, 54 abstract locators, 23 summary locators, only 2 full-text locators, and 4 table locators. Thesis eligibility remains 0.

## Legacy search path

```text
data/legacy_unverified/baseline-33658e3/systematic_search/**
  -> scripts/build-literature-candidates.ts
  -> src/generated/legacy/literature-candidates.json
  -> legacy engine and /legacy UI only
```

The June 3 PubMed pilot reports 8,957 hits but stores relevance-ranked top-100 exports per query. Automated candidate decisions are not human inclusion decisions. The generator now derives `generatedAt` from source search dates, so identical inputs produce identical output hashes; invalid mixed counts remain quarantined from the default UI.

## Runtime AI disposition

The exposed `/api/ai-explain` route, `src/lib/ai/**`, and related test were byte-preserved under `research/legacy_unverified/runtime_ai/`. `research/audit/runtime_ai_archive.json` records five files and 0 SHA mismatches. The original runtime route/module files were removed, and the client no longer makes model calls. The production build emits no `/api/ai-explain` route.

## Preserved semantic failure

The old production input `warfarin + CoQ10` selected a fatigue meta-analysis beneath an INR-interaction message. This proves that valid IDs alone do not establish claim support. No legacy source, claim, or rule is promoted; later validated claims require report/source and exact locator links.

## Research-input live reconciliation

The original G: root was re-opened on 2026-07-10 and all 513 files (57,398,308 bytes) were rehashed. `research/audit/live_source_reconciliation.json` reports 0 missing files, 0 additions, and 0 content mismatches against the preserved audit. `repo_inventory.json` now records `live_filesystem_hash` and `live_reaccessed=true`.
