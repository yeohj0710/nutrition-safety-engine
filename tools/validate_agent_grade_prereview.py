#!/usr/bin/env python3
import csv,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/"research/synthesis/agent_grade_prereview.csv";SUMMARY=ROOT/"research/synthesis/agent_grade_prereview_summary.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 errors=[];d=json.loads(SUMMARY.read_text(encoding="utf-8"))
 with OUT.open(encoding="utf-8-sig",newline="") as f:rows=list(csv.DictReader(f))
 if len(rows)!=5 or {r["question_id"] for r in rows}!={"A1","A2","B1","B2","B3"}:errors.append("question coverage mismatch")
 if any(r["grade_authority"]!="agent_preparation_only" or r["human_verified"]!="false" for r in rows):errors.append("authority boundary crossed")
 if any(r[k] for r in rows for k in ("starting_certainty","downgrade_decisions","upgrade_decisions","final_certainty")):errors.append("GRADE judgment populated")
 for path,expected in {**d["inputs"],**d["outputs"]}.items():
  p=ROOT/path
  if not p.is_file() or sha(p)!=expected:errors.append(f"lineage mismatch: {path}")
 if d["human_grade_judgments"] or d["final_certainty_ratings"] or d["clinical_recommendations"]:errors.append("false completion claim")
 result={"status":"valid" if not errors else "invalid","questions":len(rows),"errors":errors};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
