#!/usr/bin/env python3
import csv,hashlib,json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'research/review_queue/registry_pubmed_link_agent_prereview.csv';SUMMARY=ROOT/'research/review_queue/registry_pubmed_link_agent_prereview_summary.json';REPORT=ROOT/'research/screening/registry_pubmed_link_agent_prereview_validation.json'
def read(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def main():
 e=[];r=read(OUT);s=json.loads(SUMMARY.read_text(encoding='utf-8'));src=read(ROOT/'data/interim/registry_link_review_context.csv')
 if len(r)!=500 or {x['link_candidate_id'] for x in r}!={x['link_candidate_id'] for x in src}:e.append('coverage mismatch')
 if Counter(x['reference_type'] for x in r)!=Counter({'BACKGROUND':327,'DERIVED':127,'RESULT':46}):e.append('reference type mismatch')
 if any(x['decision_authority']!='agent_prereview_only' or x['human_link_decision'] or x['verified_by'] or x['verified_at'] for x in r):e.append('human boundary crossed')
 if s['output_sha256']!=hashlib.sha256(OUT.read_bytes()).hexdigest() or s['human_link_decisions']!=0:e.append('summary mismatch')
 result={'schema_version':'1.0.0','status':'pass' if not e else 'fail','candidates_verified':len(r),'reference_types':dict(Counter(x['reference_type'] for x in r)),'human_link_claim_allowed':False,'errors':e};REPORT.parent.mkdir(parents=True,exist_ok=True);REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False));return bool(e)
if __name__=='__main__':raise SystemExit(main())
