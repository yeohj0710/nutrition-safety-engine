#!/usr/bin/env python3
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];REPORT=ROOT/"research/validation/ai_exploratory_performance.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 errors=[];subprocess.run(["npx","tsx","scripts/evaluate-ai-exploratory-scenarios.ts"],cwd=ROOT,check=True,shell=True,capture_output=True);r=json.loads(REPORT.read_text(encoding="utf-8"))
 if r.get("status")!="synthetic_technical_validation_not_independent_gold" or r.get("clinical_performance_claim_allowed") is not False or r.get("independent_gold_scenarios")!=0:errors.append("synthetic/gold boundary mismatch")
 for field in ("deterministic_scenarios","correct_exact_route_scenarios","provenance_complete_scenarios"):
  if r.get(field)!=120:errors.append(f"{field} incomplete")
 for field in ("clinical_action_leakage_scenarios","legacy_leakage_scenarios","negative_false_routes"):
  if r.get(field)!=0:errors.append(f"{field} nonzero")
 expected={"runner":"scripts/evaluate-ai-exploratory-scenarios.ts","engine":"src/engine/run-ai-exploratory-engine.ts","bundle":"src/generated/ai-exploratory-bundle.json","inputs":"research/validation/synthetic_scenario_inputs.jsonl"}
 for key,rel in expected.items():
  if r.get("source_hashes",{}).get(key)!=sha(ROOT/rel):errors.append(f"scenario source hash mismatch: {key}")
 if len(r.get("scenarios",[]))!=120 or len({x["scenario_id"] for x in r["scenarios"]})!=120:errors.append("scenario identity mismatch")
 result={"errors":errors,"scenarios":r.get("scenario_count"),"executions":r.get("executions"),"deterministic":r.get("deterministic_scenarios"),"correct_exact_routes":r.get("correct_exact_route_scenarios"),"clinical_leakage":r.get("clinical_action_leakage_scenarios"),"legacy_leakage":r.get("legacy_leakage_scenarios"),"negative_false_routes":r.get("negative_false_routes"),"status":"valid" if not errors else "invalid"};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
