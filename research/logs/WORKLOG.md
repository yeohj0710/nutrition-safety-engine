# WORKLOG

## 2026-07-10 — KoreaMed live design pilot and complete-display capture

- Read official KoreaMed Search Guidelines: default field `ALL`, implicit `AND`, quoted phrase syntax, and individual-word field tags.
- Live runs: A1 `warfarin "vitamin K"` = 62; A2/B1/B2/B3 = 0 each. A field-tag/quoted-phrase probe produced `DB Error: syntax error` and was excluded from the run log.
- Set results per page to 100; verified `1-62`, 62 KMID elements, 62 unique values. Captured all 62 KMID/title pairs in one bounded page read.
- Selected all 62 and invoked native Download. KoreaMed returned temp-file permission/fopen/fwrite/fclose/readfile/unlink server errors; downloaded files 0.
- Normalized 62 records/retrievals and generated 35 exact-normalized-title PubMed linkage candidates. Human eligibility/linkage decisions 0.
- Added a 62-row human review queue and integrated it into Phase 04 workload: 20,230 database-question units, final PRISMA still prohibited.

## 2026-07-10 — CENTRAL live hit-count design pilot

- Executed five public Cochrane Library basic searches and selected the CENTRAL trial-count link for each question.
- Observed trial hits: A1 1,664; A2 111; B1 111; B2 333; B3 45; total 2,264.
- B3 trial results page displayed `Authenticate to get access to full CENTRAL content`, issue 6/12 June 2026. Public records exported: 0.
- Persisted query text, query SHA-256, result URL, hit count, response metadata, and per-run checksums. Validator errors 0.
- Did not scrape or import the visible first 25 records and did not represent a top-N sample as a complete export. Status remains hit-count-only, pending licensed access, PRESS, and protocol approval.

## 2026-07-10 — Public PMC locator resolution

- Used the official PMC ID Converter API in 99 batches of at most 200 IDs to resolve all 19,609 normalized PMIDs.
- Preserved every raw JSON response and SHA-256 manifest; raw files 99, checksum errors 0, total raw directory 2.4 MB.
- Resolved 5,563 unique PMID→PMCID candidates. Live resolution exactly matched the 5,563 PMCID values independently parsed from PubMed XML; mismatches 0.
- Question retrieval units with a PMC locator: A1 3,871; A2 205; B1 219; B2 1,215; B3 143. These overlap by question and are not study counts.
- Human full-text verification 0 and eligibility decisions 0. No article was included, extracted, appraised, or promoted.
- API email parameter was intentionally omitted to avoid persisting personal data; the official warning is retained and requests were throttled to at most two per second.

## 2026-07-10 — Phase 08 checkpoint verification

- Initial coverage gate found six Korean-path tracked files missing. Root cause: `git ls-files` quoted non-ASCII paths, which were interpreted as literal quoted filenames and skipped.
- Replaced line-oriented quoted parsing with UTF-8, NUL-delimited `git -c core.quotepath=false ls-files -z` in both generator and validator.
- Regenerated checkpoint: 563 files = 459 tracked + 104 local required; all size/SHA checks and tracked coverage passed with errors 0.
- Final DOCX/PDF remain null and prohibited before results freeze; checkpoint status is verified but Phase 08 remains `blocked_external`.

## 2026-07-10 — Phase 08 non-final checkpoint gate preparation

- Added a Phase 08 validator for manifest file count, unique paths, tracked-file coverage, 104 required local payloads, SHA-256/size integrity, and implementation-head ancestry.
- Gate requires project complete false, claims/rules 0/0, final DOCX/PDF null, and validated public deployment null.
- Gate rejects `output/final/thesis.docx` or `.pdf` before results freeze; no final thesis artifact is fabricated.
- Added five Phase 08 external review routes for result freeze, department format, supervisor amendments, final document QA, and submission manifest.

## 2026-07-10 — Phase 07 full-chain verification

- CI YAML parsed successfully; Phase 07 review queue contains five rows and all artifact paths exist.
- Phase 01/02/04/05/06, ClinicalTrials.gov, and Phase 07 validators returned errors 0 after report generation.
- Lint and TypeScript passed; Vitest 10 files/35 tests passed; production build generated 106 pages.
- Post-build Phase 07 source-hash gate returned errors 0. The verified statement is limited to the safe-empty boundary; independent clinical validation and production deployment remain absent.

## 2026-07-10 — Phase 07 executable safe-empty and CI gate

- Added an executable 120-scenario runner with three repeats per scenario and a 360-execution report bound to runner, engine, and thesis-bundle SHA-256.
- Verified 120/120 deterministic, legacy leakage 0, nonempty outputs 0, independent gold 0, expert reviews 0; clinical performance claims remain prohibited.
- Added Phase 07 gate checks for stale report hashes, runtime OpenAI dependency/files, legacy deployment status, and unique scenario IDs.
- Initial gate failure traced to empty `src/lib/ai` and `app/api/ai-explain` directories with zero files. Gate now tests actual runtime files; rerun errors 0.
- CI now installs the locked research Python environment and runs ClinicalTrials.gov plus Phase 04/05/06/07 gates. Full PubMed XML rehash stays local because 266 MB raw payloads are intentionally not Git-distributed.
- Added five Phase 07 external review routes. Existing production remains `legacy_unverified_production`, not a validated thesis release.

## 2026-07-10 — Phase 06 safe-empty lineage gate

- Strengthened `tools/validate_phase06_gate.py` to inspect all seven curated thesis JSONL namespaces, not only claim/rule bundle output.
- Verified curated source/report/study/extraction/RoB/claim/rule rows all 0 and thesis bundle claims/rules 0/0.
- Verified exactly five unique question decisions, all `not_assessed` and `blocked_external`; no pooling or null-effect inference was created.
- Added five Phase 06 review routes for synthesis readiness, GRADE, claims, rules, and legacy comparison. Validator errors 0; legacy promotions 0.

## 2026-07-10 — Phase 05 independent proxy gate

- Added `tools/validate_phase05_proxy.py` using the installed Draft 2020-12 JSON Schema validator.
- Verified two synthetic candidates against the LLM extraction schema, accepted the supported locator fixture, and rejected the missing-quote/locator fixture through the research invariant.
- Rechecked Wilson intervals for exact value, unit, and locator fixture metrics; bounds valid.
- Confirmed human extraction rows 0, RoB rows 0, actual AI runs 0. Added five concrete Phase 05 external review routes.
- Synthetic values remain test-only and are not thesis results or AI performance estimates.

## 2026-07-10 — Phase 04 integrated verification

- Phase validators 01/02/03/04/06 and ClinicalTrials.gov validator all returned errors 0.
- Phase 04 proof: PubMed queue 19,961; registry queue 207; proxy disagreements 4,224; human decisions 0; AI-only exclusions 0.
- Software chain rerun after integration: lint pass, TypeScript pass, Vitest 10 files/35 tests pass, Next.js build 106 pages pass.
- Thesis output remains safe-empty at 0 validated claims and 0 validated rules; final PRISMA remains prohibited.

## 2026-07-10 — Phase 04 registry queue integration

- Extended the Phase 04 validator to require the 207-row ClinicalTrials.gov human queue, zero human/final decisions, and all 139 A1 lexical-risk flags.
- Regenerated PRISMA status with separate PubMed 19,961 and registry 207 database-question retrieval units; total workload 20,168.
- Preserved `final_prisma_allowed=false`, human screened 0, full-text assessed 0, and null included report/study counts.
- Phase 04 proxy validator errors 0. Registry entries received no heuristic inclusion/exclusion decision.

## 2026-07-10 — Phase 03 human review routing

- Added `research/review_queue/phase_03_external_review.csv` with separate deduplication, report-study linkage, registry screening, registry-report linkage, and subscription-export blockers.
- Updated Phase 02 database-access queue with live browser observations: CENTRAL public interface reachable; Embase/Scopus licensed search unavailable in current session.
- Unrelated public-source and deterministic validation work remains authorized to continue; no human decision was synthesized or inferred.

## 2026-07-10 — Live-source and registry checkpoint verification

- Live G: reconciliation: 513 snapshot files vs 513 live files; missing 0, added 0, SHA mismatches 0.
- Research design bundle: jsonschema/PyYAML environment installed from `requirements-research.lock.txt`; validator errors 0, warnings 0.
- Phase 01 validator: errors 0; expected warnings only for unvalidated public release and later-phase QA.
- ClinicalTrials.gov validator: 5 runs, 207 reported/exported, 20 checksum-verified files, errors 0.
- Software verification: lint pass; TypeScript pass; Vitest 10 files/35 tests pass; Next.js production build pass with 106 generated pages.
- Thesis bundle remains safe-empty: 0 validated claims, 0 validated rules. Legacy runtime remains isolated under `/legacy` and `/api/legacy/**`.

## 2026-07-10 — Live legacy scholarly PDF profile

- Located the only distinct scholarly source PDF found in the live G: research tree: Gencer et al. omega-3/atrial-fibrillation systematic review.
- Verified SHA-256 `444ce80af5459344585d33ebfaa1a9a3021d76a11a325cdfa5e0981d108f3bd3`, 1,664,634 bytes, 26 pages, DOI on page 1.
- Rendered page 1 and visually confirmed legible title/author content. Registered as `legacy_unverified_secondary_reference` with no human screening decision and no claim locators.
- No evidence claim, rule, included-study decision, or synthesis value was created from this PDF.

## 2026-07-10 — ClinicalTrials.gov full design-pilot export

- Exported all API v2 hits for A1/A2/B1/B2/B3: 139/23/23/14/8, total 207/207; no top-N truncation.
- Verified 20 raw/query/metadata files against per-run SHA-256 manifests; validator errors 0.
- Normalized 207 retrievals to 201 unique NCT records; generated 500 registry→PubMed linkage candidates.
- Created 207-row human review queue with zero prefilled decisions. Flagged all 139 A1 rows for the vitamin-K-antagonist lexical risk.
- Status remains `design_pilot_not_final_search`; no registry record promoted to included evidence.

## 2026-07-10 11:01:45 +09:00

- phase / task ID: Phase 01 / T001 entry and baseline
- input files and versions: redesign package dated 2026-07-10; repository `C:\dev\nutrition-safety-engine`
- command or procedure: read required package files in mandated order; read task/risk/phase/QA files; inspected repository-local `AGENTS.md`, project map, README, package files; fetched `origin`; captured Git state; created branch
- created or modified files: `docs/superpowers/plans/2026-07-10-phase-01-audit-and-normalization.md`; four research logs
- check result: original worktree clean; `HEAD == origin/main == 33658e3a9ee8dbf6d21ac94a5aa49202b5bf22e5`; no Git tags listed; branch `thesis-reboot-20260710` created
- problem found: redesign package is not a Git repository; actual repository is separate at `C:\dev\nutrition-safety-engine`; repository documentation permits runtime AI and broad legacy scope, conflicting with the new protocol
- next work: copy/verify redesign package; inventory repository and research inputs; establish deployment and lineage evidence

## 2026-07-10 11:03:00 +09:00

- phase / task ID: Phase 01 / T001 package and source baseline
- input files and versions: 2026-07-10 redesign package; signed plan and professor feedback originals under the research input root
- command or procedure: copied the package to `research/design/20260710`; compared every source/copy SHA-256; ran provided bundle validator; rendered and text-extracted the signed PDF; visually inspected representative pages; compared hashes of the signed plan, thesis, and both feedback notes against package copies
- created or modified files: immutable package copy; local rendered PDF evidence under ignored `output/pdf/`
- check result: 111 source files copied; 111 copied files; 0 hash mismatches; package manifest 110 entries excluding itself and 0 mismatches; bundle validator 0 errors and 2 schema-meta-validation warnings; signed plan 10 pages and SHA-256 `bd63ca8041d242eb76c32dcca0b55e4e00a5cdad1ed2d718d0563b042c3cd07b`
- problem found: signed cover labels the work `종설논문`; professor feedback states `종설논문 아님`; signed-plan methods remain broader than the new five-question protocol
- next work: preserve the signed document as historical evidence; request dated protocol/research-identity decision at Gate 1

## 2026-07-10 11:06:30 +09:00

- phase / task ID: Phase 01 / T001 test and dependency baseline
- input files and versions: repository commit `33658e3a9ee8dbf6d21ac94a5aa49202b5bf22e5`; Node 24.12.0; npm 11.6.2; Python 3.14.2
- command or procedure: ran `npm run prepare:knowledge`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `python -m pytest -q`; captured dependency tree and Python package environment
- created or modified files: legacy generated literature candidate timestamp changed during normal prepare command
- check result: lint/typecheck/build pass; Vitest 7 files/33 tests pass; pytest 4 pass; build generated 105 static pages and both rule and AI API routes
- problem found: tests encode legacy counts and rules as expected success; `npm ls` reports extraneous packages; Python uses a shared global environment; repeated prepare changes generated JSON timestamp with unchanged inputs
- next work: record test gaps; add deterministic curated-only bundle test

## 2026-07-10 11:10:00 +09:00

- phase / task ID: Phase 01 / T001 deployment baseline
- input files and versions: Vercel project `prj_3va1DsyCAwgWO2nJCqUt6cGA0GGi`; production deployment `dpl_H85kp83ZrDw9CuWU5DSKnXnPF6jp`
- command or procedure: used authenticated Vercel CLI/API; verified production alias and Git metadata; ran home HTTP check; posted A1-A2-B1-B3 and out-of-scope API inputs; used Playwright CLI for visual/UI/network smoke and screenshots
- created or modified files: `research/audit/deployment_baseline.json`; ignored screenshots under `output/playwright/`
- check result: public home HTTP 200; production commit equals baseline HEAD; A1-A2-B1-B3 endpoints respond; screenshots nonblank
- problem found: homepage displays invalid legacy counts; CoQ10/warfarin out-of-scope rule returns definite match; result card uses a fatigue meta-analysis as primary support for INR message; runtime `/api/ai-explain` POST observed and returned `openai_error`
- next work: prohibit production release until validated bundle, semantic provenance, runtime-LLM removal, and E2E gates pass

## 2026-07-10 11:17:33 +09:00

- phase / task ID: Phase 01 / T001-T002 inventory, lineage, and isolation
- input files and versions: 513 research-input files totaling 57,398,308 bytes; 110 legacy rules; 176 chunks; 126 sources
- command or procedure: ran `tools/phase01_audit.py`; reproduced all legacy counts; classified every rule without promotion; generated manifest-reference quarantine; created curated-only deterministic thesis bundle; built twice and compared hashes; ran updated typecheck and tests
- created or modified files: `research/audit/*`, `research/review_queue/phase_01_external_review.csv`, `data/legacy_unverified/manifest.json`, `data/curated/*`, `scripts/build-thesis-bundle.ts`, `src/generated/thesis-bundle.json`, `__tests__/thesis-bundle-isolation.test.ts`, `package.json`
- check result: 110 rule rows; 0 thesis-eligible legacy rules; 37 currently exposed legacy rules; 26 current UI rules outside heuristic protocol candidates; curated bundle 0 claims/0 rules; identical build hash `05c49d50adfe1495faa9b80b01fa3e6f3abd879a419e6a7f52b3c18d8151c23d`; updated Vitest 8 files/34 tests pass
- problem found: current app/API still uses legacy engine; new isolated bundle is not yet the production expression layer; independent review and protocol approval remain external
- next work: final Phase 01 validation, output hashes, exit table, and status decision

## 2026-07-10 11:21:03 +09:00

- phase / task ID: Phase 01 verification and gate decision
- input files and versions: complete Phase 01 working tree after audit/isolation changes
- command or procedure: reran audit generator and package validator; reran full `lint -> typecheck -> test -> build -> pytest` chain; reviewed build routes and counts; created explicit entry/exit/QA decision; prepared self-excluding artifact manifest validation
- created or modified files: `research/audit/phase_01_exit_criteria.md`, `tools/validate_phase01.py`, final audit/log updates
- check result: package 0 errors/2 dependency warnings; lint pass; typecheck pass; Vitest 8 files/34 tests pass; Next.js build pass with 105 pages; pytest 4 pass
- problem found: fresh build still emits `/api/ai-explain`, 37 legacy rule paths, and 46 legacy source paths; these are retained as failed quality-gate evidence, not accepted release behavior
- next work: freeze final Phase 01 hashes; do not mark Phase 01 complete; continue only non-blocking Gate 1 preparation until supervisor/external blockers are resolved

## 2026-07-10 11:45:14 +09:00

- phase / task ID: Phase 01 / thesis-default boundary TDD red
- input files and versions: dirty Phase 01 worktree on `thesis-reboot-20260710`; deterministic empty curated bundle
- command or procedure: added `__tests__/thesis-mode-boundary.test.ts`; ran `npm exec vitest run __tests__/thesis-mode-boundary.test.ts`
- created or modified files: `docs/superpowers/plans/2026-07-10-phase-01-mode-isolation.md`; `__tests__/thesis-mode-boundary.test.ts`
- check result: expected red; 1 failed suite, 0 executed tests; exact failure `Cannot find package '@/src/engine/run-thesis-engine'`
- problem found: default API/page still has no thesis-only engine boundary; runtime AI route remains
- next work: add schema-checked thesis engine, physically move legacy artifacts, split routes, remove runtime AI, rerun focused tests

## 2026-07-10 15:15:00 +09:00

- phase / task ID: Phase 01 / T002 completion verification
- procedure: copied dirty worktree into writable root; verified branch/HEAD/key hashes; physically quarantined 36 legacy files; archived five runtime-AI files byte-for-byte; added thesis-only bundle/engine/API/default UI and explicit legacy routes; removed runtime model calls; made generated legacy candidates deterministic; reran audit and full quality chain
- result: move SHA mismatches 0; AI archive mismatches 0; audit 513 preserved source rows/110 legacy rule rows/package mismatch 0; Phase 01 validator errors 0; lint/typecheck pass; Vitest 9 files/34 tests pass; build 106 pages with no `/api/ai-explain`; pytest 4 pass
- limitation: G: cannot be re-opened in this sandbox; inventory explicitly uses preserved audit snapshot; current public deployment remains the legacy baseline
- decision: Phase 01 `complete_verified`; project remains `in_progress`; proceed to Phase 02 without treating synthetic proxies as human evidence

## 2026-07-10 15:35:00 +09:00

- phase / task ID: Phase 02 / protocol and search design local gate
- procedure: materialized canonical pending protocol, amendments, access matrix, outcome priorities, human/AI role matrix, registration status, five full PubMed drafts, platform translations, sentinel set, workload forecast, PRESS queue, and external review queue; verified current official access documentation; ran live PubMed ESearch design pilots
- result: five queries returned 19,961 combined design-pilot hits; B1 initially missed PMID 21525191, record inspection found `Urinary Calculi`/`urinary tract stone`, query corrected; final sentinel check 9/9; Phase 02 validator errors 0
- limitation: A1 12,229 and B2 4,879 predict high workload; independent PRESS, supervisor approval, subscription access, and full-text route remain external
- decision: Phase 02 remains `blocked_external`, not complete; public retrieval/tooling may continue only as design pilot or synthetic proxy

## 2026-07-10 15:45:00 +09:00

- phase / task ID: Phase 03 / public-source full-export proxy
- procedure: implemented resumable PubMed ESearch/EFetch exporter; partitioned A1 by publication-date ranges to bypass the 9,999 retrieval cap without relevance truncation; stored XML in 200-record batches; generated and rechecked SHA-256 files; normalized PubmedArticle and PubmedBookArticle records; generated exact DOI/title duplicate and report-linkage queues
- result: 19,961/19,961 retrieval instances exported; 19,609 unique PMIDs; 352 cross-question duplicate instances; 342 exact duplicate candidate pairs; 9/9 sentinels; 123 raw files checksum-verified; full proxy manifest 137 files; validator errors 0
- limitation: 0/342 human dedup decisions and 0/19,609 human study links; 33/235 legacy PMIDs not retrieved because legacy search scope differs; no omission inference made
- decision: proxy pipeline `complete_verified`, Phase 03 remains `blocked_external`; raw XML and abstract-rich records remain local/ignored with tracked hashes to avoid oversized/copyright-sensitive Git history

## 2026-07-10 15:55:00 +09:00

- phase / task ID: Phase 04 / screening queue proxy
- procedure: generated two independent deterministic priority profiles from title/abstract terms; retained every record-question unit in human review queue; generated blank human decision/full-text schemas and 50-row seeded training queue; reran generation and compared hashes
- result: 19,961 units in each proxy and human queue; sensitivity-first high/medium/low 15,862/3,117/982; structured-conservative 12,330/5,957/1,674; 4,224 proxy disagreements; deterministic hashes stable; validator errors 0
- limitation: human decisions 0, full-text assessments 0, final reports/studies unavailable, PRISMA prohibited
- decision: proxy queue `complete_verified`, Phase 04 `blocked_external`; no proxy recommendation has decision authority and AI-only exclusions remain 0

## 2026-07-10 16:05:00 +09:00

- phase / task ID: Phase 05 / extraction-metric synthetic harness
- procedure: retried isolated `jsonschema` install twice; both timed out; created standard-library invariant/metric harness, blank human extraction and RoB tables, valid and missing-locator fixtures
- result: extracted value with quote+locator accepted; missing locator rejected; Wilson/unsupported-claim metric fixture reproduced; human extraction 0, RoB 0, AI runs 0
- limitation: G: still access denied; package download unavailable; synthetic metric values are not AI performance
- decision: Phase 05 remains `blocked_external`; continue only schema/engine work with thesis claims/rules at zero

## 2026-07-10 16:10:00 +09:00

- phase / task ID: Phase 06 / safe-empty synthesis gate
- procedure: created five-question analysis-decision log and empty certainty/claim/rule registries; validated against empty human extraction/RoB and rebuilt thesis bundle
- result: meta-analysis 0, certainty 0, claims 0, rules 0, legacy promotions 0; validator errors 0; thesis builder 0/0
- decision: Phase 06 `blocked_external`; safe-empty state prevents invented synthesis or rules

## 2026-07-10 16:15:00 +09:00

- phase / task ID: Phase 07 / safe-empty engine and CI
- procedure: removed OpenAI runtime dependency/lock entry; added CI commands/workflow; generated 120 synthetic boundary inputs and ran each three times through thesis engine
- result: scenario smoke 1/1, contract 4/4, provenance 1/1 pass; determinism 100%; actions/rules/claims empty; legacy leakage 0
- limitation: independent gold 0, validated rules 0, expert review 0, validated deployment none
- decision: safe-empty software boundary verified; Phase 07 and release remain `blocked_external`

## 2026-07-10 16:20:00 +09:00

- phase / task ID: Phase 08 / truthful checkpoint finalization
- procedure: applied DOCX/PDF skill gates; checked result-freeze prerequisites; generated reproducibility instructions and manifest including tracked and local raw files
- result: checkpoint manifest 501 files, 104 local-required payloads; project_complete false; claims/rules 0/0; final DOCX/PDF/deployment null
- decision: no thesis document created before results freeze; Phase 08 remains `blocked_external`

## 2026-07-10 live-source continuation

- phase / task ID: Phase 01 evidence refresh and downstream provenance audit
- procedure: restored full filesystem access; re-opened original G: research root; hashed all files; reconciled paths, sizes, and SHA-256 against preserved audit; profiled 105 legacy CSVs by unique content
- result: 513 files, 57,398,308 bytes, exact snapshot match; missing 0, added 0, content mismatch 0; 105 CSV copies reduce to 28 unique CSV hashes
- finding: legacy tables contain automated `suggested_decision`, `seed_requires_human_source_check`, no independent reviewer IDs, and claim/extraction rows without exact full-text locators; no legacy promotion allowed
- decision: close G: access blocker only; retain protocol, PRESS, human screening/extraction/RoB/scenario blockers

## 2026-07-10 isolated research environment refresh

- procedure: retried dependency installation after full access restoration; installed pinned JSON Schema/YAML validators in `.venv`; wrote exact lock file; reran design-package validator
- result: errors 0, warnings 0; prior dependency blocker resolved

## 2026-07-10 — Live subscription-source access check

- Existing Chrome state checked read-only; no credentials or account state changed.
- Embase: `/landing?status=grey`, `Sign in` and `Check access`; authenticated search unavailable.
- Scopus: Preview homepage, `Sign in` and `Check access`; authenticated document search unavailable.
- CENTRAL: public search box, CENTRAL filters, and result counts reachable without sign-in; final export not run before protocol approval.
- Updated `research/protocol/access_matrix.csv`; recorded B-012. No source was falsely marked as a completed final search.

## 2026-07-10 — KMbase public-search transport pilot

- Inspected the live homepage form before retrying the inert Search button.
- Root cause in the controlled browser: the button is `type=button`, while jQuery, `form_submit`, and `goMaterial` were all undefined; no native form submission occurred.
- Replayed the same public multipart POST transport used by the official form. Positive control `warfarin` returned 5 KMbase hits (HTTP 200).
- Protocol drafts A1/A2 returned 0/0; long B1/B2/B3 Boolean drafts returned HTTP 500 with empty bodies.
- Captured the observation under `research/searches/kmbase_designpilot_20260710/`. Records/export/human decisions remain 0; query translation and final search remain false.

## 2026-07-10 — RISS public count pilot

- Replaced a stale/erroring SeriesMain route with the live `/index.do` form and inspected its GET parameters.
- Positive control `warfarin` returned 10,859 integrated hits; A1 `warfarin vitamin K` returned 555.
- A2/B1/B2/B3 draft Boolean strings returned explicit zero-result pages. These are translation warnings, not absence claims.
- Records/export/human decisions remain 0; captured the count-only observation under `research/searches/riss_designpilot_20260710/`.

## 2026-07-10 — KMbase/RISS split-query raw-response pilot

- Replaced five long Boolean translations with 20 short population/exposure pairs covering A1/A2/B1/B2/B3.
- Captured 20 KMbase JSON responses and 20 post-render RISS DOM responses; validator recomputed every byte length and SHA-256 with errors 0.
- KMbase: all 20 short pairs returned HTTP 200/0 hits; prior `warfarin` positive control remains 5, so recall/syntax is unresolved rather than negative evidence.
- RISS: 19/20 nonzero; query-level counts retained. Overlap prevents summing and no record export was attempted.
- Final-search, PRISMA, records-exported, PRESS, and human-decision flags remain false/zero.

## 2026-07-10 — Korean-database PRESS handoff package

- Generated 40 review rows directly from the checksum-bound KMbase/RISS split-pilot summary.
- Bound every row to platform, question, exact query, observed count, raw-response path, and SHA-256.
- Left reviewer identity, date, decision, comments, and revision fields blank; validator reports human decisions 0 and errors 0.
- Added an umbrella critical row to the main PRESS queue and explicit zero-recall/overlap safeguards to the reviewer instructions.

## 2026-07-10 — PMC sentinel full-text retrieval pilot

- Intersected 9 verified PubMed sentinels with 5,563 PMC locator candidates; 3 matched.
- Retrieved the three records in one official NCBI EFetch PMC XML request and preserved deterministic gzip plus compressed/uncompressed SHA-256.
- Parsed access properties instead of equating PMCID with full text: PMC5037562 supplied OA body XML (19 paragraphs, CC BY locator); PMC3069236 and PMC3127502 supplied front metadata only and are non-OA.
- Generated 10 section locators for the one OA article. Human full-text verification and eligibility decisions remain 0.

## 2026-07-10 — PMC paragraph provenance and non-OA queue

- Indexed all 19 body paragraphs in the OA sentinel XML with stable global paragraph positions, nearest section identifiers, normalized character counts, and text SHA-256.
- Validator re-parses the compressed raw XML and recomputes every paragraph hash; stored paragraph text is not duplicated in the index.
- Routed PMC3069236 and PMC3127502 to a two-row non-OA access queue. Requester/date/outcome/file-hash fields remain blank until human screening advancement.
- Phase 04 validator confirms 19 paragraph locators, 2 access rows, and zero human decisions.

## 2026-07-10 — Extraction source-contract integration

- Strengthened the Draft 2020-12 extraction schema so an extracted field requires a nonempty quote plus page or XML locator, non-legacy source path, and source SHA-256.
- Added a no-extraction contract fixture bound to the actual PMC5037562 gzip and first paragraph locator/hash.
- Mutation tests reject wrong source hash, wrong paragraph hash, nonexistent XML locator, and `legacy_unverified` source path.
- Corrected the Phase 05 validator to require the intentionally invalid missing-locator fixture to fail schema validation rather than incorrectly expecting every fixture to be schema-valid.
- Human extraction/RoB/AI rows remain 0/0/0.

## 2026-07-10 — Claim-rule-source contract gate

- Strengthened the evidence-to-rule schema with production/synthetic contract mode, extraction/source identifiers, non-legacy source path, source/locator/quote hashes, and human verifier IDs.
- `validated_thesis_scope` now requires `validation_status=validated` and at least two validation-evidence entries at schema level.
- Independent semantic checks require every linked claim to exist, match the rule question, and be validated; expert-review and independent-scenario evidence prefixes are mandatory.
- Nine synthetic-only tests pass. Production claims/rules and legacy promotions remain 0/0/0.
- Integrated the same semantic boundary into `build-thesis-bundle.ts`; targeted Vitest contract/isolation suite passes 7/7 and TypeScript checking passes.

## 2026-07-10 — Phase 07 blind review and independent-gold handoff

- Persisted all 120 deterministic synthetic inputs as JSONL and added their file SHA-256 to the executable proxy report.
- Generated a 120-row blind expert queue bound to each input, runner, engine, and thesis-bundle SHA; outputs are not exposed and all reviewer fields are blank.
- Generated a separate 120-row independent-gold authoring queue balanced 24 per question. Both author drafts, adjudication, critical-failure labels, and gold hashes remain blank.
- Validator confirms synthetic inputs/reviews/gold-authoring rows 120/120/120; expert reviews and independent gold remain 0/0.

## 2026-07-10 — Non-final methods document checkpoint

- Drafted only protocol- and implementation-supported methods; results, discussion, conclusion, and both abstracts remain absent before freeze.
- Generated a Korean A4 DOCX and Word-exported PDF marked `비최종본`; no proxy count is presented as an effectiveness or safety result.
- Rendered all eight PDF pages and visually inspected 8/8: clipping 0, overlap 0, Korean glyph errors 0.
- Bound Markdown, DOCX, and PDF bytes to SHA-256 in a machine-readable QA record and added a standard-library validator.

## 2026-07-10 — Live source recheck and Phase 02 evidence manifest

- Re-opened the authoritative G: `여형준` source root and rehashed all 513 files: missing 0, added 0, content mismatch 0.
- Distinguished the 126-file GPT handoff package from the original 513-file research source; the handoff package was not substituted for source reconciliation.
- Bound 21 Phase 02 protocol, query, pilot, and review-queue artifacts to SHA-256.
- Validator confirms external-gate flags remain false, main PRESS rows 8, Korean PRESS rows 40, and no verified human decisions were inferred.

## 2026-07-10 — Phase 03 record/dedup lineage recomputation

- Independently reparsed 103 checksum-preserved PubMed XML batches rather than trusting normalized CSV row counts.
- Matched 19,609 records and 19,961 retrieval instances to their exact raw-file PMID, normalized title, and DOI.
- Independently recomputed all 342 exact DOI/title duplicate candidate pairs and their reasons.
- Rejected 5/5 mutations: wrong raw PMID, wrong title, missing duplicate candidate, filled human decision, and filled study link.
- Human dedup decisions and human study links remain 0; no proxy row was promoted.

## 2026-07-10 — Phase 04 screening-lineage gate

- Proved exact record-question key equality across 19,961 PubMed retrievals, both proxy outputs, the mandatory human-review queue, and empty decision shells.
- Confirmed all 207 ClinicalTrials.gov and 62 KoreaMed retrieval units reach their corresponding human queues without loss.
- Verified queue title/year values against normalized records and preserved proxy decision authority as `none`.
- Rejected 6/6 screening mutations; human decisions and AI-only exclusions remain 0.
- Revalidated the PMC sentinel source: 3 articles, 1 OA XML, 19 paragraph hashes, 2 non-OA access rows, human locator/eligibility decisions 0.

## 2026-07-10 — Phase 05 source/report/extraction contract

- Replaced the contract-only fake report identifier with the real unassessed candidate `RPT-PUBMED-27657121` without promoting it to inclusion.
- Verified report→record→PMCID→stored gzip SHA→decompressed XML→paragraph 1 text SHA and A2 question membership.
- Confirmed the report still has no study link and remains `needs_human_study_linkage`.
- Rejected 6/6 Phase 05 boundary mutations: extracted value without quote, unknown report, premature study link, populated human extraction, populated RoB, and nonzero AI run.
- Human extraction, RoB, frozen gold, and AI performance rows remain 0.

## 2026-07-10 — Phase 06 GRADE-to-claim provenance

- Added an empty curated `certainty_assessments.jsonl` registry and included it in deterministic thesis-bundle generation.
- Made `certainty_assessment_id` mandatory for every claim contract and required a matching validated question/grade row.
- Strengthened production provenance so report and extraction source IDs, extraction locator/hash, quote, and quote hash must equal claim support.
- Expanded synthetic claim-rule mutations from 9 to 11 with missing and mismatched GRADE rejection.
- TypeScript provenance tests pass 9/9; production certainty/claim/rule rows and legacy promotions remain 0/0/0/0.

## 2026-07-10 — Phase 07 deterministic matcher implementation

- Removed the placeholder failure that rejected every nonempty validated-rule bundle.
- Implemented strict exact matching for candidate item, medication, condition, jurisdiction, and age constraints.
- Added deterministic action-class priority ordering, rule identifiers, and linked evidence-claim resolution.
- Added three synthetic contract tests covering matching/order/provenance output, byte determinism, partial-string rejection, and unknown-condition rejection.
- Regenerated the 120×3 safe-empty report and both 120-row human queues against the new engine/bundle SHA; legacy leakage and nonempty empty-state outputs remain 0.
- Independent gold, expert review, clinical performance metrics, and validated deployment remain absent.

## 2026-07-10 — Phase 08 finalization-readiness audit

- Added a machine-readable A-K acceptance-gate assessment bound to ten phase/deployment/document evidence files.
- Recorded Phase 01 as complete and Phases 02-08 as externally blocked; all 11 final acceptance areas remain open.
- Mechanically fixed results freeze, results writing, final DOCX/PDF, project completion, validated deployment, and submission manifest to false/null.
- Validator rejects evidence hash drift, premature final artifacts, nonzero unverified human/research outputs, or any false completion flag.
- The nonfinal methods checkpoint remains available; no final results section or final thesis artifact was created.

## 2026-07-10 — Local production browser/API smoke

- Started the optimized Next.js production build and inspected `/` and `/legacy` with Playwright Chromium.
- Found and corrected four stale homepage research-question labels that did not match protocol A1-A2/B1-B3.
- Centralized the five labels in a domain constant and added a regression test.
- Rechecked the homepage, legacy warning, thesis API empty validated scope, robots, and sitemap: 11/11 smoke checks pass.
- Captured source/build hashes in `local_production_smoke.json`; this is local software evidence, not a validated public deployment.

## 2026-07-10 — Consolidated external-human handoff

- Inventoried 21 protocol, PRESS, deduplication, screening, access, extraction, RoB, synthesis, validation, and finalization queues/templates.
- Bound 20,900 current rows to file SHA-256 and recorded each queue's protected human-only fields.
- Verified protected human fields populated 0; phase-level blocker rows are instructions, not completed judgments.
- Added a dependency-ordered handoff guide so later judgments cannot be entered before their sampling frames are frozen.
- Linked the handoff manifest into finalization readiness; no synthetic or legacy value was converted to a human decision.

## 2026-07-10 — Future-safe human-review progress states

- Corrected the handoff validator so legitimate future reviewer entries no longer fail merely for being nonzero.
- Added queue-specific human-entry and minimum-completion fields with four actionable states plus blocker instructions.
- Current distribution is 7 blocker instructions, 9 not started, and 5 awaiting upstream rows; in-progress and complete-candidate rows remain 0.
- Five state-contract tests cover instruction, upstream-empty, untouched, partial, and complete-candidate transitions.
- `human_work_complete` remains false even for complete candidates until phase-specific validators accept the decisions.

## 2026-07-10 — Writable main PRESS decisions

- Added reviewer ID, review date, decision, comments, and required-revision columns to all eight main PRESS rows without altering findings or allowed decisions.
- Phase 02 validation rejects decisions outside each row's allow-list, missing reviewer/date, and partial reviewer identity without a decision.
- Rebuilt the 21-artifact Phase 02 evidence manifest and human handoff hashes.
- Main PRESS is now actionable `not_started`, not a blocker-only instruction; completed rows remain 0/8.
