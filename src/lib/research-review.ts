export type ReviewTask = {
  id: string;
  stage: string;
  title: string;
  reviewerRole: string;
  artifact: string;
  summary: string;
  checks: string[];
  decisions: { value: string; label: string }[];
  requiresIndependentReviewers?: number;
  blocks: string;
};

export const reviewTasks: ReviewTask[] = [
  {
    id: "RQ-001",
    stage: "연구계획",
    title: "연구계획서와 5개 질문 확정",
    reviewerRole: "지도 담당자",
    artifact: "research/design/20260710/01_PROTOCOL/research_protocol_v1.md",
    summary: "최종 검색을 시작하기 전에 연구 범위와 질문을 동결하는 단계입니다.",
    checks: ["연구 목적과 5개 질문이 일치함", "검색·선별·추출 절차가 재현 가능함", "변경이 필요한 문구를 의견란에 기록함"],
    decisions: [
      { value: "approve", label: "승인" },
      { value: "approve_with_amendment", label: "수정 후 승인" },
      { value: "reject", label: "반려" },
    ],
    blocks: "최종 검색과 이후 연구 단계",
  },
  {
    id: "RQ-002",
    stage: "연구 행정",
    title: "논문 유형 표기 확인",
    reviewerRole: "지도 담당자",
    artifact: "research/design/20260710/00_AUDIT/reference_inputs/연구계획서_여형준_260618_서명본.pdf",
    summary: "서명본의 ‘종설논문’ 표기와 현재 연구 설계를 어떻게 정리할지 결정합니다.",
    checks: ["서명본 표기를 확인함", "현재 연구 설계와 불일치 여부를 확인함", "행정 수정 필요 여부를 결정함"],
    decisions: [
      { value: "retain_as_historical", label: "기존 표기 유지" },
      { value: "administrative_correction_required", label: "행정 수정 필요" },
    ],
    blocks: "연구계획서 방법과 논문 표지 표기",
  },
  {
    id: "RQ-003",
    stage: "근거 범위",
    title: "기존 규칙 110건의 사용 범위 확인",
    reviewerRole: "임상·연구 검토자",
    artifact: "research/audit/rule_scope_report.csv",
    summary: "기존 규칙은 후보 자료로만 두고, 검증 없이 최종 근거로 승격하지 않는다는 원칙을 확인합니다.",
    checks: ["110개 행의 질문 분류를 확인함", "기존 규칙이 최종 근거가 아님을 확인함", "재검토가 필요한 행 번호를 의견란에 기록함"],
    decisions: [
      { value: "confirm", label: "원칙 승인" },
      { value: "return_specific_rows", label: "일부 행 재검토" },
    ],
    blocks: "최종 규칙 작성",
  },
  {
    id: "RQ-004",
    stage: "독립 평가",
    title: "시나리오 정답 독립 검토자 지정",
    reviewerRole: "연구 책임자",
    artifact: "research/design/20260710/06_VALIDATION/gold_set_blinding.md",
    summary: "엔진 결과를 보지 않은 검토자 2명과 불일치 조정 담당자를 지정합니다.",
    checks: ["독립 검토자 2명의 역할을 기록함", "조정 담당자를 기록함", "엔진 결과를 가린 상태에서 검토하기로 확인함"],
    decisions: [
      { value: "name_reviewers", label: "담당자 지정 완료" },
      { value: "revise_validation_design", label: "평가 설계 수정" },
    ],
    requiresIndependentReviewers: 2,
    blocks: "시나리오 성능 평가",
  },
  {
    id: "RQ-005",
    stage: "전문가 평가",
    title: "전문가 내용 검토 방식 확정",
    reviewerRole: "연구 책임자",
    artifact: "research/design/20260710/06_VALIDATION/expert_review_form.csv",
    summary: "전문가 수와 자격 기준을 확정하고, 인원이 부족하면 ‘내용 타당도’ 대신 ‘형성적 검토’로 보고합니다.",
    checks: ["전문가 자격 기준을 확인함", "참여 인원과 역할을 기록함", "보고에 사용할 정확한 평가 명칭을 확인함"],
    decisions: [
      { value: "three_or_more", label: "전문가 3명 이상" },
      { value: "formative_fewer", label: "소수 형성적 검토" },
      { value: "omit", label: "평가 제외" },
    ],
    blocks: "전문가 평가와 논문 표현",
  },
  {
    id: "RQ-006",
    stage: "연구윤리",
    title: "사용성 평가 시행 가능 여부 확인",
    reviewerRole: "기관 담당자",
    artifact: "research/design/20260710/06_VALIDATION/usability_plan.md",
    summary: "사람을 모집하기 전에 IRB 승인 또는 비대상·면제 판단 문서를 확인합니다.",
    checks: ["판단 문서의 식별번호를 확인함", "결정일을 확인함", "허용된 모집·수집 범위를 확인함"],
    decisions: [
      { value: "approved", label: "승인됨" },
      { value: "exempt_or_nonhuman", label: "비대상·면제" },
      { value: "do_not_collect", label: "자료 수집 안 함" },
    ],
    blocks: "전문가·사용자 모집과 사용성 자료 수집",
  },
  {
    id: "RV-101",
    stage: "문헌 선별",
    title: "원문 선별 절차와 판정 기준 승인",
    reviewerRole: "선별 검토자",
    artifact: "research/design/20260710/03_SCREENING/screening_manual.md",
    summary: "AI 분류는 참고자료로만 사용하고, 포함·제외 판정과 제외 사유는 사람이 기록하도록 확정합니다.",
    checks: ["포함·제외 기준을 읽고 확인함", "AI 단독 제외를 허용하지 않음을 확인함", "평가자 2명과 불일치 조정 방식을 기록함"],
    decisions: [
      { value: "approve", label: "절차 승인" },
      { value: "approve_with_amendment", label: "수정 후 승인" },
      { value: "reject", label: "반려" },
    ],
    requiresIndependentReviewers: 2,
    blocks: "문헌별 원문 이중 선별",
  },
  {
    id: "RV-102",
    stage: "자료 추출",
    title: "이중 추출 항목과 조정 절차 승인",
    reviewerRole: "자료 추출 검토자",
    artifact: "research/design/20260710/04_EXTRACTION/human_extraction_workflow.md",
    summary: "용량·대상·결과·안전성 수치와 원문 위치를 두 사람이 확인하는 절차입니다.",
    checks: ["필수 추출 필드를 확인함", "원문 위치와 수치 대조 방법을 확인함", "불일치 조정 담당자와 기록 방식을 확인함"],
    decisions: [
      { value: "approve", label: "절차 승인" },
      { value: "approve_with_amendment", label: "수정 후 승인" },
      { value: "reject", label: "반려" },
    ],
    requiresIndependentReviewers: 2,
    blocks: "문헌별 이중 자료 추출",
  },
  {
    id: "RV-103",
    stage: "비뚤림 평가",
    title: "RoB 평가 도구와 판정 원칙 승인",
    reviewerRole: "방법론 검토자",
    artifact: "research/design/20260710/04_EXTRACTION/risk_of_bias_template.csv",
    summary: "연구 설계에 맞는 비뚤림 위험 영역과 판단 근거 기록 방식을 확인합니다.",
    checks: ["연구 설계별 평가 영역을 확인함", "각 판정에 원문 근거를 남기도록 확인함", "전체 판단 규칙과 불일치 조정 방식을 확인함"],
    decisions: [
      { value: "approve", label: "도구 승인" },
      { value: "approve_with_amendment", label: "수정 후 승인" },
      { value: "reject", label: "반려" },
    ],
    requiresIndependentReviewers: 2,
    blocks: "문헌별 RoB 평가",
  },
  {
    id: "RV-104",
    stage: "근거 수준",
    title: "GRADE 평가 항목과 하향·상향 기준 승인",
    reviewerRole: "방법론 검토자",
    artifact: "research/design/20260710/05_SYNTHESIS/certainty_assessment_template.csv",
    summary: "결과별 근거 수준을 결정할 때 사용할 비뚤림·비일관성·비직접성·비정밀성·출판편향 기준을 확인합니다.",
    checks: ["GRADE 5개 하향 영역을 확인함", "상향 요인과 시작 수준을 확인함", "결과별 판단 근거와 최종 등급 기록 방식을 확인함"],
    decisions: [
      { value: "approve", label: "기준 승인" },
      { value: "approve_with_amendment", label: "수정 후 승인" },
      { value: "reject", label: "반려" },
    ],
    requiresIndependentReviewers: 2,
    blocks: "결과별 GRADE 평가",
  },
];

export const professorApprovalBundles: ReviewTask[] = [
  {
    id: "PA-01",
    stage: "1단계",
    title: "연구 범위와 진행 원칙",
    reviewerRole: "지도 담당자",
    artifact: "research/design/20260710/01_PROTOCOL/research_protocol_v1.md",
    summary: "연구 질문 5개, 기존 자료의 사용 범위, 최종 검색·선별·추출 원칙을 한 묶음으로 정리했습니다.",
    checks: ["5개 연구 질문을 현재 범위로 확정", "기존 규칙 110건은 후보 자료로만 사용", "최종 근거는 사람 검토를 거친 자료만 사용"],
    decisions: [{ value: "approve", label: "승인" }, { value: "approve_with_amendment", label: "수정 후 승인" }],
    blocks: "최종 검색과 연구 진행",
  },
  {
    id: "PA-02",
    stage: "2단계",
    title: "문헌 검토와 근거 평가 절차",
    reviewerRole: "지도 담당자",
    artifact: "research/design/20260710/04_EXTRACTION/human_extraction_workflow.md",
    summary: "원문 선별, 자료 추출, RoB, GRADE에 필요한 양식과 판정 기준을 준비했습니다. 실제 문헌별 판정은 별도 담당자 화면에서 기록합니다.",
    checks: ["AI 결과는 검토 보조로만 사용", "독립 검토자 2명의 판정을 분리 기록", "불일치는 조정 기록을 남긴 뒤 확정"],
    decisions: [{ value: "approve", label: "승인" }, { value: "approve_with_amendment", label: "수정 후 승인" }],
    blocks: "문헌별 이중 선별·추출·RoB·GRADE",
  },
  {
    id: "PA-03",
    stage: "3단계",
    title: "전문가 평가와 사용성 연구 조건",
    reviewerRole: "지도 담당자",
    artifact: "research/design/20260710/06_VALIDATION/validation_protocol.md",
    summary: "전문가 검토, 시나리오 정답 검증, 사용성 평가의 시행 조건과 보고 범위를 정리했습니다.",
    checks: ["전문가 수가 부족하면 형성적 검토로 보고", "시나리오 정답은 엔진 결과를 가린 뒤 작성", "IRB·비대상·면제 판단 전에는 참여자 자료를 수집하지 않음"],
    decisions: [{ value: "approve", label: "승인" }, { value: "approve_with_amendment", label: "수정 후 승인" }],
    blocks: "검증 계획 확정과 기관 판단 요청",
  },
];
