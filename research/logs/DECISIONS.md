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

## D-018 — Methods checkpoint is not a thesis result artifact

- date: 2026-07-10
- decision: permit a visibly non-final methods-only DOCX/PDF before results freeze, while mechanically rejecting results-dependent sections and any final-thesis claim
- rationale: document generation, Korean typography, and source-method correspondence can be tested without fabricating results
- impact: the eight-page checkpoint may support format review only; final thesis generation remains blocked until upstream human gates and department-format confirmation close

## D-019 — Bind Phase 02 evidence without freezing final searches

- date: 2026-07-10
- decision: hash-bind the current protocol/search/PRESS evidence while keeping protocol approval, PRESS completion, registration, and final-search permission explicitly false
- rationale: byte integrity is locally provable, whereas methodological approval and licensed database execution require independent people or access
- impact: later edits to any of 21 core artifacts fail validation, but a passing manifest cannot be cited as Phase 02 completion

## D-020 — Reparse raw XML to prove Phase 03 lineage

- date: 2026-07-10
- decision: validate every normalized PubMed record/retrieval against its referenced raw XML and independently regenerate the complete exact-duplicate candidate set
- rationale: output hashes and aggregate counts cannot prove that individual rows point to the correct source bytes or that candidate generation is complete
- impact: raw PMID/title/DOI drift, missing candidate pairs, and premature human decisions fail before any deduplication output can support screening

## D-021 — Screening decisions are record-question units

- date: 2026-07-10
- decision: require one empty human-decision shell for every record×question retrieval unit and exact key equality with both proxy profiles and the review queue
- rationale: a record retrieved for multiple questions needs a separate eligibility judgment under each PICO; collapsing to one record-level decision would lose scope
- impact: all 19,961 PubMed units plus registry and KoreaMed units remain reviewable, while proxy priorities retain zero decision authority

## D-022 — A real-source contract must use a real unpromoted report candidate

- date: 2026-07-10
- decision: bind the Phase 05 locator fixture to the existing report/record/PMCID chain while keeping extraction value, eligibility, study link, and AI output empty
- rationale: a fabricated report identifier cannot test cross-entity provenance, but using a candidate report need not imply inclusion
- impact: Phase 05 now detects report/source drift without turning a locator plumbing test into research evidence

## D-023 — Validated claims require a validated GRADE row

- date: 2026-07-10
- decision: replace free-standing certainty labels with a mandatory certainty-assessment reference whose question, grade, and validation state must match the claim
- rationale: a claim-level string cannot prove that GRADE was performed, independently checked, or applied to the same outcome question
- impact: thesis claims cannot enter the deterministic bundle until a human-validated GRADE registry row exists and all upstream extraction provenance matches

## D-024 — Implement the matcher before validated rules exist

- date: 2026-07-10
- decision: implement and contract-test deterministic matching with synthetic in-memory bundles while production curated rules remain empty
- rationale: an engine that throws when the first validated rule arrives cannot satisfy Phase 07; synthetic matcher tests prove software behavior without claiming clinical performance
- impact: validated rules can later execute only through a strict condition vocabulary, exact matching, deterministic priority, and claim-linked output; release remains externally blocked

## D-025 — Finalization readiness is an explicit negative gate

- date: 2026-07-10
- decision: represent all A-K acceptance areas in one hash-bound readiness manifest and require every finalization flag to remain false while any gate is open
- rationale: separate passing software checks can otherwise be mistaken for a completed study or submission-ready thesis
- impact: final writing, artifacts, deployment, and manifest pointers cannot appear until the full upstream evidence state is regenerated and independently validated

## D-026 — Homepage question labels are protocol-controlled data

- date: 2026-07-10
- decision: keep A1-A2/B1-B3 display labels in a tested domain constant rather than independent page copy
- rationale: browser smoke exposed stale legacy topics on the thesis homepage despite correct backend protocol artifacts
- impact: scope-label drift now fails a unit test; passing local browser smoke remains distinct from validated deployment

## D-027 — Human queues follow one dependency-ordered handoff manifest

- date: 2026-07-10
- decision: hash-bind every active human queue/template in one manifest while preserving each phase's original file and protected fields
- rationale: scattered queues make it easy to skip upstream freezes, enter judgments in the wrong artifact, or mistake blocker instructions for completed review
- impact: any queue edit invalidates the handoff/readiness chain until counts and hashes are regenerated; protected fields remain zero until real reviewers act

## D-028 — Human-data presence is progress, not automatic failure or approval

- date: 2026-07-10
- decision: derive queue progress from minimum completion fields and accept partial/complete-candidate states without setting `human_work_complete`
- rationale: requiring human fields to stay permanently blank blocks legitimate review, while treating any populated field as completion accepts partial work
- impact: reviewers can progress safely; only phase-specific semantic validation can convert complete candidates into accepted research decisions

## D-029 — Every PRESS finding needs a writable allowed-decision record

- date: 2026-07-10
- decision: store reviewer, date, and one row-specific allowed decision directly in the main PRESS queue
- rationale: a review request without result fields cannot become auditable approval or amendment evidence
- impact: the eight main PRESS rows can now progress through the handoff model while invalid or partial decisions fail Phase 02 validation

## D-030 — Secondary screening is selected deterministically and blinded

- date: 2026-07-10
- decision: route all primary include/uncertain decisions and a stable ceil-20% excluded stratum sample to a reviewer-2 queue that hides primary judgments
- rationale: the protocol requires double review while avoiding both convenience sampling and anchoring on reviewer 1
- impact: selection is reproducible and auditable; secondary review cannot start until complete primary rows exist and cannot inherit proxy or primary decisions

## D-031 — Full-text review begins only after secondary final inclusion

- date: 2026-07-10
- decision: route only secondary-final include/uncertain units into a separate two-reviewer full-text queue with source hashes
- rationale: using primary decisions or priority proxies would bypass the planned double-screening gate and contaminate the included-report frame
- impact: extraction cannot receive reports until lawful full text and two-person eligibility review are recorded and validated

## D-032 — Extraction and RoB require verified source, study link, and design

- date: 2026-07-10
- decision: create downstream tasks only from final-included full texts whose bytes, study link, design family, and two reviewer decisions are verified
- rationale: report inclusion alone cannot identify the study unit or select a design-specific RoB tool, and an unverified file cannot support extraction
- impact: RCTs route to protocol-fixed RoB 2; all other tools remain a documented human selection until the protocol records the appropriate current instrument

## D-033 — The protocol extraction template is the only human CSV schema

- date: 2026-07-10
- decision: generate `extractions_human.csv` directly from the 55-field protocol template instead of a reduced field-name/value table
- rationale: the reduced table could not represent outcome denominators, effect estimates, confidence intervals, or adjustment needed for synthesis and GRADE
- impact: downstream analysis can consume a stable predeclared schema; any header drift fails Phase 05 before human extraction starts

## D-034 — Fixture generation must never overwrite human research data

- date: 2026-07-10
- decision: initialize human CSVs only when absent; otherwise validate headers and preserve bytes, then validate populated rows semantically
- rationale: rerunning a synthetic harness must not erase review work, while blanket rejection of populated tables prevents legitimate progression
- impact: human extraction/RoB can advance safely; invalid lineage or statistics fail without destructive rewriting
