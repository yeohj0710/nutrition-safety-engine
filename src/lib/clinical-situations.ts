// 연구가 다루는 임상 상황 다섯과 개인화 축 다섯을 한곳에 둔다.
// 값은 research/systematic_review_v40/personalized_rules.json 의 question_id 및
// personalization_axis 와 정확히 일치해야 한다. 사이트가 규칙 파일에 없는 조합을
// 만들어내면 근거 없는 화면이 나오므로, 실제 존재 여부는 런타임에서 다시 확인한다.

export const situationIds = [
  "HRS1_PERIOPERATIVE",
  "HRS2_KIDNEY_DISEASE",
  "HRS3_PREGNANCY",
  "HRS4_LIVER_DISEASE",
  "HRS5_ANTICOAGULATION",
] as const;

export type SituationId = (typeof situationIds)[number];

export const axisIds = [
  "age_group",
  "concomitant_medication",
  "dose_range",
  "sex",
  "underlying_condition",
] as const;

export type AxisId = (typeof axisIds)[number];

export type SituationMeta = {
  id: SituationId;
  label: string;
  short: string;
  question: string;
};

export const situations: SituationMeta[] = [
  {
    id: "HRS1_PERIOPERATIVE",
    label: "수술·시술을 앞두고 있어요",
    short: "수술 전후",
    question:
      "수술 또는 침습적 시술을 받는 성인에서 수술 전 보충제 복용이 출혈, 수혈, 마취 상호작용 또는 수술 주위 합병증과 관련되는지를 다룬 문헌",
  },
  {
    id: "HRS2_KIDNEY_DISEASE",
    label: "콩팥이 안 좋아요",
    short: "만성콩팥병·투석",
    question:
      "만성콩팥병 또는 투석 중인 성인에서 보충제 복용이 전해질 이상, 신기능 변화 또는 축적 독성과 관련되는지를 다룬 문헌",
  },
  {
    id: "HRS3_PREGNANCY",
    label: "임신 중이에요",
    short: "임신 중",
    question:
      "임신한 사람에서 보충제 복용이 산모 또는 태아의 이상반응과 관련되는지를 다룬 문헌",
  },
  {
    id: "HRS4_LIVER_DISEASE",
    label: "간이 안 좋아요",
    short: "간질환",
    question:
      "간질환이 있는 성인에서 보충제 복용이 간손상 또는 간기능 악화와 관련되는지를 다룬 문헌",
  },
  {
    id: "HRS5_ANTICOAGULATION",
    label: "항응고제를 먹고 있어요",
    short: "항응고제 복용",
    question:
      "항응고제 또는 항혈소판제를 복용하는 성인에서 보충제 복용이 출혈 또는 응고 지표 변화와 관련되는지를 다룬 문헌",
  },
];

export const situationById = new Map(situations.map((item) => [item.id, item]));

export type AxisMeta = {
  id: AxisId;
  /** 사용자가 채우는 입력란 이름. 비어 있으면 그 축은 적용되지 않는다. */
  field: "age" | "medication" | "dose" | "sex" | "condition";
  label: string;
  placeholder: string;
  /** 이 축이 적용됐을 때 근거 목록 위에 붙는 설명. */
  applied: string;
};

export const axes: AxisMeta[] = [
  {
    id: "age_group",
    field: "age",
    label: "나이",
    placeholder: "예: 68세",
    applied: "연령대를 보고한 문헌만 남겼습니다.",
  },
  {
    id: "concomitant_medication",
    field: "medication",
    label: "함께 먹는 약",
    placeholder: "예: 와파린",
    applied: "병용약을 보고한 문헌만 남겼습니다.",
  },
  {
    id: "dose_range",
    field: "dose",
    label: "하루 섭취량",
    placeholder: "예: 2000 mg",
    applied: "복용량을 보고한 문헌만 남겼습니다.",
  },
  {
    id: "sex",
    field: "sex",
    label: "성별",
    placeholder: "예: 여성",
    applied: "성별을 보고한 문헌만 남겼습니다.",
  },
  {
    id: "underlying_condition",
    field: "condition",
    label: "기저질환·증상",
    placeholder: "예: 고혈압",
    applied: "기저질환을 보고한 문헌만 남겼습니다.",
  },
];

export const axisById = new Map(axes.map((item) => [item.id, item]));
export const axisByField = new Map(axes.map((item) => [item.field, item]));

/** 이 사이트가 무엇을 하지 않는지. 모든 응답과 화면에 그대로 붙는다. */
export const evidenceOnlyDisclaimer =
  "연구에서 관찰된 대상·노출·결과와 근거 문장을 연결해 보여줍니다. 복용 시작·중단이나 용량 변경을 지시하지 않으며 진료를 대신하지 않습니다.";
