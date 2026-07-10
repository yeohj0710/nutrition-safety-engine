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

## 2026-07-10 KMbase design-pilot risk

- KMbase search transport is reachable, but a positive one-word control and failing/zero protocol translations show that PubMed-style Boolean syntax cannot be assumed.
- Zero-hit responses are not evidence of absence until platform syntax is independently reviewed and split-query recall is checked.
