# Phase 04 gate status

Date: 2026-07-10  
Phase status: `blocked_external`  
Proxy queue status: `complete_verified`

| Criterion | Status | Evidence |
|---|---|---|
| Screening storage and manual | pass_local | empty human-decision schema, full-text schemas, copied design manual |
| Priority dry run | pass_proxy_only | two deterministic proxy outputs; 19,961 units; 4,224 disagreements |
| All retrieval units retained for people | pass_proxy_only | PubMed 19,961 + ClinicalTrials.gov 207 + KoreaMed 62 queues; no prefilled decision |
| PubMed human review context | pass_proxy_only | 19,961/19,961 rows pair title, abstract, authors, year, journal, publication type, DOI/PMID, two proxy reasons, and raw XML; abstracts present 18,015 and absent 1,946; decision authority none |
| Retrieval → proxy → human queue lineage | pass_proxy_only | exact record-question key equality across PubMed retrievals, both proxy profiles, review queue, and decision shells; registry/KoreaMed retrieval queues exact |
| Screening boundary mutations | pass_proxy_only | 6/6 missing-unit, authority, decision, title, pilot-scope, and registry-loss mutations rejected |
| AI-only exclusions | pass | 0 |
| Human title/abstract or registry decisions | blocked_external | 0/20,230 database-question retrieval units |
| Blinded secondary-review selection | pass_local | all include/uncertain plus ceil(20%) per excluded question/reason stratum; 5/5 contracts; awaiting primary rows |
| Secondary queue preservation/progression | pass_local | populated reviewer-2 bytes preserved; selection drift rejected before write; not-started/in-progress/complete-candidate states; preservation 3/3 |
| Full-text double-review routing | pass_local | secondary final include/uncertain only; proxy fields absent; reviewer 1/2/final fields; 7/7 contracts; awaiting secondary rows |
| Full-text queue preservation/progression | pass_local | access/source/study/design/two-reviewer bytes preserved; routing drift rejected; actual source SHA reproduced; preservation 3/3; complete candidates 0 |
| Human pilot training | blocked_external | 0/50 |
| Full-text double review | blocked_external | 0 reports assessed |
| Public PMC locator resolution | pass_proxy_only | 19,609 PMID input; 99 checksum-verified responses; 5,563 unique PMCID candidates; human verification 0 |
| PMC full-text retrieval path | pass_design_pilot_only | 3 PMC-located sentinels fetched in one official EFetch batch; 1 OA full-text XML, 2 metadata-only non-OA; 10 section + 19 paragraph-hash locators; 2-row non-OA access queue; human decisions 0 |
| Final reports/studies | blocked_external | not created |
| PRISMA final flow | blocked_external | explicitly unavailable |
| Human gold hash and AI performance | blocked_external | no human gold |

Phase 04 is not complete. Proxy bands must not appear as inclusion decisions or thesis results.

The 20,230 total is a retrieval-unit workload count (19,961 PubMed + 207 ClinicalTrials.gov + 62 KoreaMed), not a deduplicated-record, included-report, study, or final PRISMA count. All 139 A1 registry units carry the known vitamin-K-antagonist lexical-risk flag. KoreaMed native export failed at the server; 62 A1 KMIDs/titles were captured only after the page proved complete display `1-62`.

PMC identifiers are access locators only. The 5,563 candidates exactly reproduce the PMCID set parsed from PubMed XML, but none is an eligibility decision, verified extraction source, or completed full-text review.

The sentinel retrieval pilot proves the lawful XML/hash/locator path, not screening completion. PMC presence does not imply reusable full-text XML: two of three sentinel PMC records returned front metadata only and require a library/publisher route if advanced by human screening.

Paragraph rows store locator, normalized character count, and SHA-256 only; they do not assert a claim or human-verified source location. Non-OA access requests remain pending until a human screening decision advances the report.
