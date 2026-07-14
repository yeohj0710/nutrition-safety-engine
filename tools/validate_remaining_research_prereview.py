#!/usr/bin/env python3
import csv,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];REPORT=ROOT/'research/screening/remaining_research_agent_prereview_validation.json'
def read(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def main():
 s=read(ROOT/'research/review_queue/koreamed_screening_agent_prereview.csv');l=read(ROOT/'research/review_queue/koreamed_pubmed_link_agent_prereview.csv');e=[]
 if len(s)!=62 or any(r['agent_recommendation']!='uncertain_manual_review' or r['human_decision'] for r in s):e.append('KoreaMed safeguard mismatch')
 if len(l)!=35 or any(r['match_basis']!='exact_normalized_title' or r['human_link_decision'] for r in l):e.append('KoreaMed link boundary mismatch')
 result={'schema_version':'1.0.0','status':'pass' if not e else 'fail','koreamed_records_verified':len(s),'koreamed_links_verified':len(l),'human_completion_claim_allowed':False,'errors':e};REPORT.parent.mkdir(parents=True,exist_ok=True);REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False));return bool(e)
if __name__=='__main__':raise SystemExit(main())
