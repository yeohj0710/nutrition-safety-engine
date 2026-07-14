#!/usr/bin/env python3
"""Summarize question-level synthesis readiness without making conclusions."""
import csv,hashlib,json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
EXTRACT=ROOT/"research/fulltext/agent_core_fulltext/agent_structured_extraction.csv"
PRIORITY=ROOT/"research/review_queue/agent_fulltext_research_priority.csv"
OUT=ROOT/"research/synthesis/agent_synthesis_readiness.json";MD=ROOT/"research/synthesis/agent_synthesis_readiness.md"
QUESTIONS={"A1":"비타민 K와 항응고제","A2":"오메가-3와 항응고제","B1":"칼슘과 신장결석","B2":"비타민 D와 신장결석","B3":"비타민 C와 신장결석"}
def read(p):
 with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 rows=read(EXTRACT);priority=read(PRIORITY);questions={}
 for q,label in QUESTIONS.items():
  subset=[r for r in rows if r["question_id"]==q]; pending=[r for r in priority if r["question_id"]==q]
  designs=Counter(r["agent_study_design"] for r in subset); numeric=sum(bool(r["numeric_result_candidate_sentences"]) for r in subset)
  gaps=[]
  if not subset:gaps.append("공개 PMC 본문 기반 구조화 추출 없음")
  if not numeric:gaps.append("수치 결과 후보 문장 없음")
  if not any(r["agent_study_design"] in {"randomized_trial","cohort","case_control","cross_sectional"} for r in subset):gaps.append("일차 비교 연구설계 후보 없음")
  if any(r["agent_study_design"]=="design_unclear" for r in subset):gaps.append("연구설계 불명확 문헌 확인 필요")
  gaps.extend(["사람의 원문 적격성 판정 없음","효과추정치 검증 없음","RoB 및 GRADE 미수행"])
  questions[q]={"label":label,"structured_articles":len(subset),"design_candidates":dict(sorted(designs.items())),
   "articles_with_numeric_result_candidates":numeric,"articles_with_dose":sum(bool(r["dose_mentions"]) for r in subset),
   "remaining_picos_priority_units":len(pending),"readiness":"agent_mapping_available_human_validation_required" if subset else "public_fulltext_evidence_gap",
   "open_gaps":gaps,"human_synthesis_allowed":False,"meta_analysis_allowed":False,"grade_allowed":False}
 payload={"schema_version":"1.0.0","status":"agent_synthesis_readiness_mapped_human_gates_open","questions":questions,
  "human_included_studies":0,"verified_effect_estimates":0,"rob_completed":0,"grade_completed":0,"final_conclusions":0,
  "inputs":{EXTRACT.relative_to(ROOT).as_posix():sha(EXTRACT),PRIORITY.relative_to(ROOT).as_posix():sha(PRIORITY)}}
 OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 lines=["# AI 연구 합성 준비도", "", "이 문서는 사람의 최종 포함 판정이나 임상 결론이 아니라 후속 연구 작업 지도입니다.", ""]
 for q,d in questions.items():
  lines += [f"## {q} · {d['label']}","",f"- 구조화 원문: {d['structured_articles']}건",f"- 수치 결과 후보 포함: {d['articles_with_numeric_result_candidates']}건",f"- 용량 정보 포함: {d['articles_with_dose']}건",f"- 남은 PICOS 우선순위 단위: {d['remaining_picos_priority_units']}건",f"- 상태: `{d['readiness']}`","","미해결:",""]+[f"- {x}" for x in d["open_gaps"]]+[""]
 MD.write_text("\n".join(lines),encoding="utf-8")
 print(json.dumps({q:{"articles":d["structured_articles"],"numeric":d["articles_with_numeric_result_candidates"],"readiness":d["readiness"]} for q,d in questions.items()},ensure_ascii=False,indent=2));return 0
if __name__=="__main__":raise SystemExit(main())
