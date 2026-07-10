# Phase 06 gate status

Date: 2026-07-10  
Phase status: `blocked_external`

- Human-included studies: 0
- Verified extraction rows: 0
- RoB consensus rows: 0
- Meta-analyses performed: 0
- Certainty assessments: 0
- Validated claims: 0
- Thesis rules: 0
- Legacy automatic promotions: 0
- Curated source/report/study/extraction/RoB/certainty/claim/rule JSONL rows: 0/0/0/0/0/0/0/0
- Five question-specific meta-analysis decisions: all `not_assessed`, all `blocked_external`
- Claim-rule contract tests: 11/11 pass on synthetic-only bundle; legacy source, wrong quote hash, missing/draft/mismatched claim, missing/mismatched GRADE, unvalidated rule, missing expert review, and missing independent scenario all rejected
- Validated claim GRADE boundary: every claim requires an existing validated certainty row with identical question and certainty grade
- Production extraction boundary: source/report/extraction IDs, source IDs, locator hashes, quotes, and quote hashes must match upstream validated rows
- Production source-byte boundary: every curated source path must remain repository-local and non-legacy; thesis bundle generation reopens the file and reproduces its declared SHA-256 before accepting any claim
- Thesis bundle builder: production provenance validator runs before output and checks source/report/extraction existence and validation, source-row/hash match, quote hash, question consistency, human verifiers, expert review, and independent scenario evidence
- Future-safe gate: legitimate upstream human extraction/RoB rows are allowed; validated registry IDs must equal curated IDs, curated IDs/counts must equal the generated bundle, and completion remains only a candidate pending acceptance review
- GRADE input boundary: `certainty_assessments.csv` exactly matches the 22-field protocol template and requires distinct reviewers, consensus date, rationale, outcome, and final certainty before a row is treated as validated

No synthesis or pooling is justified. Empty registries are an enforced safety state, not a null-effect research result. Phase 06 requires human-frozen studies, verified extraction/RoB, question-specific synthesis, and GRADE before any claim or rule can be validated.

Human review routing is recorded in `research/review_queue/phase_06_external_review.csv`. The gate accepts progressive upstream data but rejects validated claims/rules introduced before extraction, RoB, and validated GRADE prerequisites. Empty, upstream-only, and complete-candidate progress contracts pass 3/3.

The contract fixture creates zero production claims and zero production rules. Its synthetic reviewer/scenario identifiers test cross-reference enforcement only and cannot enter the thesis bundle. The TypeScript provenance suite additionally verifies matching source bytes and rejects stale hashes and project-root escape paths.
