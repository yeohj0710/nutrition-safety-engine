#!/usr/bin/env python3
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];MAN=ROOT/"research/thesis/agent_research_closure_manifest.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 errors=[];d=json.loads(MAN.read_text(encoding="utf-8"));approval=json.loads((ROOT/"research/approvals/final_agent_research_recommendations_approval.json").read_text(encoding="utf-8"))
 if not d["agent_assisted_workstream_complete"]:errors.append("agent workstream not closed")
 if d["systematic_review_complete"] or d["research_complete_claim_allowed"]:errors.append("systematic review falsely completed")
 if d["human_individual_decisions_recorded"] or d["independent_reviewers_completed"] or d["final_search_claim_allowed"]:errors.append("human authority boundary crossed")
 if approval["research_complete"] or approval["independent_reviewers_completed"]:errors.append("approval boundary mismatch")
 if d["open_systematic_review_gates"]<=0:errors.append("open external gates lost")
 for item in d["artifacts"]:
  p=ROOT/item["path"]
  if not p.is_file() or p.stat().st_size!=item["size_bytes"] or sha(p)!=item["sha256"]:errors.append(f"artifact mismatch: {item['path']}")
 result={"status":"valid" if not errors else "invalid","artifacts":len(d["artifacts"]),"agent_assisted_workstream_complete":d["agent_assisted_workstream_complete"],"systematic_review_complete":d["systematic_review_complete"],"errors":errors};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
