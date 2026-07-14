#!/usr/bin/env python3
"""Validate agent-only research continuation lineage and authority boundaries."""
import csv, hashlib, json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research/review_queue/agent_fulltext_research_priority.csv"
SUMMARY = ROOT / "research/synthesis/agent_research_continuation_summary.json"

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    errors=[]
    with OUT.open(encoding="utf-8-sig", newline="") as f: rows=list(csv.DictReader(f))
    data=json.loads(SUMMARY.read_text(encoding="utf-8"))
    keys=[(r["record_id"],r["question_id"]) for r in rows]
    if len(keys)!=len(set(keys)): errors.append("duplicate record-question priorities")
    if len(rows)!=data["prioritized_candidates"]: errors.append("row count mismatch")
    if dict(sorted(Counter(r["priority_tier"] for r in rows).items()))!=data["priority_tiers"]: errors.append("tier count mismatch")
    if sha(OUT)!=data["output"]["sha256"]: errors.append("output checksum mismatch")
    if any(r["decision_authority"]!="agent_research_prioritization_only" or r["human_eligibility_decision"] for r in rows): errors.append("human authority crossed")
    if any(r["rob_completed"]!="false" or r["grade_completed"]!="false" or r["systematic_review_inclusion_claim"]!="false" for r in rows): errors.append("completion boundary crossed")
    for path, expected in data["inputs"].items():
        p=ROOT/path
        if not p.is_file() or sha(p)!=expected: errors.append(f"input lineage mismatch: {path}")
    if any(data[k] for k in ("human_title_abstract_decisions","human_fulltext_decisions","independent_reviewers_completed","rob_completed","grade_completed")): errors.append("false human completion count")
    if data["prisma_final_counts_allowed"] or data["clinical_conclusion_allowed"]: errors.append("prohibited final claim enabled")
    result={"status":"valid" if not errors else "invalid","rows":len(rows),"errors":errors}
    print(json.dumps(result,ensure_ascii=False,indent=2)); return 1 if errors else 0
if __name__=="__main__": raise SystemExit(main())
