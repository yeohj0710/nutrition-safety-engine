#!/usr/bin/env python3
"""Extract unverified numeric result tokens from full-text outcome sentences."""
import csv,hashlib,json,re
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/"research/fulltext/agent_core_fulltext"
EVIDENCE=BASE/"agent_fulltext_evidence.csv";OUT=BASE/"agent_numeric_result_candidates.csv"
SUMMARY=ROOT/"research/synthesis/agent_numeric_result_candidates_summary.json"
PATTERNS=[
 ("relative_risk",re.compile(r"\b(?:RR|relative risk)\s*[=:]?\s*(\d+(?:\.\d+)?)",re.I)),
 ("odds_ratio",re.compile(r"\b(?:OR|odds ratio)\s*[=:]?\s*(\d+(?:\.\d+)?)",re.I)),
 ("hazard_ratio",re.compile(r"\b(?:HR|hazard ratio)\s*[=:]?\s*(\d+(?:\.\d+)?)",re.I)),
 ("percentage",re.compile(r"(?<!\d)(\d+(?:\.\d+)?)\s*%")),
 ("p_value",re.compile(r"\bp\s*([<=>])\s*(0?\.\d+)",re.I)),
]
CI=re.compile(r"(?:95\s*%\s*)?(?:CI|confidence interval)\s*[:=]?\s*[\[(]?\s*(-?\d+(?:\.\d+)?)\s*(?:to|[-–,])\s*(-?\d+(?:\.\d+)?)",re.I)
COMPARISON=re.compile(r"placebo|control|compared|versus|\bvs\.?\b|higher|lower|increase|decrease|difference",re.I)
def read(p):
 with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 rows=[]
 for e in read(EVIDENCE):
  if not e["matched_outcome_terms"]:continue
  sentence=e["evidence_sentence"]; ci=CI.search(sentence)
  for measure,pattern in PATTERNS:
   for pos,m in enumerate(pattern.finditer(sentence),1):
    value=m.group(1) if measure!="p_value" else m.group(2);operator=m.group(1) if measure=="p_value" else ""
    rows.append({"candidate_id":f"NUM-{e['pmcid']}-{e['paragraph_position']}-{e['sentence_position']}-{measure}-{pos}",
      "record_id":e["record_id"],"question_id":e["question_id"],"pmid":e["pmid"],"pmcid":e["pmcid"],"xml_locator":e["xml_locator"],
      "measure_type":measure,"observed_value":value,"operator":operator,"ci_lower":ci.group(1) if ci else "","ci_upper":ci.group(2) if ci else "",
      "comparison_signal":str(bool(COMPARISON.search(sentence))).lower(),"outcome_terms":e["matched_outcome_terms"],
      "source_sentence":sentence,"source_sentence_sha256":e["sentence_sha256"],"extraction_authority":"agent_numeric_candidate_only",
      "human_verified":"","effect_estimate_usable":"false","meta_analysis_usable":"false"})
 rows.sort(key=lambda r:(r["question_id"],r["pmid"],r["xml_locator"],r["candidate_id"]))
 fields=["candidate_id","record_id","question_id","pmid","pmcid","xml_locator","measure_type","observed_value","operator","ci_lower","ci_upper","comparison_signal","outcome_terms","source_sentence","source_sentence_sha256","extraction_authority","human_verified","effect_estimate_usable","meta_analysis_usable"]
 with OUT.open("w",encoding="utf-8-sig",newline="") as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
 payload={"schema_version":"1.0.0","status":"agent_numeric_candidates_extracted_human_verification_open","candidates":len(rows),
  "articles":len({r["record_id"] for r in rows}),"by_question":dict(sorted(Counter(r["question_id"] for r in rows).items())),
  "measure_types":dict(sorted(Counter(r["measure_type"] for r in rows).items())),"with_ci_signal":sum(bool(r["ci_lower"]) for r in rows),
  "with_comparison_signal":sum(r["comparison_signal"]=="true" for r in rows),"human_verified_candidates":0,"usable_effect_estimates":0,
  "meta_analysis_allowed":False,"clinical_conclusion_allowed":False,"input":{"path":EVIDENCE.relative_to(ROOT).as_posix(),"sha256":sha(EVIDENCE)},
  "output":{"path":OUT.relative_to(ROOT).as_posix(),"sha256":sha(OUT)}}
 SUMMARY.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");print(json.dumps(payload,ensure_ascii=False,indent=2));return 0
if __name__=="__main__":raise SystemExit(main())
