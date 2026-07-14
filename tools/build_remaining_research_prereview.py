#!/usr/bin/env python3
import csv,hashlib,json,re
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];KC=ROOT/'data/interim/koreamed_screening_context.csv';KL=ROOT/'data/interim/koreamed_pubmed_link_candidates.csv';OUT1=ROOT/'research/review_queue/koreamed_screening_agent_prereview.csv';OUT2=ROOT/'research/review_queue/koreamed_pubmed_link_agent_prereview.csv';SUMMARY=ROOT/'research/review_queue/remaining_research_agent_prereview_summary.json'
def read(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def write(p,rows):
 p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 sr=[]
 for r in read(KC):
  text=r['title'].lower();signals=[x for x in ('warfarin','vitamin k','bleed','hemorrhage','inr','coagulation') if x in text]
  sr.append({'record_id':r['record_id'],'kmid':r['kmid'],'question_id':r['question_id'],'title':r['title'],'agent_recommendation':'uncertain_manual_review','recommendation_reason':'초록과 완전한 원문 정보가 없어 제목만으로 포함·제외할 수 없습니다.','matched_title_signals':'|'.join(signals),'uncertainty_flags':'abstract_unavailable|native_export_server_error|not_final_search','koreamed_url':r['koreamed_url'],'decision_authority':'agent_prereview_only','human_decision':''})
 lr=[]
 for r in read(KL):lr.append({'koreamed_record_id':r['koreamed_record_id'],'kmid':r['kmid'],'pubmed_record_id':r['pubmed_record_id'],'pmid':r['pmid'],'match_basis':r['match_basis'],'agent_recommendation':'strong_exact_title_link_needs_validation','recommendation_reason':'정규화 제목이 정확히 일치하지만 식별자·저자·연도를 사람이 확인해야 합니다.','decision_authority':'agent_prereview_only','human_link_decision':'','verified_by':'','verified_at':''})
 write(OUT1,sr);write(OUT2,lr)
 summary={'schema_version':'1.0.0','status':'remaining_agent_prereview_complete_external_actions_open','koreamed_records':len(sr),'koreamed_recommendations':dict(Counter(r['agent_recommendation'] for r in sr)),'koreamed_pubmed_link_candidates':len(lr),'koreamed_link_recommendations':dict(Counter(r['agent_recommendation'] for r in lr)),'search_gaps':{'riss':'20 approved split queries require final rerun and native export; overlapping hit counts are not summable','kmbase':'20 zero-hit queries remain invalid as absence evidence; operator semantics and known-item recall require repair before rerun','licensed_databases':'Embase and Scopus or Web of Science exports remain unavailable without authenticated institutional access'},'human_koreamed_decisions':0,'human_koreamed_link_decisions':0,'independent_reviewers_completed':0,'final_search_claim_allowed':False,'inputs':{'koreamed_context_sha256':sha(KC),'koreamed_links_sha256':sha(KL)},'outputs':{'koreamed_prereview_sha256':sha(OUT1),'koreamed_link_prereview_sha256':sha(OUT2)}};SUMMARY.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,ensure_ascii=False));return 0
if __name__=='__main__':raise SystemExit(main())
