# Phase 05 gate status

Date: 2026-07-10  
Phase status: `blocked_external`  
Synthetic metric harness: `complete_verified`

| Criterion | Status |
|---|---|
| Extraction and RoB schemas | pass_local |
| JSON Schema draft validation | pass_local: Draft 2020-12 schema valid; valid/invalid expectations enforced for 3 fixtures |
| Extracted value requires quote+locator | pass_contract: schema requires nonempty quote, page or XML locator, source path, and source SHA-256 |
| Real source locator contract | pass_contract_only: PMC5037562 raw gzip + paragraph locator/hash bound; wrong source hash, paragraph hash, XML locator, and legacy source all rejected |
| Source→report→record→PMCID lineage | pass_contract_only: RPT-PUBMED-27657121→REC-PUBMED-27657121→PMC5037562→raw gzip→paragraph 1 hash reproduced; report remains unlinked/unincluded |
| Human/AI boundary mutations | pass_contract_only: 6/6 missing quote, unknown report, premature study link, populated extraction, populated RoB, and nonzero AI-run mutations rejected |
| Wilson metric implementation | pass_synthetic_fixture |
| Independent Phase 05 validator | pass_proxy_only: errors 0; fixture count 3; real fixture has no value/quote/extracted status; human/RoB/AI rows 0/0/0 |
| Included full-text→extraction/RoB routing | pass_local | source/study/design/two-reviewer gate; RCT→RoB 2 only; nonrandomized tool pending human freeze; 6/6 contracts |
| Verified human extraction | blocked_external: 0 rows |
| Independent RoB and consensus | blocked_external: 0 rows |
| Frozen human gold | blocked_external |
| Actual AI extraction runs/metrics | blocked_external: 0 runs |

Synthetic metric values are test fixtures, not thesis or AI performance results.

The real-source contract fixture uses only an OA source path/hash and paragraph locator/hash to test provenance. It contains no extracted value, supporting quote, inclusion status, or AI output and therefore is not research evidence.

Human extraction, RoB, and actual AI evaluation cannot start until Phase 04 freezes included reports and lawful full texts. Review routing is recorded in `research/review_queue/phase_05_external_review.csv`.
