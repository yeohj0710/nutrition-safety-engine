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
  /**
   * 요약 첫 문장에서 입력을 되짚을 때 쓰는 말투.
   * "…라고 하셨어요" 앞에 붙는 연결형이라 뒤에 다른 조건이 이어질 수 있다.
   */
  spoken: string;
};

export const situations: SituationMeta[] = [
  {
    id: "HRS1_PERIOPERATIVE",
    label: "수술·시술을 앞두고 있어요",
    short: "수술 전후",
    question:
      "수술 또는 침습적 시술을 받는 성인에서 수술 전 보충제 복용이 출혈, 수혈, 마취 상호작용 또는 수술 주위 합병증과 관련되는지를 다룬 문헌",
    spoken: "수술·시술을 앞두고 계시고",
  },
  {
    id: "HRS2_KIDNEY_DISEASE",
    label: "콩팥이 안 좋아요",
    short: "만성콩팥병·투석",
    question:
      "만성콩팥병 또는 투석 중인 성인에서 보충제 복용이 전해질 이상, 신기능 변화 또는 축적 독성과 관련되는지를 다룬 문헌",
    spoken: "콩팥이 걱정되는 상황이고",
  },
  {
    id: "HRS3_PREGNANCY",
    label: "임신 중이에요",
    short: "임신 중",
    question:
      "임신한 사람에서 보충제 복용이 산모 또는 태아의 이상반응과 관련되는지를 다룬 문헌",
    spoken: "임신 중이시고",
  },
  {
    id: "HRS4_LIVER_DISEASE",
    label: "간이 안 좋아요",
    short: "간질환",
    question:
      "간질환이 있는 성인에서 보충제 복용이 간손상 또는 간기능 악화와 관련되는지를 다룬 문헌",
    spoken: "간이 걱정되는 상황이고",
  },
  {
    id: "HRS5_ANTICOAGULATION",
    label: "항응고제를 먹고 있어요",
    short: "항응고제 복용",
    question:
      "항응고제 또는 항혈소판제를 복용하는 성인에서 보충제 복용이 출혈 또는 응고 지표 변화와 관련되는지를 다룬 문헌",
    spoken: "항응고제를 드시고 계시고",
  },
];

export const situationById = new Map(situations.map((item) => [item.id, item]));

export type AxisMeta = {
  id: AxisId;
  /** 사용자가 채우는 입력란 이름. 비어 있으면 그 축은 적용되지 않는다. */
  field: "age" | "medication" | "dose" | "sex" | "condition";
  label: string;
  placeholder: string;
  /** 화면에서 이 필터가 실제로 포착하는 메타데이터 표현. */
  filterHint: string;
  /** 이 축이 적용됐을 때 근거 목록 위에 붙는 설명. */
  applied: string;
  /**
   * 여러 축이 함께 적용됐을 때 한 문장으로 묶기 위한 명사.
   * 축마다 "…를 보고한 문헌만 남겼습니다."를 따로 붙이면 같은 문장이 반복돼 읽기 어렵다.
   */
  noun: string;
};

export const axes: AxisMeta[] = [
  {
    id: "age_group",
    field: "age",
    label: "연령 관련 표현",
    placeholder: "예: 68세",
    filterHint: "age, adult, older 같은 연령 표현이 있는 기록",
    applied: "연령 관련 표현이 포착된 문헌만 남겼습니다.",
    noun: "연령 표현",
  },
  {
    id: "concomitant_medication",
    field: "medication",
    label: "약물 관련 표현",
    placeholder: "예: 와파린",
    filterHint: "drug, therapy, anticoagulation 같은 약물 표현이 있는 기록",
    applied: "약물 관련 표현이 포착된 문헌만 남겼습니다.",
    noun: "약물 표현",
  },
  {
    id: "dose_range",
    field: "dose",
    label: "용량 관련 표현",
    placeholder: "예: 2000 mg",
    filterHint: "mg, IU 같은 수치·단위 표현이 있는 기록",
    applied: "용량 관련 표현이 포착된 문헌만 남겼습니다.",
    noun: "용량 표현",
  },
  {
    id: "sex",
    field: "sex",
    label: "성별 관련 표현",
    placeholder: "예: 여성",
    filterHint: "female, male, sex, gender 같은 표현이 있는 기록",
    applied: "성별 관련 표현이 포착된 문헌만 남겼습니다.",
    noun: "성별 표현",
  },
  {
    id: "underlying_condition",
    field: "condition",
    label: "질환 관련 표현",
    placeholder: "예: 고혈압",
    filterHint: "kidney, liver, surgery, diabetes 같은 질환·상황 표현이 있는 기록",
    applied: "질환 관련 표현이 포착된 문헌만 남겼습니다.",
    noun: "질환 표현",
  },
];

export const axisById = new Map(axes.map((item) => [item.id, item]));
export const axisByField = new Map(axes.map((item) => [item.field, item]));

/** 이 사이트가 무엇을 하지 않는지. 모든 응답과 화면에 그대로 붙는다. */
export const evidenceOnlyDisclaimer =
  "연구에서 관찰된 대상·노출·결과와 근거 문장을 연결해 보여줍니다. 복용 시작·중단이나 용량 변경을 지시하지 않으며 진료를 대신하지 않습니다.";
