#!/usr/bin/env python3
"""Build conservative ClinicalTrials.gov structured-record agent prereview."""

import csv, hashlib, json, re
from collections import Counter, defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'data/interim/clinicaltrials_screening_context.csv'
QUEUE=ROOT/'data/interim/clinicaltrials_review_queue.csv'
OUTPUT=ROOT/'research/review_queue/registry_screening_agent_prereview.csv'
SUMMARY=ROOT/'research/review_queue/registry_screening_agent_prereview_summary.json'
RULES={
 'A1':{'population':['warfarin','acenocoumarol','phenprocoumon'],'exposure':['vitamin k1','phytonadione','phylloquinone','vitamin k supplement'],'outcome':['inr','coagulation','bleeding','thrombosis']},
 'A2':{'population':['anticoagulant','warfarin','apixaban','rivaroxaban','edoxaban','dabigatran','aspirin'],'exposure':['omega 3','omega-3','fish oil','eicosapentaenoic','docosahexaenoic','icosapent','epa','dha'],'outcome':['bleeding','hemorrhage','coagulation','safety']},
 'B1':{'population':[],'exposure':['calcium supplement','calcium carbonate','calcium citrate','calcium supplementation'],'outcome':['kidney stone','renal stone','kidney calculi','urolithiasis','nephrolithiasis','hypercalciuria']},
 'B2':{'population':[],'exposure':['vitamin d','cholecalciferol','ergocalciferol','calcifediol'],'outcome':['kidney stone','renal stone','kidney calculi','urolithiasis','nephrolithiasis','hypercalciuria','hypercalcemia']},
 'B3':{'population':[],'exposure':['vitamin c','ascorbic acid','ascorbate'],'outcome':['kidney stone','renal stone','kidney calculi','urolithiasis','nephrolithiasis','hyperoxaluria','oxalate']},
}
def read(path):
 with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def sha(path):
 h=hashlib.sha256();h.update(path.read_bytes());return h.hexdigest()
def norm(text):return re.sub(r'[^a-z0-9]+',' ',text.lower()).strip()
def hits(terms,text):
 p=f' {norm(text)} ';return [t for t in terms if f' {norm(t)} ' in p]
def main():
 source=read(SOURCE); queue={r['retrieval_id']:r for r in read(QUEUE)}; rows=[]
 for r in source:
  text=' '.join(r[k] for k in ('brief_title','official_title','conditions','interventions'))
  pop=hits(RULES[r['question_id']]['population'],text);ex=hits(RULES[r['question_id']]['exposure'],text);out=hits(RULES[r['question_id']]['outcome'],text);flags=[]
  if r['known_query_risk']:flags.append('known_query_lexical_risk')
  if r['overall_status'] in {'WITHDRAWN','TERMINATED','SUSPENDED'}:flags.append('inactive_or_stopped')
  if r['question_id']=='A1' and r['known_query_risk'] and not ex:
   rec='likely_exclude_needs_validation';reason='비타민 K 길항제가 보충제 비타민 K로 검색된 어휘 위험입니다. 사람 검토 전에는 제외로 확정하지 않습니다.'
  elif ex and out and (pop or r['question_id'].startswith('B')):
   rec='advance_to_human_registry_screening';reason='질문별 노출과 안전성 결과 관련 구조화 신호가 함께 확인됩니다.'
  elif ex or out:
   rec='uncertain_manual_review';reason='노출 또는 결과 신호 일부만 확인되어 등록 원문 검토가 필요합니다.'
  else:
   rec='likely_exclude_needs_validation';reason='질문별 노출·결과 구조화 신호가 없지만 사람 검토 전에는 제외로 확정하지 않습니다.'
  rows.append({'retrieval_id':r['retrieval_id'],'record_id':r['record_id'],'question_id':r['question_id'],'nct_id':r['nct_id'],'brief_title':r['brief_title'],'overall_status':r['overall_status'],'agent_recommendation':rec,'recommendation_reason':reason,'matched_population_terms':'|'.join(pop),'matched_exposure_terms':'|'.join(ex),'matched_outcome_terms':'|'.join(out),'uncertainty_flags':'|'.join(flags),'registry_url':r['registry_url'],'source_context_sha256':hashlib.sha256(json.dumps(r,sort_keys=True).encode()).hexdigest(),'decision_authority':'agent_prereview_only','human_decision':''})
 OUTPUT.parent.mkdir(parents=True,exist_ok=True)
 with OUTPUT.open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
 byq={q:{'records':sum(x['question_id']==q for x in rows),'recommendations':dict(Counter(x['agent_recommendation'] for x in rows if x['question_id']==q))} for q in RULES}
 summary={'schema_version':'1.0.0','status':'agent_registry_prereview_complete_human_decisions_open','authority':'agent_prereview_only','records':len(rows),'questions':byq,'human_registry_decisions':0,'independent_reviewers_completed':0,'final_registry_screening_claim_allowed':False,'inputs':{'context_sha256':sha(SOURCE),'queue_sha256':sha(QUEUE)},'output_sha256':sha(OUTPUT)}
 SUMMARY.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,ensure_ascii=False));return 0
if __name__=='__main__':raise SystemExit(main())
