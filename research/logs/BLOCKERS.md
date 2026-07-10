# BLOCKERS

## B-001 — Protocol freeze and research identity

- exact block point: Gate 1 approval; final searches cannot begin under an unapproved protocol
- already attempted: located and verified the signed historical plan; read both professor feedback notes; compared the signed `종설논문` label with feedback `종설논문 아님`; drafted protocol v1.0 exists but is marked unapproved
- minimum input needed: dated supervisor decision approving protocol v1.0 or exact amendment text, including administrative treatment of the old thesis-type label
- affected artifacts: final title/scope, protocol registration/publication, all final searches and downstream screening
- work that can continue: access mapping, search syntax drafting, schemas, audit fixes, test infrastructure
- status: `blocked_external`

## B-002 — Independent reviewers for screening/extraction/scenario gold

- exact block point: human gold cannot be frozen and tool performance cannot be estimated independently
- already attempted: inventoried all existing screening and five scenario files; confirmed they are automated or developer-created and contain no independent reviewer/adjudication fields
- minimum input needed: named or coded reviewer roles, availability, and adjudication route for title/abstract sampling, all full texts, critical extraction fields, and scenario gold
- affected artifacts: Gates 3, 4, and 7; AI performance; engine sensitivity/precision
- work that can continue: forms, sampling code, blinded queue generation, metric code, synthetic dry runs not reported as results
- status: `blocked_external`

## B-003 — Expert review and human-participant determination

- exact block point: expert content-review claims and any usability data collection
- already attempted: found only templates/plans; no evidence of recruited experts or institutional determination
- minimum input needed: expert qualification/count plan and written IRB/non-human/exempt determination before recruitment or data collection
- affected artifacts: expert review, usability study, thesis methods/results wording
- work that can continue: non-human technical validation and review materials
- status: `blocked_external`

Detailed decision questions: `research/review_queue/phase_01_external_review.csv`.

## B-004 — Live re-access to original G: research folder

- exact block point: re-hashing original research files from the successor sandbox
- already attempted: direct `Test-Path` and Phase 01 audit access; sandbox returned access denied/unavailable
- available evidence: preserved 513-file, 57,398,308-byte inventory with per-file SHA-256 and source-report hash
- minimum input needed: future session/environment with the G: mount readable
- affected artifacts: live source-integrity refresh only; local code, protocol design, proxy queues, and later reproducible scaffolding continue
- status: `blocked_external`
