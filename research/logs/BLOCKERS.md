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

Status: `resolved_2026-07-10`.

- exact block point: re-hashing original research files from the successor sandbox
- already attempted: direct `Test-Path` and Phase 01 audit access; sandbox returned access denied/unavailable
- available evidence: preserved 513-file, 57,398,308-byte inventory with per-file SHA-256 and source-report hash
- minimum input needed: future session/environment with the G: mount readable
- affected artifacts: live source-integrity refresh only; local code, protocol design, proxy queues, and later reproducible scaffolding continue
- resolution evidence: `research/audit/live_source_reconciliation.json`; 513/513 exact match, mismatch 0
- status: `resolved`

## B-005 — Independent PRESS review

- exact block point: final search-string freeze and final multi-database execution
- already attempted: five PubMed drafts, live counts, 9-sentinel recall test, B1 recall correction, platform translation drafts, seven-row PRESS queue
- minimum input needed: independent information specialist/systematic-reviewer decision for each queue row, including A1/B2 workload refinements
- work that can continue: public API pilot exports, pipeline and dedup tests, review-package preparation
- status: `blocked_external`

## B-006 — Subscription database and full-text access

- exact block point: authenticated Embase, CENTRAL, Scopus/WoS exports and paywalled full-text verification
- already attempted: official access/export documentation checked; public-source routes recorded
- minimum input needed: institution/session-specific access outcome and export limits
- work that can continue: PubMed, ClinicalTrials.gov, public registry pilots; open-access locator work
- status: `blocked_external`

## B-007 — Human deduplication and study linkage

- exact block point: final unique-record denominator, record→report→study graph, and PRISMA flow
- already attempted: checksum-verified normalization; cross-question PMID collapse; 342 exact DOI/title candidate pairs and 19,609 report-linkage rows generated
- minimum input needed: human decisions for all candidate duplicates, 10% audit sample, and study linkage for potentially included reports
- work that can continue: blinded/synthetic screening dry runs, queue tooling, metric code
- status: `blocked_external`

## B-008 — Human screening and full-text adjudication

- exact block point: final include/exclude decisions, full-text exclusions, reports/studies, PRISMA, and AI gold
- already attempted: all-unit human queue, two non-decisional proxies, disagreement flags, 50-row training pilot, blank decision/full-text schemas; resolved 5,563 public PMC locator candidates from all 19,609 PMIDs
- minimum input needed: independent reviewer IDs/training decisions, adjudication route, full-text access, and completed decisions
- work that can continue: lawful PMC payload acquisition and locator manifesting; extraction schema validation with synthetic fixtures, metric code, error taxonomy
- status: `blocked_external`

## B-009 — Verified extraction, RoB, and AI gold

- exact block point: evidence values, RoB judgments, AI extraction performance, synthesis inputs
- available preparation: schema invariant tests, locator rejection, Wilson metric harness, empty human/RoB tables
- minimum input needed: frozen included reports, lawful full texts, independent human extraction/RoB and consensus gold
- status: `blocked_external`

## B-010 — Isolated Python dependency download

Status: `resolved_2026-07-10`.

- exact block point: installing `jsonschema==4.25.1` into `.venv`
- attempted: two pip installs with bounded retries/timeouts; both timed out
- workaround: standard-library critical invariant validator; design package still reports schema meta-validation warning
- resolution evidence: `.venv` installed `jsonschema==4.25.1` and `PyYAML==6.0.3`; bundle validator errors 0, warnings 0; `requirements-research.lock.txt`
- status: `resolved`

## B-011 — Independent engine gold, expert review, and validated deployment

- exact block point: clinical sensitivity/precision, content validation, release approval
- available preparation: deterministic thesis engine, 120-case safe-empty proxy, CI workflow, runtime AI removal
- minimum input needed: validated claim/rule bundle; two independent scenario authors/adjudication; qualified experts; release artifact and deployment identity
- status: `blocked_external`

## B-012 — Subscription database entitlement

- exact block point: reproducible Embase and Scopus final searches/exports
- live check: existing Chrome session reached Embase `landing?status=grey` and Scopus Preview; both exposed `Sign in`/`Check access`, with no authenticated search entitlement
- partial access: CENTRAL public search/filter interface executed five question queries and exposed 2,264 trial hits; trial page states authentication is required for full content; records exported 0
- minimum input needed: institutional or personal licensed access for Embase and Scopus/WoS, then complete native exports and search histories
- work that can continue: CENTRAL query refinement/hit-count reproducibility; PubMed, registries, Korean databases, citation chasing, queue/test tooling
- status: `blocked_external`

## B-013 — KoreaMed native export server failure

- exact block point: reproducible native citation/XML export for the 62-result A1 design-pilot set
- live evidence: all 62 results displayed (`1-62`) and selected; Download returned server-side temp-file permission and fopen/fwrite/fclose/readfile/unlink failures; downloaded files 0
- preserved workaround: complete displayed KMID/title capture with 62 unique IDs and checksums; never labeled native export or final search
- minimum external change: KoreaMed repairs export service, then rerun native export and compare all identifiers/hashes
- work that can continue: human screening queue, exact-title PubMed linkage review, query PRESS/synonym expansion, KMbase/RISS access checks
- status: `blocked_external`
