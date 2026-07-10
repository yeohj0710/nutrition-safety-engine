# Phase 01 Audit and Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish an evidence-backed baseline of the repository, research inputs, production deployment, legacy data lineage, rule scope, hard-coded counts, and test gaps without treating any legacy artifact as a validated thesis result.

**Architecture:** Preserve the redesign package as an immutable local reference under `research/design/20260710/`, store audit evidence under `research/audit/`, and mirror all legacy runtime/research data under `data/legacy_unverified/` with a checksum manifest. The current application remains executable for baseline testing, but new thesis bundles must not load legacy data by default.

**Tech Stack:** Git, PowerShell, Node.js/Next.js 16, TypeScript, Vitest, Python, pytest, JSON/CSV, SHA-256, Vercel metadata and HTTP smoke tests.

---

## File structure

- Create `research/design/20260710/`: immutable copy of the redesign package.
- Create `research/logs/WORKLOG.md`: command and evidence log.
- Create `research/logs/DECISIONS.md`: decisions, alternatives, impact, and review conditions.
- Create `research/logs/RISKS.md`: active research/software risks and mitigation status.
- Create `research/logs/BLOCKERS.md`: only externally blocked work and minimum requested input.
- Create `research/audit/repo_inventory.json`: repository, environment, files, hashes, Git, and dependency baseline.
- Create `research/audit/data_lineage.md`: source-to-evidence-to-rule-to-UI trace with verified and broken edges.
- Create `research/audit/deployment_baseline.json`: project, deployment, commit, HTTP, and smoke-test evidence.
- Create `research/audit/hardcoded_counts_report.md`: count/scope strings and whether they are generated or hard-coded.
- Create `research/audit/rule_scope_report.csv`: every legacy rule classified by thesis scope and validation state.
- Create `research/audit/test_gap_report.md`: executed commands, failures, and missing coverage.
- Create `research/review_queue/phase_01_external_review.csv`: concrete human/external review items found during audit.
- Create `data/legacy_unverified/manifest.json`: checksummed inventory and reason for legacy quarantine.
- Modify `.gitignore` only if restricted full texts or local secrets need explicit protection.
- Modify legacy loader/build wiring only when required to ensure the new thesis bundle excludes legacy data by default; preserve baseline behavior and add regression tests.

### Task 1: Freeze entry evidence

- [ ] **Step 1: Record repository baseline**

Run:

```powershell
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
git remote -v
git tag --list
```

Expected: clean worktree before audit changes; exact commit and remote captured in `WORKLOG.md` and `repo_inventory.json`.

- [ ] **Step 2: Create the dated branch**

Run:

```powershell
git switch -c thesis-reboot-20260710
```

Expected: current branch is `thesis-reboot-20260710`.

- [ ] **Step 3: Copy and verify the redesign package**

Run package copy, then compare source and copied SHA-256 sets.

Expected: every source package file has one identical copied hash; mismatches are zero.

### Task 2: Inventory repository and research inputs

- [ ] **Step 1: Enumerate files without following generated dependency trees**

Run file inventory for Git-tracked repository files and all files under the designated research input folder.

Expected: each row contains normalized path, size, modification time, SHA-256, and provenance class.

- [ ] **Step 2: Capture runtime and dependency versions**

Run:

```powershell
node --version
npm --version
python --version
npm ls --depth=0
python -m pip freeze
```

Expected: command exit codes and outputs summarized in `repo_inventory.json`; failures preserved verbatim.

- [ ] **Step 3: Verify package manifest claims**

Compare package `manifest.json` hashes and sizes against current package files.

Expected: each mismatch or missing file listed; no completion flag trusted without hash confirmation.

### Task 3: Audit data lineage and quarantine legacy data

- [ ] **Step 1: Trace loaders and generators**

Inspect `scripts/build-knowledge-index.ts`, `src/lib/knowledge/`, runtime API routes, page components, and all data inputs.

Expected: `data_lineage.md` lists exact files and functions for `raw/source -> evidence -> rule -> generated index -> API -> UI`.

- [ ] **Step 2: Validate identifiers and references**

Run schema parsing and independent reference checks for source IDs, evidence IDs, rule IDs, and generated outputs.

Expected: orphan, duplicate, missing, and inconsistent IDs counted with file/record locations.

- [ ] **Step 3: Copy legacy artifacts into quarantine**

Copy legacy data; do not delete or rename originals during baseline audit.

Expected: `data/legacy_unverified/manifest.json` records original path, quarantine path, SHA-256, status `legacy_unverified`, reason, and exclusion policy.

- [ ] **Step 4: Prove new thesis bundle exclusion**

Add a failing regression test showing legacy records can enter the thesis bundle if the gap exists, then implement the minimum loader/build separation.

Expected: thesis-mode test passes and no legacy record is marked or returned as validated.

### Task 4: Audit counts, wording, and rule scope

- [ ] **Step 1: Search count-like literals and scope claims**

Use `rg` across application code, generated files, data, scripts, tests, and docs.

Expected: report distinguishes generated data values, test fixtures, stale prose, and user-visible hard-coded research counts.

- [ ] **Step 2: Classify every rule**

Assign A1, A2, B1, B2, B3, `exploratory_demo`, `legacy_unverified`, or `future_scope` using explicit ingredient/context evidence.

Expected: one row per rule with current status, source/evidence references, thesis scope, UI exposure, and issue codes; no automatic `validated` promotion.

- [ ] **Step 3: Reproduce legacy count disagreements**

Recalculate source, evidence, rule, search-run, retrieved-record, screening, and UI counts from their source files.

Expected: every observed number includes denominator, unit, stage, source path, and reproducible command.

### Task 5: Execute baseline tests and gap analysis

- [ ] **Step 1: Run all declared Node checks**

Run:

```powershell
npm run prepare:knowledge
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: exit code, duration, test count, failures, generated-file changes, and warnings captured separately.

- [ ] **Step 2: Run Python tests and pipeline-safe checks**

Discover tests first, then run the repository-supported Python suite without executing final literature searches.

Expected: exact discovered/passed/failed/skipped counts; missing tests reported as a gap rather than a pass.

- [ ] **Step 3: Map acceptance criteria to test coverage**

Expected: `test_gap_report.md` maps each applicable Phase 01 and QA item to automated test, manual evidence, gap, or external blocker.

### Task 6: Verify production deployment

- [ ] **Step 1: Resolve production deployment metadata**

Inspect `.vercel/project.json`, available Vercel metadata/API/CLI, and public headers/build evidence.

Expected: deployment ID/URL/time/commit recorded when accessible; otherwise exact attempted command and blocker recorded.

- [ ] **Step 2: Run representative public smoke tests**

Check HTTP status and representative A1/A2/B1-B3/out-of-scope inputs through public UI/API where available.

Expected: request/response evidence, displayed rule IDs, scope leakage, and current-vs-production differences recorded without treating output as validated clinical evidence.

### Task 7: Close Phase 01 evidence

- [ ] **Step 1: Update logs, task board mirror, risks, blockers, and review queue**

Expected: every critical gap has owner/status/next action; human requests specify location, question, choices, and decision rule.

- [ ] **Step 2: Hash Phase 01 outputs**

Expected: SHA-256 manifest covers every audit deliverable and log snapshot.

- [ ] **Step 3: Evaluate exit criteria**

Expected: each Phase 01 exit criterion marked `pass`, `fail`, `blocked_external`, or `needs_human_review` with evidence path. Phase remains incomplete unless all mandatory exit criteria pass.

- [ ] **Step 4: Run self-review**

Check specification coverage, placeholder patterns, path consistency, and unsupported completion claims.

Expected: no placeholder language in executable instructions; uncovered requirements added before phase status decision.

- [ ] **Step 5: Commit the verified phase checkpoint**

Run only after exit evaluation:

```powershell
git add docs/superpowers/plans research data/legacy_unverified .gitignore
git commit -m "chore: establish phase 01 research audit baseline"
```

Expected: commit contains only Phase 01 work; pre-existing unrelated files remain untouched.
