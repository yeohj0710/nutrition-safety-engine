#!/usr/bin/env python3
"""Create article-level, agent-only structured extraction from PMC evidence sentences."""
from __future__ import annotations
import csv, gzip, hashlib, json, re
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/"research/fulltext/agent_core_fulltext"
ARTICLES=BASE/"articles.csv"; EVIDENCE=BASE/"agent_fulltext_evidence.csv"
CORE=ROOT/"research/systematic_review_v3/core_evidence.csv"
RAW=BASE/"pmc_core_batch.xml.gz"
OUT=BASE/"agent_structured_extraction.csv"
SUMMARY=ROOT/"research/synthesis/agent_structured_extraction_summary.json"
EXPOSURES={"A1":"vitamin K","A2":"omega-3 EPA/DHA","B1":"calcium","B2":"vitamin D","B3":"vitamin C"}
DESIGNS=[
 ("systematic_review",re.compile(r"systematic review|meta-analysis",re.I)),
 ("randomized_trial",re.compile(r"randomi[sz]ed|random allocation|placebo-controlled",re.I)),
 ("pharmacovigilance_database",re.compile(r"VigiBase|pharmacovigilance|disproportionality analysis",re.I)),
 ("retrospective_survey",re.compile(r"retrospective survey",re.I)),
 ("cohort",re.compile(r"cohort|prospective study|follow-up",re.I)),
 ("case_control",re.compile(r"case.control",re.I)),
 ("cross_sectional",re.compile(r"cross.section",re.I)),
 ("case_report_or_series",re.compile(r"case report|case series|we report (?:a|an) ",re.I)),
]
COMPARATOR=re.compile(r"placebo|control group|compared with|versus| vs\.? |comparison group",re.I)
RESULT_NUMBER=re.compile(r"(?:\b\d+(?:\.\d+)?\s*%|\b(?:RR|OR|HR)\s*[=:]?\s*\d+(?:\.\d+)?|\b95%\s*CI\b|\bp\s*[<=>]\s*0?\.\d+)",re.I)
def read(p):
 with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def compact(values,limit=4):
 seen=[]
 for value in values:
  value=value.strip()
  if value and value not in seen:seen.append(value)
 return " || ".join(seen[:limit])
def node_text(node):return " ".join("".join(node.itertext()).split())
def main():
 articles=read(ARTICLES); evidence=read(EVIDENCE); core=read(CORE)
 root=ET.fromstring(gzip.decompress(RAW.read_bytes()));full_body={}
 for node in root.findall(".//article") if root.tag!="article" else [root]:
  ids={x.get("pub-id-type",""):node_text(x) for x in node.findall(".//article-id")};pmcid=ids.get("pmcid") or ids.get("pmc") or ""
  if pmcid and not pmcid.startswith("PMC"):pmcid="PMC"+pmcid
  body=node.find("body")
  if body is not None:full_body[pmcid]=node_text(body)
 ev_by={}
 for row in evidence:ev_by.setdefault((row["record_id"],row["question_id"]),[]).append(row)
 core_by={(r["record_id"],r["question_id"]):r for r in core}; rows=[]
 for article in articles:
  if article["body_present"]!="true":continue
  key=(article["record_id"],article["question_id"]); ev=ev_by.get(key,[]); source=core_by.get(key)
  text=" ".join([article["title"],full_body.get(article["pmcid"],"")])
  design=next((name for name,pat in DESIGNS if pat.search(text)),"design_unclear")
  populations=[r["evidence_sentence"] for r in ev if r["matched_population_terms"]]
  doses=[r["dose_mentions"] for r in ev if r["dose_mentions"]]
  outcomes=[r["evidence_sentence"] for r in ev if r["matched_outcome_terms"]]
  comparators=[r["evidence_sentence"] for r in ev if COMPARATOR.search(r["evidence_sentence"])]
  numeric_results=[r["evidence_sentence"] for r in ev if r["matched_outcome_terms"] and RESULT_NUMBER.search(r["evidence_sentence"])]
  rows.append({"record_id":article["record_id"],"question_id":article["question_id"],"pmid":article["pmid"],"pmcid":article["pmcid"],
   "title":article["title"],"agent_study_design":design,"population_evidence":compact(populations),
   "intervention_or_exposure":source["supplement"] if source else EXPOSURES[article["question_id"]],"dose_mentions":compact(doses,8),"comparator_evidence":compact(comparators),
   "safety_outcome_evidence":compact(outcomes,6),"numeric_result_candidate_sentences":compact(numeric_results,6),
   "evidence_sentence_count":len(ev),"numeric_result_candidate_count":len(numeric_results),
   "source_body_sha256":article["body_text_sha256"],"evidence_table_sha256":sha(EVIDENCE),
   "extraction_authority":"agent_structured_extraction_only","human_verified":"","eligible_study":"",
   "rob_completed":"false","grade_completed":"false","effect_estimate_verified":"false"})
 rows.sort(key=lambda r:(r["question_id"],r["pmid"]))
 with OUT.open("w",encoding="utf-8-sig",newline="") as f:w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
 payload={"schema_version":"1.0.0","status":"agent_article_extraction_complete_human_verification_open","articles":len(rows),
  "by_question":dict(sorted(Counter(r["question_id"] for r in rows).items())),"study_designs":dict(sorted(Counter(r["agent_study_design"] for r in rows).items())),
  "articles_with_dose":sum(bool(r["dose_mentions"]) for r in rows),"articles_with_comparator_signal":sum(bool(r["comparator_evidence"]) for r in rows),
  "articles_with_numeric_result_candidates":sum(bool(r["numeric_result_candidate_sentences"]) for r in rows),
  "human_verified_articles":0,"eligible_studies":0,"verified_effect_estimates":0,"rob_completed":0,"grade_completed":0,
  "meta_analysis_allowed":False,"clinical_conclusion_allowed":False,
  "inputs":{p.relative_to(ROOT).as_posix():sha(p) for p in (ARTICLES,EVIDENCE,CORE,RAW)},"output":{"path":OUT.relative_to(ROOT).as_posix(),"sha256":sha(OUT)}}
 SUMMARY.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(payload,ensure_ascii=False,indent=2));return 0
if __name__=="__main__":raise SystemExit(main())
