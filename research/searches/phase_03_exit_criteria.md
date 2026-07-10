# Phase 03 gate status

Date: 2026-07-10  
Phase status: `blocked_external`  
Proxy pipeline status: `complete_verified`

| Criterion | Proxy evidence | Final-gate status |
|---|---|---|
| Total hits and export counts reconcile | five PubMed pilots, 19,961/19,961 | pass_proxy_only |
| No top-N truncation | A1 split into 14 publication-date partitions; all unique IDs equal reported hits | pass_proxy_only |
| Raw hashes | 123 payload/metadata files checksum-verified; manifest generated | pass_proxy_only |
| Sentinel recall | 9/9 | pass_proxy_only |
| Normalized records | 19,961 retrieval instances; 19,609 unique PMIDs | pass_proxy_only |
| Duplicate candidate generation | 342 exact DOI/title pairs | pass_proxy_only |
| Human duplicate decisions | 0/342 | blocked_external |
| Report→study linkage | 19,609 report candidates; 0 human study links | blocked_external |
| Approved final searches across planned sources | none | blocked_external |

These artifacts test complete-export, checksum, normalization, and queue generation. They are not final searches, included-study counts, PRISMA data, or human deduplication results.
