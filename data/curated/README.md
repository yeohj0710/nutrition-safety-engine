# Curated research data

Canonical inputs for the new thesis release pipeline.

- `sources.jsonl`, `reports.jsonl`, `studies.jsonl`: source/report/study provenance.
- `extractions.jsonl`, `risk_of_bias.jsonl`: structured evidence and appraisal records.
- `claims.jsonl`: only human-verified claims may later advance to `validated`; every claim must carry `scope_status`.
- `rules.jsonl`: every validated rule must reference at least one validated claim and carry `scope_status`.
- Empty files are intentional at Phase 01. No legacy item is automatically promoted.

Legacy repository data remains referenced by `data/legacy_unverified/manifest.json` and is excluded from `scripts/build-thesis-bundle.ts`.
