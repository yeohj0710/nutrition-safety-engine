#!/usr/bin/env python3
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/"research/synthesis/agent_synthesis_readiness.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 errors=[];d=json.loads(OUT.read_text(encoding="utf-8"))
 if set(d["questions"])!={"A1","A2","B1","B2","B3"}:errors.append("question coverage mismatch")
 for q,v in d["questions"].items():
  if v["human_synthesis_allowed"] or v["meta_analysis_allowed"] or v["grade_allowed"]:errors.append(f"authority crossed: {q}")
  if not v["open_gaps"]:errors.append(f"missing gap disclosure: {q}")
 if any(d[k] for k in ("human_included_studies","verified_effect_estimates","rob_completed","grade_completed","final_conclusions")):errors.append("false completion count")
 for path,expected in d["inputs"].items():
  p=ROOT/path
  if not p.is_file() or sha(p)!=expected:errors.append(f"input lineage mismatch: {path}")
 result={"status":"valid" if not errors else "invalid","questions":len(d["questions"]),"errors":errors};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
