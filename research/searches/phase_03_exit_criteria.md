# Phase 03 gate status

Date: 2026-07-10  
Phase status: `blocked_external`  
Proxy pipeline status: `complete_verified`

| Criterion | Proxy evidence | Final-gate status |
|---|---|---|
| Total hits and export counts reconcile | five PubMed pilots, 19,961/19,961; five ClinicalTrials.gov pilots, 207/207 | pass_proxy_only |
| CENTRAL live hit-count syntax | five runs, 2,264 hits observed; 0 records exported | pass_hitcount_only_export_blocked |
| KoreaMed live design pilot | five runs, hits 62/0/0/0/0; A1 complete display 62 unique KMIDs; native export 0/server error | pass_complete_display_proxy_only |
| KMbase/RISS split-query pilot | 20 short queries per platform; 40 checksum-verified raw responses; KMbase records 0; RISS records/export 0 | pass_hitcount_design_only_export_blocked |
| No top-N truncation | A1 split into 14 publication-date partitions; all unique IDs equal reported hits | pass_proxy_only |
| Raw hashes | PubMed payload/metadata manifest plus 20 ClinicalTrials.gov files checksum-verified | pass_proxy_only |
| Raw XML → record → retrieval lineage | 103 XML files independently reparsed; 19,609 records and 19,961 retrievals matched PMID/title/DOI/raw path | pass_proxy_only |
| Sentinel recall | 9/9 | pass_proxy_only |
| Normalized records | PubMed: 19,961 retrieval instances/19,609 unique PMIDs; registry: 207 retrieval instances/201 unique NCT IDs | pass_proxy_only |
| Duplicate candidate generation | 342 exact DOI/title pairs | pass_proxy_only |
| Duplicate candidate independent recomputation | 342/342 pairs and reasons exact; 5/5 corruption mutations rejected | pass_proxy_only |
| Human duplicate decisions | 0/342 | blocked_external |
| Report→study linkage | 19,609 report candidates; 0 human study links | blocked_external |
| Human queue preservation/progression | normalizer preserves populated dedup/linkage files byte-for-byte; lineage changes fail without write; pending/partial/complete-candidate states validated; preservation 3/3 | pass_local |
| Registry screening/linkage | 207 undecided rows; 500 registry→PubMed candidate links; 0 human decisions | blocked_external |
| Approved final searches across planned sources | none | blocked_external |

ClinicalTrials.gov A1 has a known lexical risk: `vitamin K` also retrieves vitamin-K-antagonist studies. All 139 A1 registry retrievals are flagged for human review. These artifacts test complete-export, checksum, normalization, and queue generation. They are not final searches, included-study counts, PRISMA data, or human deduplication results.

CENTRAL displayed the platform message `Authenticate to get access to full CENTRAL content`. No first-page/top-N records were imported. Complete CENTRAL retrieval remains blocked by licensed authentication and final protocol/PRESS approval.

KoreaMed displayed all 62 A1 results after setting 100 per page (`1-62`). Native Download failed with a server temp-file permission error. The complete displayed KMID/title set was captured, 35 exact-title PubMed linkage candidates were queued, and all human linkage/eligibility fields remain blank. The four zero-hit queries require PRESS review and broader Korean/English synonym testing before any final-search interpretation.

KMbase/RISS short-query counts are deliberately excluded from retrieval totals. No identifiers were exported, split-query result sets overlap, KMbase zero recall remains unresolved, and no independent PRESS decision exists.

Human decisions are no longer required to remain blank for proxy validation. A completed duplicate decision requires decision, verifier and time; duplicate calls additionally require canonical record, cluster and reason. A completed study link requires study ID, linker and time. Neither complete-candidate state is treated as final until phase validation passes.
