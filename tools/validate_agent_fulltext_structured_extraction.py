#!/usr/bin/env python3
import csv,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/"research/fulltext/agent_core_fulltext"
OUT=BASE/"agent_structured_extraction.csv";SUMMARY=ROOT/"research/synthesis/agent_structured_extraction_summary.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 errors=[];data=json.loads(SUMMARY.read_text(encoding="utf-8"))
 with OUT.open(encoding="utf-8-sig",newline="") as f:rows=list(csv.DictReader(f))
 if len(rows)!=data["articles"]:errors.append("article count mismatch")
 if len({(r["record_id"],r["question_id"]) for r in rows})!=len(rows):errors.append("duplicate article-question extraction")
 if sha(OUT)!=data["output"]["sha256"]:errors.append("output checksum mismatch")
 if any(r["extraction_authority"]!="agent_structured_extraction_only" or r["human_verified"] or r["eligible_study"] for r in rows):errors.append("human authority crossed")
 if any(r["rob_completed"]!="false" or r["grade_completed"]!="false" or r["effect_estimate_verified"]!="false" for r in rows):errors.append("completion boundary crossed")
 for path,expected in data["inputs"].items():
  p=ROOT/path
  if not p.is_file() or sha(p)!=expected:errors.append(f"input lineage mismatch: {path}")
 if any(data[k] for k in ("human_verified_articles","eligible_studies","verified_effect_estimates","rob_completed","grade_completed")):errors.append("false completion count")
 if data["meta_analysis_allowed"] or data["clinical_conclusion_allowed"]:errors.append("prohibited conclusion enabled")
 result={"status":"valid" if not errors else "invalid","articles":len(rows),"errors":errors};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
