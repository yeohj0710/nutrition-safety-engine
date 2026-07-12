# RISKS

| ID | Category | Risk | Likelihood | Impact | Evidence/trigger | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| R-001 | scope | Five questions may exceed available reviewer time | medium | high | redesign package risk register | Gate 1 workload estimate and protocol-governed staged scope | research lead | open |
| R-002 | access | Embase, CENTRAL, Scopus/WoS, WHO ICTRP, or full texts may be unavailable | high | high | access not yet tested | build access matrix; record exact blockers; use approved amendment only | research lead | open |
| R-003 | bias | Legacy AI classification may be mistaken for human inclusion | high | high | repository contains classifier outputs and candidate labels | quarantine legacy data; prohibit AI-only exclusion; human gold first | screening lead | active |
| R-004 | data | Legacy and new counts may mix | high | high | multiple source/evidence/rule/search count claims already documented | separate namespaces and canonical manifests; derive counts in code | data lead | active |
| R-005 | clinical | Runtime UI may expose unverified or out-of-scope rules | high | high | current README and project map describe broad rule data and runtime routes | classify every rule; thesis-mode exclusion; provenance tests | clinical/data lead | active |
| R-006 | reproducibility | No repository tag distinguishes current production/research baseline | high | medium | `git tag --list` returned empty | record immutable commit/deployment metadata; tag only after verified gate | software lead | active |
| R-007 | privacy/copyright | Restricted full texts or personal reference documents could be committed to public Git | medium | high | research input folders contain PDFs and signed documents | keep restricted originals local; version hashes/metadata; verify `.gitignore` before commit | data steward | active |
| R-008 | protocol | Existing optional runtime LLM conflicts with deterministic thesis-runtime rule | high | high | `app/api/ai-explain/route.ts`, README, OpenAI dependency | audit actual production exposure; disable/exclude in thesis mode; add tests in later gate | software lead | active |
| R-009 | provenance | Structurally linked source may not support the displayed rule message | high | high | CoQ10-warfarin result displays CoQ10 fatigue meta-analysis | claim-level support mapping and semantic human review | evidence lead | active |
| R-010 | deployment | Public production can be mistaken for validated thesis output | high | high | legacy counts and out-of-scope rules are live | no validated-release claim; migrate and redeploy only after all release gates | software/research lead | active |
| R-011 | determinism | Legacy generated outputs and engine responses contain current timestamps | high | medium | identical prepare inputs changed literature-candidates hash | freeze time in release metadata; canonical response test | software lead | active |
| R-012 | retrieval | KoreaMed native export service fails server-side after complete selection | medium | high | live 62-result A1 Download returned temp-file permission/fopen/fwrite failures | preserve complete displayed IDs; rerun native export after repair; compare exact identifiers | information specialist | active |
| R-012 | environment | Shared/unlocked Python environment can change analysis behavior | high | medium | Python 3.14 global environment with unrelated editable installs | create isolated lockfile-based environment before retrieval/analysis | software lead | open |

## 2026-07-10 status note

- R-003/R-004/R-005 containment improved: complete legacy manifest, 110-row scope report, and empty curated-only thesis bundle now exist.
- Containment is not production remediation. R-005/R-008/R-009/R-010 remain active until app migration and validated release.

## 2026-07-10 Phase 01 boundary update

- R-004 containment verified: physical namespace separation and zero automatic promotion.
- R-005/R-008 remediated in the local build: thesis-default API/UI and no runtime AI route. They remain deployment risks until Gate 7 identity checks pass.
- R-011 remediated for generated literature candidates; repeated builds are hash-stable.
- New access limitation: G: is unavailable in the successor sandbox. The preserved 513-file SHA snapshot is usable for audit continuity, but live re-verification remains open.

## 2026-07-10 Phase 02 status note

- R-001 likelihood increased: PubMed-only design pilot yields 19,961 records and about 266 title/abstract reviewer-hours before dedup/full-text work.
- A1 and B2 require PRESS-guided precision review or an explicitly approved workload/scope decision; no results-driven narrowing allowed.
- Subscription and full-text access remain high-impact risks. Public PubMed and ClinicalTrials.gov access is verified; WHO ICTRP export has constraints.

## 2026-07-10 Phase 03 proxy note

- Large local raw corpus risk controlled with per-file SHA-256 and tracked manifest; local loss would still prevent raw reproduction, so final bundle backup is required.
- 342 exact duplicate candidates and 19,609 report candidates await human decisions. Automated closure would bias screening/PRISMA denominators.
- 33 legacy PMIDs did not match current question drafts. They require scoped human review after protocol freeze, not automatic query expansion.

## 2026-07-10 Phase 04 proxy note

- Proxy A/B disagree on 4,224 units, confirming term heuristics are unsuitable as final screeners.
- A1 proxy-high volume remains very large; priority ordering does not reduce required human coverage.
- Human reviewer fatigue and training consistency remain major risks; 50-row blinded pilot queue is ready but unreviewed.
- PMCID presence is not equivalent to reusable full-text XML. Sentinel testing found 2/3 PMC records metadata-only/non-OA, so access status must be parsed per report before extraction.
- Locator labels can drift when source files change. Extraction validation now binds source bytes and paragraph text hashes; human locator verification is still required.
- A structurally valid rule can still reference the wrong claim. Phase 06 now enforces claim existence, question consistency, validation status, and expert/scenario evidence semantically.
- Expert review of synthetic scenarios can create circular validation. Separate blind-review and independent-authoring queues prevent synthetic cases from being counted as gold.

## 2026-07-10 KMbase design-pilot risk

- KMbase search transport is reachable, but a positive one-word control and failing/zero protocol translations show that PubMed-style Boolean syntax cannot be assumed.
- Zero-hit responses are not evidence of absence until platform syntax is independently reviewed and split-query recall is checked.
- RISS short-query counts overlap heavily and must never be summed. Only exported unique identifiers after approved final searches may enter deduplication or PRISMA totals.

## 2026-07-10 document checkpoint risk

- A polished checkpoint could be mistaken for a completed thesis. Filename, cover, running header, terminal hold notice, QA flags, and validators all mark it non-final.
- Department formatting remains unconfirmed. The current A4 Korean academic layout validates rendering only and must not be treated as school approval.

## 2026-07-12 PRESS review integrity

- Mitigated: Korean PRESS regeneration now preserves populated human rows byte-for-byte and rejects changed source-bound fields.
- Residual: all 48 PRESS rows remain without an independent human decision, so final searches remain prohibited.

## 2026-07-12 documentation encoding integrity

- Mitigated for the active extraction dictionary: UTF-8 content is readable, has zero replacement characters, and matches all 55 template fields in order.
- Residual: other imported Korean design-package files may contain historical mojibake or replacement characters; they must not be cited as usable instructions until individually validated or reconstructed.
## R-20260712-12 — Non-PubMed regeneration could erase human review — mitigated

Three queues were previously written unconditionally. Generator guards and a 3/3 mutation preservation contract now prevent silent overwrite. Residual risk: an intentional source refresh after human work requires a reviewed migration rather than automatic row reconciliation.
## R-20260712-13 — KoreaMed linkage candidates omitted from reviewer handoff — mitigated

The 35 candidates were preserved but absent from the consolidated manifest/workbook. They are now an explicit actionable queue with source hashes and a visually verified decision sheet. Residual risk remains wholly external: no human linkage decisions exist yet.
## R-20260712-14 — Monolithic PubMed queue impedes external review — mitigated

The 19,961-row queue is now deterministically partitioned into 40 bounded batches with exact one-to-one coverage. Residual risk: assignment does not supply the required independent reviewers or decisions.
## R-20260712-15 — Design change could be mistaken for completion of v1 — active control

V2 removes human screening by changing the study question, not by imputing human decisions. Separate protocol, role matrix, output paths, authority labels, prohibited-claim validator, and preserved v1 queues prevent retrospective relabeling. Residual risk is reader confusion; every v2 thesis section must state the AI-only exploratory boundary.
