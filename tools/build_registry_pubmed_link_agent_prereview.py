#!/usr/bin/env python3
import csv,hashlib,json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'data/interim/registry_link_review_context.csv';OUT=ROOT/'research/review_queue/registry_pubmed_link_agent_prereview.csv';SUMMARY=ROOT/'research/review_queue/registry_pubmed_link_agent_prereview_summary.json'
def read(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 rows=[]
 for r in read(SOURCE):
  rt=r['reference_type']
  if rt=='RESULT':rec='strong_link_candidate_needs_validation';reason='등록자료의 결과 참고문헌으로 명시되어 해당 임상시험 보고서일 가능성이 높습니다.'
  elif rt=='DERIVED':rec='probable_link_candidate_needs_validation';reason='등록자료의 파생 참고문헌이지만 결과 보고서·후속 분석·도구 논문을 사람이 구분해야 합니다.'
  else:rec='likely_background_not_study_report_needs_validation';reason='배경 참고문헌으로 분류되어 해당 등록시험 보고서가 아닐 가능성이 높지만 사람이 확인해야 합니다.'
  rows.append({'link_candidate_id':r['link_candidate_id'],'nct_id':r['nct_id'],'registry_record_id':r['registry_record_id'],'pmid':r['pmid'],'pubmed_record_id':r['pubmed_record_id'],'reference_type':rt,'registry_question_ids':r['registry_question_ids'],'registry_title':r['brief_title'],'pubmed_title':r['pubmed_title'],'pubmed_doi':r['pubmed_doi'],'agent_recommendation':rec,'recommendation_reason':reason,'pubmed_in_search_corpus':r['pubmed_in_search_corpus'],'source_context_sha256':hashlib.sha256(json.dumps(r,sort_keys=True).encode()).hexdigest(),'decision_authority':'agent_prereview_only','human_link_decision':'','verified_by':'','verified_at':''})
 OUT.parent.mkdir(parents=True,exist_ok=True)
 with OUT.open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
 s={'schema_version':'1.0.0','status':'agent_registry_pubmed_link_prereview_complete_human_decisions_open','authority':'agent_prereview_only','candidates':len(rows),'reference_types':dict(Counter(r['reference_type'] for r in rows)),'recommendations':dict(Counter(r['agent_recommendation'] for r in rows)),'human_link_decisions':0,'independent_reviewers_completed':0,'registry_study_links_claim_allowed':False,'input_sha256':sha(SOURCE),'output_sha256':sha(OUT)};SUMMARY.write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(s,ensure_ascii=False));return 0
if __name__=='__main__':raise SystemExit(main())
