import screening from "@/research/screening/pubmed_screening_agent_prereview_validation.json";
import fulltext from "@/research/synthesis/agent_fulltext_evidence_summary.json";
import structured from "@/research/synthesis/agent_structured_extraction_summary.json";
import numeric from "@/research/synthesis/agent_numeric_context_windows_summary.json";
import quality from "@/research/synthesis/agent_result_context_rob_summary.json";
import grade from "@/research/synthesis/agent_grade_prereview_summary.json";
import completion from "@/research/audit/research_completion_audit.json";

export const finalValidationBundles = [
  {
    id: "SCREENING-PREREVIEW",
    title: "제목·초록 사전선별",
    summary: "PubMed 고유 문헌 19,619건을 질문별 기준으로 보수적으로 분류했습니다.",
    detail: "초록이 없거나 판단이 불확실한 문헌은 자동 제외하지 않았습니다. 사람의 독립 이중선별 완료로 기록하지 않습니다.",
  },
  {
    id: "FULLTEXT-EXTRACTION",
    title: "원문 근거와 구조화 추출",
    summary: "공개 원문 35건에서 근거 문장 673개와 수치 후보 144개를 추출했습니다.",
    detail: "모든 수치 후보에 원문 문맥과 XML 위치를 연결했습니다. 효과추정치 확정이나 메타분석 자료로 바로 사용하지 않습니다.",
  },
  {
    id: "LINKAGE-NONPUBMED",
    title: "연결 후보와 비-PubMed 자료",
    summary: "등록자료·KoreaMed 연결 후보와 검색 접근 제약을 하나의 연구 계보로 보존했습니다.",
    detail: "후보 연결은 확정된 동일 연구 판정이 아니며, RISS·KMbase·구독 DB 미완료 상태도 그대로 남깁니다.",
  },
  {
    id: "ROB-GRADE-SYNTHESIS",
    title: "RoB·GRADE·서술 합성 권고안",
    summary: "35건의 설계별 RoB 신호와 다섯 질문의 GRADE 준비표·서술 합성 초안을 만들었습니다.",
    detail: "최종 RoB 판정, 확실성 등급, 임상 권고는 비워 두며 이번 승인은 AI 권고안의 작업 기준 채택만 의미합니다.",
  },
  {
    id: "ROLE-BOUNDARY",
    title: "승인의 범위와 연구자 역할",
    summary: "이번 승인은 한 명의 포털 검토자가 AI 권고 묶음을 연구 진행 기준으로 확인하는 사건입니다.",
    detail: "개별 문헌 판정 2만 건을 사람이 직접 수행했다거나 독립 검토자 2인이 완료했다는 의미가 아닙니다.",
  },
] as const;

export const finalValidationEvidence = {
  pubmed_records: screening.unique_records_verified,
  fulltext_articles: structured.articles,
  evidence_sentences: fulltext.evidence_sentences,
  numeric_candidates: numeric.candidates,
  numeric_context_complete: numeric.complete_after,
  rob_signal_rows: quality.rob_signal_rows,
  grade_questions: grade.questions,
  open_completion_gates: completion.open_gates,
  independent_reviewers_completed: 0,
  human_individual_decisions_recorded: 0,
  final_search_claim_allowed: false,
  research_complete: false,
};
