#!/usr/bin/env python3
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];REPORT=ROOT/"research/validation/ai_exploratory_local_smoke.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 errors=[];r=json.loads(REPORT.read_text(encoding="utf-8"));expected={"engine":"src/engine/run-ai-exploratory-engine.ts","bundle":"src/generated/ai-exploratory-bundle.json","route":"app/api/exploratory/query/route.ts"}
 if r.get("status")!="local_production_smoke_verified" or r.get("home_status")!=200 or r.get("api_status")!=200:errors.append("production HTTP status failed")
 if r.get("scope")!="ai_exploratory" or r.get("navigation_count")!=1 or r.get("question_ids")!=["A1"]:errors.append("production v2 routing failed")
 if r.get("clinical_action_count")!=0 or r.get("legacy_leakage") is not False or r.get("validated_scope_leakage") is not False:errors.append("production authority leakage")
 for key,rel in expected.items():
  if r.get("source_hashes",{}).get(key)!=sha(ROOT/rel):errors.append(f"stale smoke source: {key}")
 result={"errors":errors,"home_status":r.get("home_status"),"api_status":r.get("api_status"),"scope":r.get("scope"),"clinical_actions":r.get("clinical_action_count"),"status":"valid" if not errors else "invalid"};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
