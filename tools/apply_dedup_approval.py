#!/usr/bin/env python3
"""Apply the approved agent prereview to the canonical first-review decision queue."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRE = json.loads((ROOT / "research/review_queue/dedup_agent_prereview.json").read_text(encoding="utf-8"))
APP = json.loads((ROOT / "research/approvals/dedup_review_approval.json").read_text(encoding="utf-8"))
if APP["bundles_approved"] != 2 or APP["candidate_pairs_reviewed"] != len(PRE["candidates"]):
    raise ValueError("approval scope mismatch")

parent = {}
def find(x):
    parent.setdefault(x, x)
    if parent[x] != x: parent[x] = find(parent[x])
    return parent[x]
def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb: parent[max(ra, rb)] = min(ra, rb)

for item in PRE["candidates"]:
    if item["recommended_decision"] == "merge_duplicate_reports":
        union(item["record_id_a"], item["record_id_b"])

groups = {}
for node in parent:
    groups.setdefault(find(node), []).append(node)
cluster_ids = {root: f"DCL-{index:04d}" for index, root in enumerate(sorted(groups), 1)}
rows = []
for item in PRE["candidates"]:
    duplicate = item["recommended_decision"] == "merge_duplicate_reports"
    root = find(item["record_id_a"]) if duplicate else ""
    rows.append({
        "candidate_id": item["candidate_id"],
        "decision": "duplicate" if duplicate else "not_duplicate",
        "canonical_record_id": min(groups[root], key=lambda x: int(x.rsplit("-", 1)[1])) if duplicate else "",
        "duplicate_cluster_id": cluster_ids[root] if duplicate else "",
        "duplicate_reason": item["recommendation_reason"] if duplicate else item["recommendation_reason"],
        "verified_by": "portal_reviewer_identity_not_captured",
        "verified_at": "2026-07-13",
        "status": "complete_candidate_requires_validation",
    })
path = ROOT / "data/interim/deduplication_decisions.csv"
with path.open("w", encoding="utf-8-sig", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
    writer.writeheader(); writer.writerows(rows)
print(json.dumps({"decisions": len(rows), "duplicate": sum(r["decision"] == "duplicate" for r in rows), "not_duplicate": sum(r["decision"] == "not_duplicate" for r in rows), "clusters": len(groups)}))
