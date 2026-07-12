# External human handoff

Status: `ready_for_external_review_not_completed`

Convenience copy: `external_review_handoff.xlsx` contains seven visually checked sheets for PRESS, duplicate context/decisions, registry context/decisions, and the 50-row screening training pilot. It is not the authority of record; reconcile completed cells back to the canonical CSV files and run validators. Its source/workbook hashes are stored in `external_review_handoff_manifest.json`.

Complete work in dependency order. Do not enter later-phase judgments before the upstream sampling frame is frozen.

1. Protocol approval and PRESS: `PRESS_review.csv`, then every row of `korean_db_PRESS_review.csv` and authenticated platform translations.
2. Retrieval and deduplication: rerun approved final searches, preserve native exports, then complete `deduplication_decisions.csv`, `registry_linkage_decisions.csv`, and report-study linkage.
3. Screening and full text: complete primary decisions, run `build:secondary-screening`, complete the blinded secondary queue, then adjudicate and record lawful full-text access, exclusion reasons, and report-study links.
4. Extraction and RoB: run `build:extraction-rob-work` after verified full-text inclusion; then populate `extractions_human.csv` and `risk_of_bias.csv` with two-person verification and source locators.
5. Synthesis and GRADE: decide question-specific pooling, complete outcome-level certainty rows, then validate claims and rules.
6. Independent validation: independently author twice and adjudicate all 120 gold scenarios; expert review remains separate from gold authoring.
7. Finalization: confirm institutional/department requirements, freeze results, validate deployment, then create final DOCX/PDF and submission manifest.

`human_handoff_manifest.json` records exact file hashes, row counts, human-entry fields, minimum completion fields, and `not_started/in_progress/complete_candidate/awaiting_upstream` states. A complete candidate still requires phase-specific validation; it is not automatic approval. Synthetic proxy values, blank shells, and legacy files cannot be used as human decisions.
