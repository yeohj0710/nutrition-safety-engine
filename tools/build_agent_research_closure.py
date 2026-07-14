#!/usr/bin/env python3
"""Freeze the approved agent-assisted workstream without relabelling it as a completed systematic review."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"research/thesis/agent_research_closure_manifest.json";REPORT=ROOT/"research/thesis/agent_research_closure_report.md"
FILES=[
 "research/approvals/final_agent_research_recommendations_approval.json",
 "research/screening/pubmed_screening_agent_prereview_validation.json",
 "research/fulltext/agent_core_fulltext/manifest.json",
 "research/fulltext/agent_core_fulltext/articles.csv",
 "research/fulltext/agent_core_fulltext/agent_fulltext_evidence.csv",
 "research/fulltext/agent_core_fulltext/agent_structured_extraction.csv",
 "research/fulltext/agent_core_fulltext/agent_numeric_result_candidates.csv",
 "research/fulltext/agent_core_fulltext/agent_numeric_context_windows.csv",
 "research/fulltext/agent_core_fulltext/agent_rob_signal_map.csv",
 "research/synthesis/agent_synthesis_readiness.json",
 "research/synthesis/agent_grade_prereview.csv",
 "research/synthesis/agent_descriptive_synthesis.md",
 "research/audit/research_completion_audit.json",
 "research/review_queue/human_handoff_manifest.json",
 "research/review_queue/external_review_handoff.xlsx",
]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 approval=json.loads((ROOT/FILES[0]).read_text(encoding="utf-8"));audit=json.loads((ROOT/"research/audit/research_completion_audit.json").read_text(encoding="utf-8"));head=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
 entries=[{"path":rel,"size_bytes":(ROOT/rel).stat().st_size,"sha256":sha(ROOT/rel)} for rel in FILES]
 payload={"schema_version":"1.0.0","study_id":"nutrition-safety-engine-agent-assisted-research-2026",
  "status":"agent_assisted_workstream_closed_single_reviewer_portal_validation",
  "closed_at":"2026-07-14","implementation_head_before_closure_commit":head,
  "agent_assisted_workstream_complete":True,"systematic_review_complete":False,"research_complete_claim_allowed":False,
  "approval_decision":approval["decision"],"approval_identity_status":approval["identity_status"],"portal_validation_events":1,
  "human_individual_decisions_recorded":0,"independent_reviewers_completed":0,"final_search_claim_allowed":False,
  "verified_scope":{"pubmed_unique_records":19619,"fulltext_articles_captured":46,"fulltext_articles_with_body":35,"evidence_sentences":673,"numeric_candidates":144,"numeric_candidates_with_context":144,"rob_signal_rows":35,"grade_preparation_questions":5},
  "open_systematic_review_gates":audit["open_gates"],"closure_interpretation":"The approved AI recommendations are frozen as the completed agent-assisted work product. External human and access-dependent systematic-review requirements remain unfulfilled and are not relabelled as complete.",
  "artifacts":entries}
 OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 REPORT.write_text("""# AI 보조 연구 작업 종료 보고서

## 종료 상태

2026-07-14 포털에서 AI 권고안 다섯 묶음이 한 번의 검토 이벤트로 승인되었습니다. 이에 따라 Codex가 수행한 검색 정리, 사전선별, 공개 원문 확보, 구조화 추출, 수치 문맥 연결, RoB 신호 지도, GRADE 준비표와 서술 합성 초안을 동결합니다.

## 검증된 작업 범위

- PubMed 고유 레코드 19,619건
- PMC 레코드 46건 회수, 본문 35건
- 원문 근거 문장 673개
- 수치 결과 후보 144개, 문맥 연결 144개
- RoB 신호 지도 35건
- GRADE 준비표 5개 질문

## 해석 제한

이번 종료는 AI 보조 연구 작업물의 종료입니다. 승인자의 신원은 수집되지 않았고, 개별 문헌의 사람 판정과 독립 검토자 2인의 이중선별은 수행되지 않았습니다. RISS·KMbase·구독 데이터베이스 최종 검색, 사람의 원문 판정·추출 검증·RoB·GRADE, 전문가 검토와 사용성 연구도 완료로 표시하지 않습니다. 따라서 완결된 체계적 문헌고찰 또는 최종 임상 권고로 주장할 수 없습니다.
""",encoding="utf-8")
 print(json.dumps({"status":payload["status"],"artifacts":len(entries),"open_systematic_review_gates":audit["open_gates"]},ensure_ascii=False));return 0
if __name__=="__main__":raise SystemExit(main())
