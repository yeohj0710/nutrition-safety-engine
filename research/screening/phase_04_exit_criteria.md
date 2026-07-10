# Phase 04 gate status

Date: 2026-07-10  
Phase status: `blocked_external`  
Proxy queue status: `complete_verified`

| Criterion | Status | Evidence |
|---|---|---|
| Screening storage and manual | pass_local | empty human-decision schema, full-text schemas, copied design manual |
| Priority dry run | pass_proxy_only | two deterministic proxy outputs; 19,961 units; 4,224 disagreements |
| All retrieval units retained for people | pass_proxy_only | PubMed queue 19,961 plus ClinicalTrials.gov queue 207; no prefilled decision |
| AI-only exclusions | pass | 0 |
| Human title/abstract or registry decisions | blocked_external | 0/20,168 database-question retrieval units |
| Human pilot training | blocked_external | 0/50 |
| Full-text double review | blocked_external | 0 reports assessed |
| Final reports/studies | blocked_external | not created |
| PRISMA final flow | blocked_external | explicitly unavailable |
| Human gold hash and AI performance | blocked_external | no human gold |

Phase 04 is not complete. Proxy bands must not appear as inclusion decisions or thesis results.

The 20,168 total is a retrieval-unit workload count (19,961 PubMed plus 207 ClinicalTrials.gov), not a deduplicated-record, included-report, study, or final PRISMA count. All 139 A1 registry units carry the known vitamin-K-antagonist lexical-risk flag.
