#!/usr/bin/env python3
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];MAN=ROOT/"research/thesis/ai_exploratory_final_manifest.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 errors=[];m=json.loads(MAN.read_text(encoding="utf-8"));arts=m.get("artifacts",[])
 if m.get("status")!="complete_verified_ai_exploratory" or m.get("protocol_version")!="2.0-ai-exploratory":errors.append("final v2 status/version mismatch")
 if any(m.get(k) is not False for k in ("systematic_review_claim_allowed","clinical_recommendation_allowed","human_review_claim_allowed")):errors.append("final authority boundary mismatch")
 if m.get("v1_systematic_review_status")!="blocked_external_not_relabelled":errors.append("v1 historical status lost")
 if len(arts)!=23 or len({a["path"] for a in arts})!=23:errors.append("final artifact inventory mismatch")
 for a in arts:
  p=ROOT/a["path"]
  if not p.is_file() or p.stat().st_size!=a["size_bytes"] or sha(p)!=a["sha256"]:errors.append(f"final artifact mismatch: {a['path']}")
 head=m.get("implementation_head","");ancestor=subprocess.run(["git","merge-base","--is-ancestor",head,"HEAD"],cwd=ROOT).returncode==0
 if len(head)!=40 or not ancestor:errors.append("final implementation head is not an ancestor")
 s=m.get("summary",{})
 if s.get("record_question_units")!=20230 or s.get("synthetic_scenarios")!=120 or s.get("executions")!=360 or s.get("clinical_action_leakage")!=0 or s.get("legacy_leakage")!=0 or s.get("runtime_home_status")!=200 or s.get("runtime_api_status")!=200 or s.get("pdf_visual_pages_checked")!=6 or s.get("pdf_visual_defects_open")!=0:errors.append("final verified summary mismatch")
 result={"errors":errors,"status":"valid" if not errors else "invalid","artifacts":len(arts),"implementation_head":head,"head_is_ancestor":ancestor,"v2_complete":not errors,"v1_systematic_review_status":m.get("v1_systematic_review_status")};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
