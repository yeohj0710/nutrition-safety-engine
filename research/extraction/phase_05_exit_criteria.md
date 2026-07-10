# Phase 05 gate status

Date: 2026-07-10  
Phase status: `blocked_external`  
Synthetic metric harness: `complete_verified`

| Criterion | Status |
|---|---|
| Extraction and RoB schemas | pass_local |
| JSON Schema draft validation | pass_local: Draft 2020-12 schema valid; two synthetic candidates schema-valid |
| Extracted value requires quote+locator | pass_synthetic_fixture |
| Wilson metric implementation | pass_synthetic_fixture |
| Independent Phase 05 validator | pass_proxy_only: errors 0; fixture count 2; human/RoB/AI rows 0/0/0 |
| Verified human extraction | blocked_external: 0 rows |
| Independent RoB and consensus | blocked_external: 0 rows |
| Frozen human gold | blocked_external |
| Actual AI extraction runs/metrics | blocked_external: 0 runs |

Synthetic metric values are test fixtures, not thesis or AI performance results.

Human extraction, RoB, and actual AI evaluation cannot start until Phase 04 freezes included reports and lawful full texts. Review routing is recorded in `research/review_queue/phase_05_external_review.csv`.
