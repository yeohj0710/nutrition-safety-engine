# AI Exploratory Evidence-Mapping Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the human-screened systematic-review claim with a transparent AI-only exploratory evidence-mapping and deterministic software-validation study while preserving all legacy and human-review artifacts.

**Architecture:** Protocol v2 creates a new authority layer rather than rewriting v1 history. Automated retrieval, duplicate-candidate grouping, screening classification, structured extraction, descriptive evidence mapping, provisional claims, and synthetic engine tests remain explicitly AI-generated; none may be described as human consensus, systematic-review inclusion, GRADE, clinical validation, or deployment approval.

**Tech Stack:** Markdown/CSV/JSON/YAML protocol artifacts, Python deterministic builders and validators, TypeScript/Vitest thesis engine, DOCX/PDF render pipeline.

---

### Task 1: Freeze the design amendment

**Files:**
- Create: `research/protocol/protocol-v2.0-ai-exploratory.md`
- Create: `research/protocol/ai_exploratory_role_matrix.md`
- Modify: `research/protocol/amendments.csv`
- Create: `tools/validate_protocol_v2.py`

- [ ] Write a validator that requires the new title, AI-only scope, prohibited claims, preserved v1 lineage, and amendment record.
- [ ] Run `python tools/validate_protocol_v2.py` and confirm it fails before the new artifacts exist.
- [ ] Add the v2 protocol, role matrix, and dated amendment with the user's 2026-07-12 instruction as the authority record.
- [ ] Rerun the validator and require `errors: []`.
- [ ] Commit with `git commit -m "feat: adopt transparent AI exploratory protocol"`.

### Task 2: Replace human-only phase gates with exploratory gates

**Files:**
- Create: `research/protocol/ai_exploratory_acceptance_criteria.md`
- Create: `research/PROGRESS_LEDGER_V2.md`
- Modify: `research/screening/phase_04_exit_criteria.md`
- Modify: `research/extraction/phase_05_exit_criteria.md`
- Modify: `research/synthesis/phase_06_exit_criteria.md`
- Modify: `research/validation/phase_07_exit_criteria.md`

- [ ] Define exact permitted outputs and prohibited interpretations for Phases 02–08.
- [ ] Preserve every v1 human queue unchanged and label it `not_applicable_to_v2_execution` rather than completed.
- [ ] Add validators rejecting `systematic review`, `human consensus`, `GRADE certainty`, and `clinically validated` claims in v2 results.
- [ ] Run phase validators and commit the gate migration.

### Task 3: Build AI-only screening and evidence-map datasets

**Files:**
- Create: `tools/build_ai_exploratory_screening.py`
- Create: `tools/validate_ai_exploratory_screening.py`
- Create: `data/curated_v2/ai_screening_classifications.csv`
- Create: `research/screening/ai_exploratory_screening_manifest.json`

- [ ] Combine both existing deterministic proxy profiles without copying values into human columns.
- [ ] Classify agreement-include, agreement-exclude, and disagreement/uncertain with reasons and source hashes.
- [ ] Retain all 19,961 units in the output and prohibit PRISMA inclusion/exclusion terminology.
- [ ] Add exact-coverage, deterministic-rebuild, and authority-boundary mutation tests.
- [ ] Commit the verified AI screening layer.

### Task 4: Build provisional extraction and descriptive synthesis

**Files:**
- Create: `tools/build_ai_exploratory_evidence_map.py`
- Create: `tools/validate_ai_exploratory_evidence_map.py`
- Create: `data/curated_v2/evidence_map.csv`
- Create: `research/synthesis/ai_exploratory_map_manifest.json`

- [ ] Restrict extraction to source-visible bibliographic/abstract fields and immutable locators.
- [ ] Record `abstract_only`, `fulltext_locator_available`, and unsupported fields explicitly.
- [ ] Produce counts and distributions only; prohibit effect pooling, RoB, GRADE, or clinical recommendations.
- [ ] Verify every row against raw-source hashes and commit.

### Task 5: Build provisional claims and a non-clinical engine mode

**Files:**
- Create: `data/curated_v2/provisional_claims.jsonl`
- Create: `data/curated_v2/exploratory_rules.jsonl`
- Modify: `src/lib/thesis/domain.ts`
- Modify: `src/lib/thesis/loader.ts`
- Test: `__tests__/ai-exploratory-boundary.test.ts`

- [ ] Add a separate `ai_exploratory` mode that cannot enter `validated_thesis_scope`.
- [ ] Require every provisional claim to expose AI provenance, source locator, and uncertainty label.
- [ ] Limit outputs to evidence-navigation messages; prohibit treatment, avoidance, dose, and referral actions.
- [ ] Run Vitest, typecheck, and build; commit.

### Task 6: Validate the deterministic exploratory engine

**Files:**
- Create: `research/validation/ai_exploratory_scenarios.jsonl`
- Create: `scripts/evaluate-ai-exploratory-scenarios.ts`
- Create: `research/validation/ai_exploratory_performance.json`

- [ ] Generate deterministic synthetic scenarios without calling them independent gold.
- [ ] Report software determinism, schema validity, provenance completeness, and unsafe-action leakage only.
- [ ] Require zero unsafe clinical actions and zero legacy leakage.
- [ ] Commit the technical-validation evidence.

### Task 7: Write and render the revised Korean thesis

**Files:**
- Create: `research/thesis/ai_exploratory_thesis_ko.md`
- Create: `research/thesis/ai_exploratory_thesis.docx`
- Create: `research/thesis/ai_exploratory_thesis.pdf`
- Create: `research/thesis/ai_exploratory_final_manifest.json`

- [ ] Align title, abstract, methods, results, discussion, and limitations with protocol v2.
- [ ] State all unavailable licensed databases and full texts without inferring absence.
- [ ] Present only verified descriptive and technical-validation results.
- [ ] Render DOCX/PDF, inspect every page, validate citations and hashes, then commit final artifacts.

### Task 8: Completion audit

**Files:**
- Create: `research/audit/ai_exploratory_completion_audit.json`
- Modify: `research/logs/WORKLOG.md`
- Modify: `research/logs/DECISIONS.md`
- Modify: `research/logs/RISKS.md`
- Modify: `research/logs/BLOCKERS.md`

- [ ] Map every v2 requirement to direct evidence.
- [ ] Run all Python validators, Vitest, typecheck, production build, and local runtime smoke test.
- [ ] Verify a clean worktree and regenerate the checkpoint/final manifest.
- [ ] Mark only the v2 exploratory study complete; retain v1 systematic-review status as externally blocked.
