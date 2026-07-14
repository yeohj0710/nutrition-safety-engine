#!/usr/bin/env python3
"""Build question-level GRADE preparation rows without certainty judgments."""
import csv,hashlib,json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/"research/fulltext/agent_core_fulltext"
STRUCT=BASE/"agent_structured_extraction.csv";CONTEXT=BASE/"agent_numeric_result_context.csv";ROB=BASE/"agent_rob_signal_map.csv"
OUT=ROOT/"research/synthesis/agent_grade_prereview.csv";NARR=ROOT/"research/synthesis/agent_descriptive_synthesis.md";SUMMARY=ROOT/"research/synthesis/agent_grade_prereview_summary.json"
LABEL={"A1":"비타민 K–항응고제 안전성","A2":"오메가-3–항응고제 출혈 안전성","B1":"칼슘–신장결석 안전성","B2":"비타민 D–신장결석 안전성","B3":"비타민 C–신장결석·옥살산 안전성"}
def read(p):
 with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 studies=read(STRUCT);contexts=read(CONTEXT);robs=read(ROB);rows=[];lines=["# AI 서술 합성 초안","","이 문서는 확보된 공개 원문의 분포와 검증 대기 상태를 기술하며 임상 결론이나 GRADE 판정이 아닙니다.",""]
 for q,label in LABEL.items():
  s=[r for r in studies if r["question_id"]==q];c=[r for r in contexts if r["question_id"]==q];r=[x for x in robs if x["question_id"]==q]
  designs=Counter(x["agent_study_design"] for x in s);complete=sum(x["context_completeness"]=="candidate_context_present" for x in c)
  not_observed=sum(v=="signal_not_observed_in_extracted_sentences" for x in r for k,v in x.items() if k.endswith("_signal"))
  rows.append({"question_id":q,"outcome_domain":label,"public_fulltext_articles":len(s),"design_candidates":"|".join(f"{k}:{v}" for k,v in sorted(designs.items())),
   "numeric_candidates":len(c),"context_complete_numeric_candidates":complete,"context_incomplete_numeric_candidates":len(c)-complete,
   "rob_signal_rows":len(r),"rob_domains_not_observed_in_extracted_sentences":not_observed,
   "inconsistency_assessment":"not_assessed_human_synthesis_required","indirectness_assessment":"not_assessed_human_eligibility_required",
   "imprecision_assessment":"not_assessed_verified_effects_required","publication_bias_assessment":"not_assessed_complete_search_required",
   "starting_certainty":"","downgrade_decisions":"","upgrade_decisions":"","final_certainty":"","grade_authority":"agent_preparation_only","human_verified":"false"})
  lines += [f"## {q} · {label}","",f"공개 본문 구조화 문헌은 {len(s)}건이며 설계 후보 분포는 {', '.join(f'{k} {v}건' for k,v in sorted(designs.items())) or '없음'}입니다. 수치 결과 후보 {len(c)}개 중 맥락이 함께 관찰된 후보는 {complete}개입니다.","",f"남은 핵심 검증은 맥락 불완전 후보 {len(c)-complete}개, 사람의 적격성 판정, 효과추정치 확인, RoB 도메인 판정, 검색 완결성 확인입니다.",""]
 with OUT.open("w",encoding="utf-8-sig",newline="") as f:w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
 NARR.write_text("\n".join(lines),encoding="utf-8")
 payload={"schema_version":"1.0.0","status":"agent_grade_preparation_complete_human_grade_open","questions":5,"public_fulltext_articles":len(studies),
  "numeric_candidates":len(contexts),"human_grade_judgments":0,"final_certainty_ratings":0,"clinical_recommendations":0,
  "inputs":{p.relative_to(ROOT).as_posix():sha(p) for p in (STRUCT,CONTEXT,ROB)},"outputs":{OUT.relative_to(ROOT).as_posix():sha(OUT),NARR.relative_to(ROOT).as_posix():sha(NARR)}}
 SUMMARY.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");print(json.dumps(payload,ensure_ascii=False,indent=2));return 0
if __name__=="__main__":raise SystemExit(main())
