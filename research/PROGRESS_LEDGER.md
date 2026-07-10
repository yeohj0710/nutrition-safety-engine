# Research progress ledger

| Phase | Status | Verified evidence | Open dependency |
|---|---|---|---|
| 01 audit and normalization | complete_verified | audit validator errors 0; 36-file legacy quarantine; AI archive; full software chain pass | public release remains legacy baseline |
| 02 protocol and search design | blocked_external | 21-artifact SHA-bound evidence manifest; PubMed drafts/19,961 hits; CENTRAL 2,264 hit-count-only; KMbase/RISS 40 raw responses; 40-row PRESS handoff; 9/9 sentinels | dated supervisor approval, independent PRESS decisions 0, authenticated subscriptions/exports |
| 03 retrieval and deduplication | blocked_external_proxy_verified | 103 raw XML reparsed; 19,609 records/19,961 retrievals source-matched; 342 duplicate pairs independently reproduced; 5/5 mutations rejected; human queues blank | approved final searches; CENTRAL/KoreaMed/other exports; human dedup/registry decisions; study linkage |
| 04 screening and full text | blocked_external_proxy_verified | retrieval→primary→blinded secondary 5/5→full-text double-review 6/6 routing; PMC sentinel 1 OA XML/19 paragraph hashes + 2 non-OA rows; human decisions 0 | human primary/secondary/registry/full-text review, non-OA requests, adjudication, final reports/studies/PRISMA |
| 05 extraction quality and AI | blocked_external_proxy_verified | exact 55-field extraction schema; verified fulltext→extraction/RoB routing 6/6; report→PMCID→paragraph contract; fail-closed production AI evaluator with run-field denominators and raw input/prompt/output SHA lineage, contracts 6/6, empty metrics null; human/RoB/gold/AI/review 0/0/0/0/0 | included reports, human-verified locators/extraction/RoB/gold, actual AI runs and field review |
| 06 synthesis claims and rules | blocked_external_safe_empty | five no-analysis decisions; 11/11 contract tests; extraction→GRADE→claim→rule production gate; certainty/claim/rule registries 0; legacy promotion 0 | accepted extraction/RoB, human synthesis/GRADE, expert and independent-scenario validation |
| 07 engine validation and release | blocked_external_safe_empty_verified | deterministic matcher; 47 tests; local production smoke 11/11; SHA-bound 120×3 proxy; legacy leakage 0; validated deployment false | validated rules, independent authored/adjudicated gold, expert review, release manifest and verified deployment |
| 08 thesis and finalization | blocked_external_checkpoint_manifested | A-K readiness manifest: 11 gates open, finalization false; methods-only nonfinal DOCX/PDF with 8/8-page QA | frozen results, department format, final DOCX/PDF, validated deployment, final manifest |

No later phase is complete. Synthetic-proxy artifacts are dry-run evidence only.

External handoff: 21 hash-bound queues/templates, 20,900 current rows, protected human fields populated 0. Follow `research/review_queue/HUMAN_HANDOFF.md` in dependency order.
