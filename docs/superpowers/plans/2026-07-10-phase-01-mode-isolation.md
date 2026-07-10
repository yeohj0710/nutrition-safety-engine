# Thesis/Legacy Mode Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Phase 01 default-mode safety gaps by physically isolating legacy artifacts, removing runtime LLM calls, and proving that the public thesis path can expose only deterministic `validated_thesis_scope` records.

**Architecture:** Move legacy inputs and generated indexes beneath explicit `legacy_unverified` namespaces while preserving their bytes and history. Build a separate curated thesis bundle from schema-checked JSONL files, serve it through a deterministic engine and the default API, and retain the old explorer only under a no-index `/legacy` route with an explicit warning.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Vitest, PowerShell, SHA-256, ESLint, Toss web style references.

---

## Task 1: Freeze a failing boundary test

- [ ] Add `__tests__/thesis-mode-boundary.test.ts` covering deterministic thesis responses, empty validated scope, absence of legacy IDs/counts from the default page, and absence of the runtime AI route/fetch.
- [ ] Add a legacy API test proving the quarantined demo remains intentionally reachable only from `/api/legacy/rules/query`.
- [ ] Run the two tests and preserve the expected initial failures in `research/logs/WORKLOG.md`.

## Task 2: Physically quarantine legacy artifacts

- [ ] Verify every resolved source/destination remains under `C:\dev\nutrition-safety-engine`.
- [ ] Move the legacy root JSON files and `data/systematic_search/` to `data/legacy_unverified/baseline-33658e3/`; never delete them.
- [ ] Move legacy generated indexes to `src/generated/legacy/` and update legacy builders, loaders, scripts, and tests to those explicit paths.
- [ ] Regenerate `data/legacy_unverified/manifest.json` and prove pre/post SHA-256 equality for every moved file.

## Task 3: Build the thesis-only domain and bundle

- [ ] Add empty curated JSONL stores for sources, reports, studies, extractions, risk-of-bias records, claims, and rules.
- [ ] Expand `scripts/build-thesis-bundle.ts` to parse all stores deterministically, validate identifiers/references, filter only `status=validated` plus `scope=validated_thesis_scope`, and emit `src/generated/thesis-bundle.json`.
- [ ] Add `src/domain/thesis.ts`, `src/evidence/load-thesis-bundle.ts`, and `src/engine/run-thesis-engine.ts` with stable request hashing and explicit empty-scope limitations.

## Task 4: Split default and legacy routes

- [ ] Replace `/api/rules/query` with the thesis engine and move the existing engine handler to `/api/legacy/rules/query`.
- [ ] Replace `/` with a calm thesis-status page that reads only the thesis bundle and never displays legacy research counts.
- [ ] Move the existing explorer and detail pages under `/legacy`, repair internal links, add `noindex,nofollow`, exclude them from sitemap, and disallow them in robots.

## Task 5: Remove runtime LLM behavior

- [ ] Delete `app/api/ai-explain/route.ts`.
- [ ] Remove the automatic `/api/ai-explain` client effect, AI state/schema imports, and AI-only rendering props while preserving deterministic legacy explanations.
- [ ] Search application runtime files for `openai`, `ai-explain`, and runtime model calls; require zero hits outside offline research tooling and archived audit evidence.

## Task 6: Verify and close the Phase 01 gate

- [ ] Run focused boundary tests, `npm run lint`, `npm run typecheck`, full Vitest, Python tests, and `npm run build`; capture exact counts and warnings.
- [ ] Inspect the built route table and rendered default/legacy pages; prove `/` and `/api/rules/query` contain no legacy records and `/api/ai-explain` is absent.
- [ ] Regenerate the audit reports, hard-coded count report, data-lineage report, exit criteria, hashes, `PROGRESS_LEDGER.md`, `WORKLOG.md`, `DECISIONS.md`, `RISKS.md`, and `BLOCKERS.md`.
- [ ] Mark Phase 01 `complete_verified` only if every local mandatory exit criterion passes; record undeployed production as later work, not as verified deployment.
- [ ] Commit the verified checkpoint on `thesis-reboot-20260710`; push only when the configured remote and branch policy are safe.
