# Hard-coded and misleading count audit

Audit date: 2026-07-10

| ID | Legacy value or logic | Phase 01 disposition |
|---|---|---|
| HC-001 | 12,023 mixed PubMed run sum | quarantined; absent from default UI/API |
| HC-002 | 252,502 Europe PMC + Crossref mixed sum | quarantined; never treated as evidence count |
| HC-003 | wall-clock `generatedAt` | replaced with latest source `search_date`; repeat hash stable |
| HC-004 | nine fixed legacy ingredient IDs | retained only in `/legacy`; default scope comes from validated thesis bundle |
| HC-005 | `starter_validated -> high` | retained only for baseline reproduction; never thesis eligible |
| HC-006 | stale embedded pack counts | ignored for thesis; technical counts derived from arrays |
| HC-007 | legacy test expectations 236/214 | isolated to explicit legacy behavior; absent from thesis boundary |
| HC-008 | 110/126/176 repeated scenario rows | quarantined; prohibited as validation denominators |
| HC-009 | homepage pilot counts | removed from default page; legacy page carries warning |

Canonical legacy reproduction remains `research/audit/legacy_counts_reproduction.csv`. No legacy count is accepted as a new thesis result. Current thesis counts are derived by the builder: 0 validated sources/reports/studies/extractions/RoB/claims/rules at Phase 01.
