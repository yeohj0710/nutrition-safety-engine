#!/usr/bin/env python3
import csv,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/"research/fulltext/agent_core_fulltext";SUMMARY=ROOT/"research/synthesis/agent_result_context_rob_summary.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):
 with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def main():
 errors=[];d=json.loads(SUMMARY.read_text(encoding="utf-8"));context=read(BASE/"agent_numeric_result_context.csv");rob=read(BASE/"agent_rob_signal_map.csv")
 if len(context)!=d["numeric_context_rows"] or len({r["candidate_id"] for r in context})!=len(context):errors.append("numeric context coverage mismatch")
 if len(rob)!=d["rob_signal_rows"] or len({(r["record_id"],r["question_id"]) for r in rob})!=len(rob):errors.append("RoB signal coverage mismatch")
 if any(r["extraction_authority"]!="agent_result_context_only" or r["human_verified"] or r["effect_estimate_usable"]!="false" for r in context):errors.append("numeric authority crossed")
 if any(r["rob_authority"]!="agent_signal_map_only" or r["human_domain_judgment"] or r["overall_rob_judgment"] or r["rob_completed"]!="false" for r in rob):errors.append("RoB authority crossed")
 for path,expected in {**d["inputs"],**d["outputs"]}.items():
  p=ROOT/path
  if not p.is_file() or sha(p)!=expected:errors.append(f"lineage mismatch: {path}")
 if d["human_verified_effect_estimates"] or d["human_rob_domain_judgments"] or d["completed_rob_assessments"] or d["meta_analysis_allowed"] or d["grade_allowed"]:errors.append("false completion claim")
 result={"status":"valid" if not errors else "invalid","numeric_context_rows":len(context),"rob_signal_rows":len(rob),"errors":errors};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
