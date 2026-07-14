#!/usr/bin/env python3
import csv,hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/"research/fulltext/agent_core_fulltext"
OUT=BASE/"agent_numeric_result_candidates.csv";SUMMARY=ROOT/"research/synthesis/agent_numeric_result_candidates_summary.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 errors=[];data=json.loads(SUMMARY.read_text(encoding="utf-8"))
 with OUT.open(encoding="utf-8-sig",newline="") as f:rows=list(csv.DictReader(f))
 if len(rows)!=data["candidates"]:errors.append("candidate count mismatch")
 if len({r["candidate_id"] for r in rows})!=len(rows):errors.append("duplicate candidate id")
 if sha(OUT)!=data["output"]["sha256"]:errors.append("output checksum mismatch")
 source=ROOT/data["input"]["path"]
 if sha(source)!=data["input"]["sha256"]:errors.append("input lineage mismatch")
 if any(not re.fullmatch(r"[0-9a-f]{64}",r["source_sentence_sha256"]) for r in rows):errors.append("invalid source hash")
 if any(r["extraction_authority"]!="agent_numeric_candidate_only" or r["human_verified"] or r["effect_estimate_usable"]!="false" or r["meta_analysis_usable"]!="false" for r in rows):errors.append("authority boundary crossed")
 if data["human_verified_candidates"] or data["usable_effect_estimates"] or data["meta_analysis_allowed"] or data["clinical_conclusion_allowed"]:errors.append("false completion claim")
 result={"status":"valid" if not errors else "invalid","candidates":len(rows),"errors":errors};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
