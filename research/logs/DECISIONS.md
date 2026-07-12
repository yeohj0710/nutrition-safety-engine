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

## D-035 — AI performance remains null until all three evidence layers exist

- date: 2026-07-10
- decision: compute production AI metrics only when frozen hash-bound human gold, schema-valid preserved AI runs, and one-to-one independent human field reviews are all present
- rationale: locator presence is not locator correctness, and synthetic fixtures or unreviewed outputs cannot establish extraction accuracy or safety
- impact: the empty state emits `metrics: null`; completed inputs yield detection, value/unit, human-judged quote/locator, safety-error, critical-FN, and repeat-stability outputs with explicit denominators

## D-036 — Parsed AI output is not a reproducible raw run

- date: 2026-07-10
- decision: require one manifest row per parsed run, binding repository-local input, full prompt, and raw model output bytes to their SHA-256 values and execution/model metadata
- rationale: a parsed JSON candidate alone cannot reproduce the prompt context, provider output, retry history, or exact evaluated bytes
- impact: missing, extra, legacy, out-of-root, stale-hash, or model-mismatched manifests invalidate inputs and suppress all performance metrics

## D-037 — AI detection denominators are run-field instances

- date: 2026-07-10
- decision: replicate each applicable human-gold field across every preserved run for its report/question and calculate TP/FP/FN at `(run_id, report_id, question_id, field_name)` resolution
- rationale: collapsing repeated runs to unique fields lets one successful repeat hide another repeat's false negative and overstates recall and stability
- impact: a field found in two of three repeats now contributes TP=2 and FN=1; critical false negatives retain the failing run ID

## D-038 — AI efficiency is paired and separate from accuracy

- date: 2026-07-10
- decision: measure human-only and AI-assisted minutes for the same reviewer/report pair, preserve workflow order, and report time savings and correction burden separately from accuracy
- rationale: unpaired timing confounds reviewer and report complexity, while faster processing cannot compensate for worse extraction safety
- impact: absent paired timing yields `efficiency: null`; completed rows report mean/median paired savings, total minutes, correction rate with denominator/CI, and order counts without an invented significance test

## D-039 — Declared source hashes must be reproduced from bytes at bundle time

- date: 2026-07-10
- decision: reopen every curated source file during deterministic thesis-bundle construction and reject missing files, path escape, legacy/synthetic namespaces, duplicate source IDs, or SHA-256 mismatch
- rationale: agreement between a claim support row and a source registry row only proves that two declarations match; it does not prove either declaration matches the preserved source bytes
- impact: a changed or relocated source cannot silently retain validated claims/rules; bundle generation stops before runtime artifacts are written

## D-040 — Bundle engine commit identifies engine inputs, not generated output HEAD

- date: 2026-07-10
- decision: derive `engineCommit` from the latest commit touching the engine/provenance/bundle-builder inputs rather than unconditional repository HEAD
- rationale: embedding HEAD in a tracked generated file creates an impossible fixed point where committing the file immediately makes its embedded commit stale and every build dirties the tree
- impact: unrelated research/log commits no longer rewrite the bundle; changing engine inputs still advances the identity and requires one deliberate regenerated artifact commit

## D-041 — Phase gates must permit valid forward progress

- date: 2026-07-10
- decision: replace the Phase 06 blanket “all production tables must be empty” assertion with progressive semantic validation and explicit blocked/complete-candidate states
- rationale: a safe-empty assertion is useful before human work starts but becomes a destructive process lock when valid extraction, RoB, GRADE, claims, or rules arrive
- impact: upstream-only rows no longer fail QA; validated registry IDs must exactly match curated IDs and bundle IDs/counts, while premature claims/rules and invalid statuses still fail closed

## D-042 — The protocol GRADE template is the only certainty schema

- date: 2026-07-10
- decision: replace the empty reduced certainty CSV with the exact 22-field protocol template and derive validated status from complete two-reviewer consensus fields
- rationale: the reduced schema omitted reviewer identities, consensus date, participants, design starting point, absolute/relative effects, and explicit upgrade domains needed to reproduce GRADE judgments
- impact: incomplete rows may remain work in progress; only rows with outcome, final certainty, rationale, two distinct reviewers, and consensus date can enter curated evidence

## D-043 — Phase 07 rebuilds may never erase human validation

- date: 2026-07-10
- decision: regenerate expert/gold queues only while their human fields are empty; once any human field exists, preserve the entire file byte-for-byte and validate it in place
- rationale: scenario or bundle refresh must not destroy independent authoring, adjudication, or expert review work
- impact: missing queues initialize, empty queues refresh safely, header drift fails without write, and human-populated queues survive every builder run

## D-044 — Phase 07 validators accept explicit partial and complete states

- date: 2026-07-10
- decision: replace blank-only assertions with pending/in-progress/complete validation; completed gold candidates require distinct roles, parseable JSON, timestamps, and row hash
- rationale: treating any human entry as corruption made the prescribed independent validation impossible to finish
- impact: partial work remains visible without being counted complete; completed rows are candidates only and do not themselves authorize clinical performance or release

## D-045 — Independent engine metrics require all 120 adjudicated scenarios

- date: 2026-07-10
- decision: promote only bundle-matched, hash-valid, independently adjudicated candidates and suppress all clinical metrics until exactly 120 are available
- rationale: partial convenience subsets would change the prespecified distribution and could overstate sensitivity or precision
- impact: 0–119 scenarios produce `metrics: null`; 120 scenarios execute three repeats and report action-level sensitivity/precision, scenario exact match, determinism, Wilson intervals, and critical FN details

## D-046 — Critical engine failures are expected rule IDs

- date: 2026-07-10
- decision: encode critical-failure labels as a subset of adjudicated expected `rule_id` values and treat any missing labeled rule as a critical false negative
- rationale: free-text severity labels cannot be joined deterministically to engine outputs
- impact: critical misses are traceable to scenario and rule; any nonzero critical FN produces explicit release-prohibited status

## D-047 — Deployment evidence is a single immutable release binding

- date: 2026-07-10
- decision: accept at most one deployment-verification row binding deployment ID/URL/provider, exact release commit, thesis-bundle SHA, post-deploy report path/SHA, external verifier, and timestamps
- rationale: a successful local build or an arbitrary public URL does not prove that the validated bundle was deployed and smoke-tested
- impact: missing deployment remains an external blocker; any partially populated or mismatched row fails QA rather than being reported as a release

## D-048 — No release commit is assigned before predeployment gates pass

- date: 2026-07-10
- decision: keep `release_commit` null while validated claims/rules, 120 gold metrics, zero critical FN, full determinism, or 120 expert reviews are incomplete
- rationale: embedding ordinary moving HEAD values in a tracked blocked-state report creates noise and can imply a release candidate exists
- impact: current readiness remains stable and explicitly non-release; commit identity appears only when a genuine candidate or deployment row exists

## D-049 — Finalization readiness is evidence-derived, not permanently false

- date: 2026-07-10
- decision: calculate A-K gates from aggregate human handoff, production AI evaluation, validated bundle counts, independent metrics/expert review, results freeze, and release/deployment readiness
- rationale: hardcoded false values prevent false completion now but also make legitimate future completion impossible
- impact: current 11 open gates still prohibit results writing and final artifacts; closing every authoritative dependency can advance the state to a final-document build candidate without manual code edits

## D-050 — Results freeze is a hash-bound approval event

- date: 2026-07-10
- decision: require one row binding frozen commit, data manifest, analysis manifest, department format, protocol approval reference, approver, and timestamps before thesis results can be written
- rationale: a prose claim that results are frozen cannot prove which data, analysis, format, or commit the thesis uses
- impact: absent/multiple/stale rows remain blocked; valid paths are reopened and SHA-256 reproduced before `results_frozen` becomes true

## D-051 — Approval records may follow the immutable commit they approve

- date: 2026-07-10
- decision: require frozen/release commits to be ancestors of current HEAD, not equal to the commit containing their later approval or deployment-verification records
- rationale: `approved_commit == HEAD` becomes false as soon as the approval row itself is committed and therefore has no attainable stable state
- impact: validators reproduce data/analysis manifests and thesis-bundle bytes from the historical approved commit while allowing audit records to be committed afterward

## D-052 — PubMed normalization may not overwrite dedup or study-linkage work

- date: 2026-07-10
- decision: regenerate Phase 03 human queues only while human fields are empty; once populated, require identical keys/static lineage and preserve the file byte-for-byte
- rationale: rerunning raw normalization is a reproducibility step, not authorization to erase human review
- impact: missing/blank queues initialize, stable populated queues survive, and changed candidate/report lineage fails before write

## D-053 — Phase 03 supports pending, partial, and complete-candidate decisions

- date: 2026-07-10
- decision: validate explicit progress states for duplicate decisions and report-study links rather than requiring every field to stay blank
- rationale: blank-only lineage gates made human deduplication and study linkage impossible to complete
- impact: partial rows remain visible; complete duplicate calls require verifier/time and duplicate-specific canonical/cluster/reason fields; complete links require study ID/linker/time

## D-054 — Secondary screening rebuilds preserve reviewer-2 work

- date: 2026-07-10
- decision: regenerate the blinded secondary queue only while human fields are empty; otherwise require identical selected keys and source/selection hashes and preserve bytes
- rationale: recalculating the deterministic 20% sample must not erase independent reviewer decisions
- impact: stable populated queues survive, changed primary selection fails before write, and the derived non-blinded selection audit may still be regenerated separately

## D-055 — Secondary screening supports explicit adjudication progress

- date: 2026-07-10
- decision: accept not-started, in-progress, and complete-candidate rows; disagreements with the primary decision require an adjudicator before completion
- rationale: blank-only validation prevents double screening, while accepting an unadjudicated disagreement would bypass the protocol
- impact: reviewer-2 work can advance without being called final; complete candidates still require downstream phase validation

## D-056 — Full-text routing may not erase access or double-review work

- date: 2026-07-10
- decision: preserve a populated full-text queue byte-for-byte and refuse regeneration when secondary routing keys or lineage hashes change
- rationale: rerouting after lawful file acquisition, study/design verification, or reviewer decisions would destroy the audit trail
- impact: only blank queues regenerate; changed upstream selection requires explicit migration/review rather than silent overwrite

## D-057 — Full-text completion requires verified bytes and two independent reviewers

- date: 2026-07-10
- decision: require obtained-verified access, repository-local non-legacy source with reproduced SHA, verified study/design, two distinct reviewers, adjudication on disagreement, and final exclusion reason when excluded
- rationale: a final decision without the actual source, correct study/design unit, or independent review cannot support extraction and RoB
- impact: partial access/review remains in progress; only complete candidates route downstream after phase validation

## D-058 — Extraction and RoB task regeneration preserves assignments

- date: 2026-07-10
- decision: once extractor/verifier, RoB reviewers, tool selection, or timing exists, preserve each work queue byte-for-byte and reject changed included-report lineage
- rationale: deterministic routing may be rerun, but it must not erase human workload, tool judgments, or completion history
- impact: blank queues regenerate; populated queues survive only against identical report/question/design/source hashes

## D-059 — Nonrandomized RoB tools require explicit human selection and version

- date: 2026-07-10
- decision: retain protocol-fixed RoB 2 for randomized trials and allow other designs only through `human_selected_verified` with a named, versioned tool
- rationale: inferring ROBINS or another instrument from a coarse design label would exceed the protocol and may apply the wrong current instrument
- impact: human tool choice can progress without code edits; unversioned or silently inferred tools remain blocked

## D-060 — Phase 01 regression validates isolation, not permanent emptiness

- date: 2026-07-10
- decision: replace later-phase zero/empty assertions with collection-count consistency, validated thesis scope/status, and forbidden legacy/synthetic namespace checks
- rationale: Phase 01 began with an intentionally empty bundle, but requiring it to remain empty makes any legitimate claim/rule progression fail the foundational audit
- impact: current 0/0 state still passes; future curated evidence can pass only through the deterministic builder and production provenance gates, never by legacy promotion

## D-061 — Preserve populated PRESS review bytes

- date: 2026-07-12
- decision: regenerate the Korean PRESS queue only while human fields are empty; preserve populated bytes when source-bound static fields match and fail on lineage drift
- rationale: rerunning deterministic builders must not destroy independent human judgments
- impact: valid human progress can move from pending to in-progress and complete-candidate without being erased or falsely rejected

## D-062 — Enrich duplicate review without deciding it

- date: 2026-07-12
- decision: expose paired bibliographic and raw-file context plus deterministic review priority, but never an automated duplicate/nonduplicate recommendation
- rationale: exact titles can be distinct publications, while exact DOI matches deserve first review; both still require accountable human judgment
- impact: reviewers can assess all 342 pairs from one source-bound file without treating proxy logic as a screening decision

## D-063 — Keep out-of-corpus registry references explicit

- date: 2026-07-12
- decision: use ClinicalTrials.gov citation and raw-response provenance for every PMID reference, and attach PubMed XML metadata only when that PMID is actually present in the current search corpus
- rationale: a registry reference can be valid linkage evidence without being retrieved by the question-specific PubMed proxy; inventing a PubMed search record would corrupt retrieval lineage
- impact: 500 candidates are reviewable, while 354 out-of-corpus references remain visibly distinct from the 146 dual-source records

## D-064 — Separate screening context from decisions

- date: 2026-07-12
- decision: provide one source-bound row per retrieval with complete available bibliographic/abstract context and both proxy explanations, but keep all human decision columns in the separate screening decision ledger
- rationale: reviewers need the source text and prioritization rationale together; mixing them with decisions risks accidental AI-only exclusion or overwritten judgments
- impact: 19,961 PubMed units are directly reviewable while proxy outputs retain zero decision authority

## D-065 — Give every non-PubMed queue source context

- date: 2026-07-12
- decision: expose registry trial characteristics and KoreaMed URL/linkage candidates beside their review units without populating reviewer fields
- rationale: an ID-only registry row and title-only KoreaMed row are insufficient for accountable human screening
- impact: all 269 non-PubMed proxy retrieval units can be reviewed from source-bound context; native KoreaMed export and human linkage gates remain open

## D-066 — Treat corrupted documentation as failed evidence

- date: 2026-07-12
- decision: replace the unreadable extraction dictionary with a UTF-8 guide and exact machine-readable dictionary, and make encoding/header identity a CI gate
- rationale: a file's existence or prior completion label does not prove that human extractors can read it or that it matches the current schema
- impact: every extraction column now has an auditable Korean definition and conditional rule; no research value was inferred or populated

## D-067 — Human-readable guidance is part of the evidence gate

- date: 2026-07-12
- decision: treat unreadable claim/rule instructions as failed local readiness even when schemas and empty registries validate
- rationale: accountable human authoring cannot follow a corrupted manual, and schema-only validation does not prevent overclaiming in prose
- impact: authoring instructions now encode the same provenance, expert, independent-scenario, and no-legacy boundaries enforced by code

## D-068 — Independent gold needs an executable human procedure

- date: 2026-07-12
- decision: bind the live queue to a readable role/JSON/hash guide and validate question balance before accepting any authored row
- rationale: a blank 120-row shell and evaluator code do not tell independent humans how to create reproducible gold without seeing engine outputs
- impact: external authors can produce hash-valid candidates; zero authored rows still yields null metrics and prohibited release

## D-069 — Repair thesis instructions without inventing results

- date: 2026-07-12
- decision: reconstruct style, outline, and status documents now, but continue prohibiting results-dependent prose and final artifacts until the evidence-derived freeze passes
- rationale: readable writing infrastructure is legitimate pre-freeze work; drafting results from empty human evidence is not
- impact: final authoring can start from a usable Korean structure after freeze, while current final DOCX/PDF paths remain absent

## D-070 — XLSX is a convenience copy, CSV remains authoritative

- date: 2026-07-12
- decision: provide one visually checked external-review workbook while requiring all completed values to be reconciled to canonical CSV files and revalidated
- rationale: a workbook reduces file-switching for human reviewers, but parallel editable authorities would break provenance and regeneration safety
- impact: external review can start more easily without changing the fail-closed research data model

## D-071 — Registry linkage requires its own canonical human ledger

- date: 2026-07-12
- decision: store each of 500 registry–PubMed linkage judgments in a preserved CSV ledger and expose it as a separate workbook sheet beside read-only context
- rationale: context and priority cannot substitute for an accountable same-study/not-same/uncertain decision with verifier and timestamp
- impact: human linkage can now progress without editing generated context or allowing automated linkage authority

## D-072 — Proxy regeneration must preserve primary screening work

- date: 2026-07-12
- decision: initialize primary and training queues only while human fields are empty; preserve populated bytes and reject changed record/question lineage
- rationale: a reproducible proxy must never erase the human decisions that determine eligibility, and reviewer IDs alone do not constitute training
- impact: the 50-row pilot now records two decisions and adjudication, while AI-only exclusions remain impossible
## D-20260712-16 — Non-PubMed review queues are append-only with respect to human work

ClinicalTrials.gov screening, KoreaMed screening, and KoreaMed–PubMed linkage generators may refresh an undecided queue. Once a human-authority field is populated, regeneration must preserve the file byte-for-byte unless static source columns match; source drift then fails closed and requires an explicit migration.
## D-20260712-17 — KoreaMed exact-title matches remain human linkage candidates

An exact normalized title is candidate-generation evidence, not a report identity decision. Every candidate requires an allowed decision plus a written reason, verifier identity, and timestamp before downstream deduplication or study linkage can use it.
## D-20260712-18 — Screening proxy may order work but cannot decide eligibility

Proxy disagreement and priority bands may determine the order of human review batches. They cannot populate reviewer identities, eligibility decisions, exclusion reasons, adjudication, PRISMA counts, or thesis results.
## D-20260712-19 — Adopt a transparent AI-only exploratory study as protocol v2

The v1 human-screened systematic-review design remains historically preserved and externally blocked. Protocol v2 is a distinct AI exploratory evidence map and software-validation study authorized by the user's 2026-07-12 instruction. V2 may finish without human screening only by permanently foregoing systematic-review inclusion, GRADE, clinical efficacy/safety, human agreement, independent-gold, and clinical-validation claims.
## D-20260712-20 — Dual-profile agreement is an exploratory class, not eligibility

The conservative/sensitivity profile intersection defines v2 navigation classes only. `ai_agreement_deprioritize` is retained in the corpus and is not an exclusion; `ai_agreement_retain` is not a systematic-review inclusion; all remaining combinations are `ai_disagreement_uncertain`.
## D-20260712-21 — Non-PubMed records remain unranked source candidates

Registry and KoreaMed records do not inherit PubMed classifier scores. They remain `ai_unranked_source_candidate`; known lexical risks and export failures are retained as limitations, not converted into eligibility decisions.
## D-20260712-22 — Evidence-map rows and unique records use separate denominators

Question overlap duplicates a record across record-question rows. V2 reports PMC access as both 5,653 mapped rows and 5,563 unique records and never substitutes either for included reports, studies, or full texts reviewed.
## D-20260712-23 — V2 scenarios measure software behavior only

The 120 synthetic fixtures may prove deterministic exact-term routing, provenance carriage, and absence of prohibited action/legacy leakage. They cannot estimate clinical sensitivity, precision, false-negative risk, expert agreement, or usability.
## D-20260712-24 — The v2 thesis reports descriptive and technical results only

The final v2 narrative may report corpus counts, observability, classifier agreement, access locators, deterministic routing, provenance, and leakage tests. It may not report included studies, pooled effects, RoB, GRADE, clinical efficacy/safety, human agreement, or independent-gold performance.
