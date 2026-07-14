#!/usr/bin/env python3
"""Build an evidence-backed audit of all known research completion gates."""
import csv,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/"research/audit/research_completion_audit.json";MD=ROOT/"research/audit/research_completion_audit.md"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def exists(path):return (ROOT/path).is_file()
def gate(gid,name,status,evidence,remaining,authority):return {"gate_id":gid,"name":name,"status":status,"evidence":evidence,"remaining_requirement":remaining,"required_authority":authority}
def main():
 gates=[
 gate("G01","PubMed final retrieval","agent_work_complete_human_search_claim_open",["research/searches/phase03_lineage_validation.json"],"Final-search claim awaits completion of all planned sources.","research_team"),
 gate("G02","RISS final rerun","external_action_open",["research/review_queue/remaining_research_agent_prereview_summary.json"],"Run 20 approved split queries and preserve native exports without summing overlaps.","authenticated_database_operator"),
 gate("G03","KMbase search repair","external_action_open",["research/review_queue/remaining_research_agent_prereview_summary.json"],"Repair operator semantics, verify known-item recall, and rerun 20 queries.","database_searcher"),
 gate("G04","Licensed database exports","external_access_open",["research/review_queue/remaining_research_agent_prereview_summary.json"],"Obtain Embase and Scopus or Web of Science exports.","institutional_account_holder"),
 gate("G05","Title/abstract screening","agent_prereview_complete_human_decisions_open",["research/review_queue/pubmed_screening_agent_prereview.csv"],"Two genuinely independent reviewers must screen and adjudicate eligible records.","independent_human_reviewers"),
 gate("G06","Report-to-study linkage","agent_prereview_complete_human_links_open",["research/review_queue/report_study_linkage_agent_prereview.csv"],"Validate report clusters for records retained after human screening.","human_reviewers"),
 gate("G07","Registry screening and linkage","agent_prereview_complete_human_decisions_open",["research/review_queue/registry_screening_agent_prereview.csv","research/review_queue/registry_pubmed_link_agent_prereview.csv"],"Validate 207 registry records and 500 PubMed-link candidates.","human_reviewers"),
 gate("G08","KoreaMed screening and linkage","agent_prereview_complete_human_decisions_open",["research/review_queue/koreamed_screening_agent_prereview.csv","research/review_queue/koreamed_pubmed_link_agent_prereview.csv"],"Validate 62 title-only records and 35 exact-title link candidates.","human_reviewers"),
 gate("G09","Full-text screening","agent_partial_fulltext_research_human_eligibility_open",["research/fulltext/agent_core_fulltext/articles.csv","research/fulltext/agent_core_fulltext/agent_structured_extraction.csv"],"Obtain all eligible full texts and record one primary exclusion reason per excluded report.","independent_human_reviewers"),
 gate("G10","Data extraction","agent_partial_extraction_human_verification_open",["research/fulltext/agent_core_fulltext/agent_numeric_context_windows.csv"],"Double-check study characteristics and effect estimates for included studies.","independent_human_extractors"),
 gate("G11","Risk of bias","agent_signal_map_complete_human_judgment_open",["research/fulltext/agent_core_fulltext/agent_rob_signal_map.csv"],"Complete design-appropriate domain judgments with support.","trained_human_assessors"),
 gate("G12","GRADE","agent_preparation_complete_human_judgment_open",["research/synthesis/agent_grade_prereview.csv"],"Rate certainty for each critical outcome after verified synthesis.","grade_review_team"),
 gate("G13","Quantitative or narrative synthesis","agent_descriptive_draft_human_gates_open",["research/synthesis/agent_descriptive_synthesis.md"],"Synthesize only verified included studies; pool only when clinically and statistically appropriate.","research_team"),
 gate("G14","Expert content review","external_review_open",["research/design/20260710/TASK_BOARD.csv"],"Qualified experts must assess scope, accuracy, and wording.","external_domain_experts"),
 gate("G15","Usability evaluation","external_study_open",["research/design/20260710/TASK_BOARD.csv"],"Conduct the planned usability study with real participants.","human_participants_and_research_team"),
 gate("G16","Independent scenario gold and engine evaluation","external_human_gold_open",["research/design/20260710/TASK_BOARD.csv"],"Two independent authors plus adjudication must create the gold set before final metrics.","independent_human_authors"),
 gate("G17","Final freeze, thesis, and manifest","downstream_gates_open",["research/design/20260710/TASK_BOARD.csv"],"Freeze verified data, regenerate thesis/figures/FINAL_MANIFEST, and audit all cross-artifact numbers.","research_team"),
 ]
 missing=[path for g in gates for path in g["evidence"] if not exists(path)]
 payload={"schema_version":"1.0.0","status":"research_incomplete_external_and_human_gates_open","gate_count":len(gates),"completed_gates":sum(g["status"]=="complete" for g in gates),"open_gates":sum(g["status"]!="complete" for g in gates),"missing_evidence_files":missing,"research_complete":False,"gates":gates,"artifact_sha256":{p:sha(ROOT/p) for g in gates for p in g["evidence"] if exists(p)}}
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 lines=["# 연구 종료 조건 감사","",f"현재 결론: 연구 미완료. 열린 종료 게이트 {payload['open_gates']}개.","","AI 사전검토와 실제 사람·외부 수행을 구분했습니다.",""]
 for g in gates:lines += [f"## {g['gate_id']} · {g['name']}","",f"- 상태: `{g['status']}`",f"- 남은 조건: {g['remaining_requirement']}",f"- 필요한 수행 주체: `{g['required_authority']}`",""]
 MD.write_text("\n".join(lines),encoding="utf-8");print(json.dumps({"gates":len(gates),"open":payload["open_gates"],"missing_evidence_files":missing},ensure_ascii=False,indent=2));return 1 if missing else 0
if __name__=="__main__":raise SystemExit(main())
