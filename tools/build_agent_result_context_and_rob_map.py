#!/usr/bin/env python3
"""Map numeric candidates to context signals and create an agent-only RoB signal map."""
import csv,hashlib,json,re
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/"research/fulltext/agent_core_fulltext"
NUM=BASE/"agent_numeric_result_candidates.csv";STRUCT=BASE/"agent_structured_extraction.csv";EVID=BASE/"agent_fulltext_evidence.csv"
CONTEXT=BASE/"agent_numeric_result_context.csv";ROB=BASE/"agent_rob_signal_map.csv";SUMMARY=ROOT/"research/synthesis/agent_result_context_rob_summary.json"
GROUP=re.compile(r"(?:placebo|control|intervention|treatment|exposure|supplement(?:ation)?|intake|diet|dose|group|patients? (?:with|receiving|taking)|participants? (?:with|receiving|taking))",re.I)
TIME=re.compile(r"(?:\b\d+(?:\.\d+)?\s*(?:hour|day|week|month|year)s?\b|baseline|follow[- ]?up|annually|daily|previous months?)",re.I)
OUTCOME_LABEL=re.compile(r"(?:bleeding|hemorrhage|INR|coagulation|thrombosis|kidney stones?|renal stones?|nephrolithiasis|urolithiasis|hypercalciuria|hypercalcemia|oxalate nephropathy|hyperoxaluria|urinary (?:calcium|oxalate))",re.I)
DOMAINS={
 "randomization_signal":re.compile(r"randomi[sz]|allocation conceal|random sequence",re.I),
 "blinding_signal":re.compile(r"double.blind|single.blind|masked|blinding",re.I),
 "attrition_signal":re.compile(r"lost to follow|withdraw|dropout|attrition|complete follow",re.I),
 "confounding_signal":re.compile(r"adjusted for|multivariable|confound|propensity|matching",re.I),
 "outcome_measurement_signal":re.compile(r"assay|measured|measurement|validated|laboratory|medical record|questionnaire",re.I),
 "selective_reporting_signal":re.compile(r"protocol|prespecified|pre-specified|registered|registration",re.I),
}
def read(p):
 with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def values(pattern,text):return "|".join(dict.fromkeys(m.group(0) for m in pattern.finditer(text)))
def main():
 nums=read(NUM);structured=read(STRUCT);evidence=read(EVID);articles={(r["record_id"],r["question_id"]):r for r in structured}
 context=[]
 for n in nums:
  sent=n["source_sentence"];article=articles[(n["record_id"],n["question_id"])]
  context.append({"candidate_id":n["candidate_id"],"record_id":n["record_id"],"question_id":n["question_id"],"pmid":n["pmid"],"pmcid":n["pmcid"],
   "study_design_candidate":article["agent_study_design"],"group_or_exposure_signals":values(GROUP,sent),"timepoint_signals":values(TIME,sent),
   "outcome_definition_signals":values(OUTCOME_LABEL,sent),"comparison_signal":n["comparison_signal"],"measure_type":n["measure_type"],
   "observed_value":n["observed_value"],"operator":n["operator"],"ci_lower":n["ci_lower"],"ci_upper":n["ci_upper"],
   "xml_locator":n["xml_locator"],"source_sentence":sent,"source_sentence_sha256":n["source_sentence_sha256"],
   "context_completeness":"candidate_context_present" if values(GROUP,sent) and values(OUTCOME_LABEL,sent) else "context_incomplete_manual_review",
   "extraction_authority":"agent_result_context_only","human_verified":"","effect_estimate_usable":"false"})
 with CONTEXT.open("w",encoding="utf-8-sig",newline="") as f:w=csv.DictWriter(f,fieldnames=list(context[0]));w.writeheader();w.writerows(context)
 ev_by={}
 for e in evidence:ev_by.setdefault((e["record_id"],e["question_id"]),[]).append(e["evidence_sentence"])
 rob=[]
 for article in structured:
  text=" ".join(ev_by.get((article["record_id"],article["question_id"]),[]));design=article["agent_study_design"]
  signals={name:("signal_observed" if pat.search(text) else "signal_not_observed_in_extracted_sentences") for name,pat in DOMAINS.items()}
  if design not in {"randomized_trial"}:signals["randomization_signal"]="not_applicable_or_design_unconfirmed";signals["blinding_signal"]="not_applicable_or_design_unconfirmed"
  rob.append({"record_id":article["record_id"],"question_id":article["question_id"],"pmid":article["pmid"],"pmcid":article["pmcid"],"study_design_candidate":design,**signals,
   "rob_tool_candidate":"RoB 2" if design=="randomized_trial" else "ROBINS-I" if design in {"cohort","case_control","cross_sectional","pharmacovigilance_database"} else "JBI analytical cross-sectional checklist" if design=="retrospective_survey" else "JBI case report/series checklist" if design=="case_report_or_series" else "AMSTAR 2" if design=="systematic_review" else "design_confirmation_required",
   "rob_authority":"agent_signal_map_only","human_domain_judgment":"","overall_rob_judgment":"","rob_completed":"false"})
 with ROB.open("w",encoding="utf-8-sig",newline="") as f:w=csv.DictWriter(f,fieldnames=list(rob[0]));w.writeheader();w.writerows(rob)
 payload={"schema_version":"1.0.0","status":"agent_result_context_and_rob_signals_complete_human_judgment_open","numeric_context_rows":len(context),
  "context_complete_candidates":sum(r["context_completeness"]=="candidate_context_present" for r in context),"context_incomplete_candidates":sum(r["context_completeness"]!="candidate_context_present" for r in context),
  "rob_signal_rows":len(rob),"rob_tool_candidates":dict(sorted(Counter(r["rob_tool_candidate"] for r in rob).items())),
  "human_verified_effect_estimates":0,"human_rob_domain_judgments":0,"completed_rob_assessments":0,"meta_analysis_allowed":False,"grade_allowed":False,
  "inputs":{p.relative_to(ROOT).as_posix():sha(p) for p in (NUM,STRUCT,EVID)},"outputs":{CONTEXT.relative_to(ROOT).as_posix():sha(CONTEXT),ROB.relative_to(ROOT).as_posix():sha(ROB)}}
 SUMMARY.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");print(json.dumps(payload,ensure_ascii=False,indent=2));return 0
if __name__=="__main__":raise SystemExit(main())
