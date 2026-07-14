import summary from "@/research/review_queue/pubmed_screening_agent_prereview_summary.json";

export type ScreeningPrereviewBundle = {
  id: string;
  questionId: "A1" | "A2" | "B1" | "B2" | "B3";
  title: string;
  scope: string;
  counts: { advance: number; uncertain: number; likelyExclude: number; abstractMissing: number };
  recommendation: string;
  safeguards: string[];
};

const titles = {
  A1: "와파린과 비타민 K",
  A2: "항응고제와 오메가-3",
  B1: "칼슘 보충제와 요로결석",
  B2: "비타민 D와 요로결석",
  B3: "비타민 C와 요로결석",
} as const;

export const screeningPrereviewBundles: ScreeningPrereviewBundle[] = (Object.keys(titles) as Array<keyof typeof titles>).map((questionId) => {
  const item = summary.questions[questionId];
  return {
    id: `PUBMED-PREREVIEW-${questionId}`,
    questionId,
    title: titles[questionId],
    scope: `${item.record_question_units.toLocaleString("ko-KR")}건을 질문별 규칙으로 사전검토했습니다.`,
    counts: {
      advance: item.recommendations.advance_to_human_screening,
      uncertain: item.recommendations.uncertain_manual_review,
      likelyExclude: item.recommendations.likely_exclude_needs_validation,
      abstractMissing: item.abstract_missing,
    },
    recommendation: "이 분류를 사람 선별의 우선순위 자료로 사용하고, 개별 포함·제외 결정은 별도로 남깁니다.",
    safeguards: [
      `초록 없는 ${item.abstract_missing.toLocaleString("ko-KR")}건은 모두 직접 확인 대상으로 남겼습니다.`,
      "제외 가능성 표시는 최종 제외가 아니며 사람 검토가 필요합니다.",
      "이번 승인은 독립 검토자 2인의 개별 선별 완료를 뜻하지 않습니다.",
    ],
  };
});

export const prereviewTotals = {
  uniqueRecords: summary.unique_records,
  recordQuestionUnits: summary.record_question_units,
  humanScreeningDecisions: summary.human_screening_decisions,
  independentReviewersCompleted: summary.independent_reviewers_completed,
};
