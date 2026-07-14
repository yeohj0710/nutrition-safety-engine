#!/usr/bin/env python3
import csv, hashlib, json, random
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'research/review_queue/registry_screening_agent_prereview.csv';SUMMARY=ROOT/'research/review_queue/registry_screening_agent_prereview_summary.json';REPORT=ROOT/'research/screening/registry_screening_agent_prereview_validation.json'
def read(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 errors=[];rows=read(OUT);source=read(ROOT/'data/interim/clinicaltrials_screening_context.csv');summary=json.loads(SUMMARY.read_text(encoding='utf-8'))
 if len(rows)!=207 or {r['retrieval_id'] for r in rows}!={r['retrieval_id'] for r in source}:errors.append('registry prereview coverage mismatch')
 if Counter(r['question_id'] for r in rows)!=Counter({'A1':139,'A2':23,'B1':23,'B2':14,'B3':8}):errors.append('question counts mismatch')
 allowed={'advance_to_human_registry_screening','uncertain_manual_review','likely_exclude_needs_validation'}
 if any(r['agent_recommendation'] not in allowed for r in rows):errors.append('unknown recommendation')
 if any(r['decision_authority']!='agent_prereview_only' or r['human_decision'] for r in rows):errors.append('human decision boundary crossed')
 risk=[r for r in rows if 'known_query_lexical_risk' in r['uncertainty_flags']]
 if len(risk)!=139:errors.append('A1 lexical-risk coverage mismatch')
 if summary['output_sha256']!=sha(OUT) or summary['human_registry_decisions']!=0 or summary['final_registry_screening_claim_allowed'] is not False:errors.append('summary boundary mismatch')
 rng=random.Random(20260714);samples={label:[{'nct_id':r['nct_id'],'question_id':r['question_id'],'recommendation':r['agent_recommendation']} for r in rng.sample(group,min(15,len(group)))] for label,group in [('advance',[r for r in rows if r['agent_recommendation'].startswith('advance')]),('uncertain',[r for r in rows if r['agent_recommendation'].startswith('uncertain')]),('likely_exclude',[r for r in rows if r['agent_recommendation'].startswith('likely')])]}
 result={'schema_version':'1.0.0','status':'pass' if not errors else 'fail','records_verified':len(rows),'recommendation_counts':dict(Counter(r['agent_recommendation'] for r in rows)),'a1_lexical_risk_rows_verified':len(risk),'samples':samples,'human_screening_claim_allowed':False,'errors':errors};REPORT.parent.mkdir(parents=True,exist_ok=True);REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:result[k] for k in ('status','records_verified','recommendation_counts','a1_lexical_risk_rows_verified','errors')},ensure_ascii=False));return bool(errors)
if __name__=='__main__':raise SystemExit(main())
