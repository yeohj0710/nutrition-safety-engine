import summary from "@/research/review_queue/report_study_linkage_agent_prereview_summary.json";

export type StudyLinkageReviewBundle = {
  id: string;
  title: string;
  affected: string;
  finding: string;
  recommendation: string;
  safeguards: string[];
};

export const studyLinkageReviewBundles: StudyLinkageReviewBundle[] = [
  {
    id: "LINKAGE-MULTI-REPORT",
    title: "연결 신호가 있는 보고서 묶음",
    affected: `${summary.multi_report_components.toLocaleString("ko-KR")}개 후보 묶음 · ${summary.reports_in_multi_report_components.toLocaleString("ko-KR")}개 보고서`,
    finding: "동일한 단일 임상시험 등록번호 또는 승인된 중복 보고서 묶음이 확인됐습니다.",
    recommendation: "같은 연구에서 나온 복수 보고서 후보로 묶되, 원문과 등록정보를 확인하기 전에는 확정하지 않습니다.",
    safeguards: ["여러 등록번호를 나열한 문헌은 자동 연결에서 제외했습니다.", "중복 보고서와 동일 연구의 후속 보고서를 구분해 검수합니다.", "사람이 확인한 study_id는 아직 생성하지 않았습니다."],
  },
  {
    id: "LINKAGE-SINGLE-REPORT",
    title: "명시적 연결 신호가 없는 보고서",
    affected: `${Number(summary.components_by_report_count["1"]).toLocaleString("ko-KR")}개 보고서`,
    finding: "다른 보고서와 연결할 수 있는 단일 등록번호나 승인된 중복 묶음이 발견되지 않았습니다.",
    recommendation: "우선 단일 보고서 연구 후보로 두고, 저자·기관·모집기간·표본을 사람이 확인합니다.",
    safeguards: ["연결 신호가 없다는 사실은 독립 연구라는 확정이 아닙니다.", "원문 확인에서 같은 연구가 발견되면 묶음을 수정합니다.", "합성 전 모든 유지 후보의 study linkage를 별도로 검증합니다."],
  },
  {
    id: "LINKAGE-ROLE-BOUNDARY",
    title: "검토 범위와 기록 원칙",
    affected: `${summary.unique_reports.toLocaleString("ko-KR")}개 진행 후보 전체`,
    finding: "이번 자료는 AI 사전분류에서 사람 선별로 진행하도록 권고된 보고서만 다룹니다.",
    recommendation: "연결 우선순위 자료로만 사용하고, 개별 적격성 판정·사람 study linkage·합성 수치는 별도로 기록합니다.",
    safeguards: ["진행 후보를 사람의 최종 포함 문헌으로 표현하지 않습니다.", "승인 이벤트와 독립 검토자 수를 구분합니다.", "사람 검토 전 PRISMA 최종 수치와 합성을 만들지 않습니다."],
  },
];

export const studyLinkageTotals = summary;
