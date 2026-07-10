# DECISIONS

## D-001 — Canonical implementation repository

- date: 2026-07-10
- decision: use `C:\dev\nutrition-safety-engine` as implementation repository; use `G:\내 드라이브\여형준님\24 전공심화실습(1)\여형준` as legacy research-input root; preserve the redesign package from its sibling directory as the Phase 01 reference baseline
- alternatives: initialize Git inside the redesign package; clone a second repository into the Google Drive folder
- rationale: parent `AGENTS.md` names `C:\dev\nutrition-safety-engine`; its remote is the required GitHub repository; current `HEAD` matches `origin/main`
- impact: audit artifacts and code changes live in the Git repository; source research files remain in place and are never deleted
- approver or provisional assumption: provisional implementation decision derived from repository evidence and user instructions
- review condition: reconsider only if a newer supervisor-designated canonical repository is found

## D-002 — Execution mode

- date: 2026-07-10
- decision: execute the Phase 01 plan inline in the current session
- alternatives: pause after planning; delegate tasks
- rationale: user explicitly requested immediate end-to-end reconstruction and designated Phase 01 as first work; no delegation requested
- impact: no Phase 02 completion claim until Phase 01 exit and QA evidence are evaluated
- approver or provisional assumption: user request
- review condition: user changes scope or requests delegation

## D-003 — Legacy quarantine storage mode

- date: 2026-07-10
- decision: retain legacy files in place and quarantine them through a complete SHA-256 manifest reference instead of duplicating or deleting them
- alternatives: move every legacy file under `data/legacy_unverified`; duplicate the full data tree
- rationale: the redesign migration plan explicitly allows a manifest reference; in-place retention preserves baseline build reproduction without creating duplicate tracked data or deleting evidence
- impact: every listed file has status `legacy_unverified`; none is an allowed default input to the new thesis bundle
- approver or provisional assumption: implementation decision under the supplied migration plan
- review condition: move files only if later repository architecture requires a physical namespace change and all references/tests are migrated

## D-004 — Legacy validation labels

- date: 2026-07-10
- decision: treat all 110 legacy rules as `legacy_unverified` regardless of `starter_validated` or generated `high` confidence
- alternatives: accept the old labels; promote only heuristic in-scope rows
- rationale: no accepted claim layer, exact full-text support chain, second-person verification, risk-of-bias assessment, or scenario validation exists
- impact: thesis-mode eligible legacy rules = 0; heuristic A1-A2-B1-B3 labels are review candidates only
- approver or provisional assumption: mandated by the redesign package and user instructions
- review condition: each rule may re-enter only through a newly validated claim and the formal rule workflow

## D-005 — Phase 01 application behavior boundary

Status: superseded by D-007 after the reproducible baseline was captured.

- date: 2026-07-10
- decision: preserve the legacy app as an audited comparison baseline during Phase 01, while creating a separate curated-only thesis bundle with zero auto-promoted records
- alternatives: immediately break/remove the legacy app; pretend the legacy app is thesis mode
- rationale: Phase 01 requires reproducible baseline evidence and non-destructive isolation; validated data do not yet exist
- impact: current production remains explicitly labeled `legacy_unverified_production` in audit records and cannot satisfy release criteria
- approver or provisional assumption: provisional migration sequencing decision
- review condition: satisfied locally by D-007; Gate 7 must still verify the deployed artifact

## D-006 — Writable authoritative successor worktree

- date: 2026-07-10
- decision: use `C:\Users\hjyeo\Documents\Codex\2026-07-10\g-24-1-gpt-5-6\work\nutrition-safety-engine` as the execution worktree; preserve `C:\dev\nutrition-safety-engine` unchanged as its source copy
- rationale: only the successor path is writable without repeated sandbox approval; branch, HEAD, dirty state, and key hashes matched after copy
- impact: all further commands and commits run in the successor worktree

## D-007 — Physical legacy quarantine and default boundary

- date: 2026-07-10
- decision: physically move all 36 legacy files into `data/legacy_unverified/baseline-33658e3` or `src/generated/legacy`, expose them only through explicit legacy routes, and make thesis mode the default
- rationale: a manifest-only quarantine did not prevent runtime leakage
- impact: default thesis mode contains zero auto-promoted records; legacy baseline remains reproducible

## D-008 — Unavailable research drive evidence

Status: superseded after live re-access on 2026-07-10.

- date: 2026-07-10
- decision: when G: is unavailable, use the preserved 513-file SHA audit as a labeled snapshot, never as a claim of live re-access
- rationale: preserves evidence without requesting permissions or fabricating verification
- impact: historical snapshot handling remains documented; live reconciliation now proves exact 513-file continuity

## D-014 — Legacy research tables remain unverified after live access

- date: 2026-07-10
- decision: do not promote G: CSV rows despite exact file-integrity verification
- rationale: integrity proves files are unchanged, not that automated screening, locator-free extraction, adapted quality labels, or developer scenarios are valid human evidence
- impact: legacy content remains useful for audit/sentinel discovery only; all final decisions restart under the new protocol

## D-009 — Phase 02 search status boundary

- date: 2026-07-10
- decision: label all searches before dated supervisor and PRESS approval `design_pilot_not_final_search`
- rationale: allows reproducibility and workload testing without retrospective protocol-freeze claims
- impact: pilot hit counts cannot enter PRISMA or thesis results; later approved searches get new run IDs and raw exports

## D-010 — B1 recall correction

- date: 2026-07-10
- decision: add `Urinary Calculi` and urinary/urinary-tract stone terms to B1–B3 PubMed disease blocks
- rationale: initial B1 draft missed sentinel PMID 21525191 because its indexing/title used urinary rather than kidney terminology
- impact: B1 pilot increased from 1,200 to 1,353 and sentinel recall became 9/9 overall; change occurred before final search approval

## D-011 — Public search payload distribution

- date: 2026-07-10
- decision: keep 266 MB raw PubMed XML and 39 MB abstract-rich normalized records local; track query, IDs, metadata, checksums, queues, code, and manifest in Git
- rationale: preserves originals and reproducibility without publishing a large copyright-sensitive abstract corpus
- impact: final/submission manifest must include local files and verify them; repository alone is insufficient for raw-data reproduction

## D-012 — No automated dedup finalization

- date: 2026-07-10
- decision: generate exact DOI/title candidate pairs but leave all canonical/cluster decisions blank pending human review
- rationale: record duplication and same-study linkage are human methodological judgments
- impact: deduplication and PRISMA counts remain blocked; synthetic screening may use unique PMID records only as a dry run

## D-013 — Screening proxy semantics

- date: 2026-07-10
- decision: proxy outputs use `include_candidate`, `uncertain`, and `low_priority_review`; never `exclude`
- rationale: AI/heuristic-only exclusion is prohibited and no human gold exists
- impact: every one of 19,961 record-question units remains in the human queue; proxy metrics are plumbing diagnostics only

## D-014 — PMCID is a locator, not proof of full-text availability

- date: 2026-07-10
- decision: classify each PMC EFetch response as OA full-text XML or metadata-only/non-OA before creating any extraction source
- rationale: the three-sentinel pilot returned one OA body and two front-only records despite all having PMC IDs and PDF indicators
- impact: no PMCID candidate is treated as retrieved full text; non-OA reports require documented library/publisher access after human screening advancement

## D-015 — Extraction locators are source-bound contracts

- date: 2026-07-10
- decision: every future extracted field must carry a non-legacy source path, exact source SHA-256, and either page or XML locator; XML paragraph support also carries its text SHA-256
- rationale: a human-readable section label alone cannot prove which immutable source bytes support a value
- impact: wrong hashes, missing locations, nonexistent paragraphs, and legacy sources fail before any candidate can enter human verification

## D-016 — Thesis rules require validated cross-entity provenance

- date: 2026-07-10
- decision: a `validated_thesis_scope` rule must reference existing validated claims for the same question, source-bound human-verified support, expert review, and independent scenario evidence
- rationale: JSON shape alone cannot prove referential integrity or validation sufficiency
- impact: draft/missing/mismatched claims, wrong quote hashes, legacy sources, and incomplete validation evidence are rejected before bundle generation

## D-017 — Synthetic review cannot become independent gold

- date: 2026-07-10
- decision: keep synthetic-input expert review and double-authored independent-gold creation in separate queues
- rationale: reviewers judging agent-generated cases are not independent scenario authors and cannot establish unbiased clinical performance
- impact: synthetic queue feedback may refine coverage only; sensitivity/precision remain prohibited until the blank gold queue is independently authored, adjudicated, and hash-locked
