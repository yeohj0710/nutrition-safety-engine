#!/usr/bin/env python3
import csv,hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/"research/fulltext/agent_core_fulltext/agent_numeric_context_windows.csv";SUMMARY=ROOT/"research/synthesis/agent_numeric_context_windows_summary.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 errors=[];d=json.loads(SUMMARY.read_text(encoding="utf-8"))
 with OUT.open(encoding="utf-8-sig",newline="") as f:rows=list(csv.DictReader(f))
 if len(rows)!=d["candidates"] or len({r["candidate_id"] for r in rows})!=len(rows):errors.append("candidate coverage mismatch")
 if sum(r["window_context_status"]=="context_window_complete_candidate" for r in rows)!=d["complete_after"]:errors.append("completion count mismatch")
 if any(not re.fullmatch(r"[0-9a-f]{64}",r["window_sha256"]) for r in rows):errors.append("invalid window hash")
 if any(r["context_window_authority"]!="agent_context_window_only" or r["human_verified"] or r["effect_estimate_usable"]!="false" for r in rows):errors.append("authority boundary crossed")
 for section in ("input","raw","output"):
  p=ROOT/d[section]["path"]
  if not p.is_file() or sha(p)!=d[section]["sha256"]:errors.append(f"lineage mismatch: {section}")
 if d["human_verified"] or d["effect_estimates_usable"]:errors.append("false completion claim")
 result={"status":"valid" if not errors else "invalid","candidates":len(rows),"complete_after":d["complete_after"],"errors":errors};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
