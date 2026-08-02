# Nutrition Safety Engine User-first UX Implementation Plan

> **For Codex:** Execute this plan locally. Do not deploy without an explicit request.

**Goal:** Make the evidence result readable without weakening one-to-one citation traceability.

**Architecture:** Keep the API and research artifacts unchanged. Change only the client presentation so the summary reveals three paper-specific findings first, keeps the remaining findings in a semantic disclosure, and provides clear jumps between the query and full source list.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind CSS, Vitest

---

### Task 1: Lock the compact evidence-summary contract

**Files:**
- Modify: `__tests__/personalized-safety-ui-contract.test.ts`

- [x] Require a three-item summary limit and a collapsed remainder.
- [x] Require stable query and evidence-list anchors.
- [x] Preserve the existing one-finding-to-one-paper numbering contract.

### Task 2: Implement the result hierarchy

**Files:**
- Modify: `src/components/personalized-safety-query.tsx`

- [x] Add `SUMMARY_FINDING_LIMIT = 3`.
- [x] Render the first three findings in the summary.
- [x] Render remaining findings inside `AnimatedDetails` with their original paper numbers.
- [x] Add “문헌 목록 보기” and “입력 조건으로 돌아가기” links.
- [x] Add visible keyboard focus and input metadata without changing filtering behavior.

### Task 3: Verify locally

**Files:**
- Test: `__tests__/personalized-safety-ui-contract.test.ts`

- [x] Run the focused contract test.
- [x] Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- [x] Do not commit or deploy unless explicitly requested.
