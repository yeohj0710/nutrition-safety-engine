# Phase 01 test baseline and gap report

Audit date: 2026-07-10

## Verified Phase 01 chain

| Command | Result |
|---|---|
| `python tools/phase01_audit.py ...` | pass: 513 source-snapshot rows, 110 legacy rules, design manifest mismatches 0 |
| `python tools/validate_phase01.py` | pass: errors 0, legacy files 36, thesis claims/rules 0/0 |
| `npm run lint` | pass, warnings 0 |
| `npm run typecheck` | pass |
| `npm test` | pass: 9 files, 34 tests |
| `npm run build` | pass: 106 pages; default thesis API, explicit legacy API, no runtime AI route |
| `python -m pytest -q` | pass: 4 tests |
| design-package validator | errors 0; two `jsonschema` availability warnings |

Added tests cover default thesis boundaries, explicit legacy boundaries, physical quarantine, and curated-only bundle isolation. Repeated legacy/thesis generation now gives stable hashes.

## Resolved Phase 01 gaps

- TG-001: default app/API now consumes only the thesis bundle.
- TG-004: runtime AI route/client/module removed and archive hash-verified.
- TG-006: literature-candidate generation timestamp derives from search inputs.
- TG-012: legacy count assertions remain only in explicit legacy tests and cannot leak into default UI.

## Remaining later-phase gaps

| ID | Severity | Gap | Required gate |
|---|---|---|---|
| TG-002 | critical | No accepted `rule -> validated claim -> report/source -> exact locator` records yet | 4–6 |
| TG-003 | critical | No human semantic-support review set yet | 4–6 |
| TG-005 | critical | No independent locked scenario gold | 7; external human blocker |
| TG-007 | major | Partial-string and unit conversion matrix incomplete | 7 |
| TG-008 | major | Network-level API contract suite incomplete | 7 |
| TG-009 | major | Committed browser E2E/UI-API equality suite incomplete | 7 |
| TG-010 | major | Formal privacy/log inspection test incomplete | 7 |
| TG-011 | major | Threshold and missing-field boundary matrix awaits validated rules | 6–7 |
| TG-013 | major | Locked isolated Python environment not yet established | 2 |
| TG-014 | major | CI workflow and release-deployment identity gate absent | 7 |

Passing software tests establish isolation and determinism only. They do not establish literature validity, AI performance, clinical validity, or thesis results.
