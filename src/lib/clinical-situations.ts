// 연구가 다루는 임상 상황 다섯과 개인화 축 다섯을 한곳에 둔다.
// 값은 research/systematic_review/personalized_rules.json 의 question_id 및
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
   * 요약 첫 문장에서 입력을 되짚을 때 쓰는 연결형.
   * 뒤에 다른 조건이 이어질 수 있다.
   */
  spoken: string;
};

export const situations: SituationMeta[] = [
  {
    id: "HRS1_PERIOPERATIVE",
    label: "수술, 시술, 마취 전후",
    short: "수술 전후",
    question:
      "수술, 시술, 마취 전후 사람에서 보충제와 영양 제제의 사용, 효과, 위해를 다룬 문헌",
    spoken: "수술, 시술, 마취 전후 문헌을 찾으시고",
  },
  {
    id: "HRS2_KIDNEY_DISEASE",
    label: "신질환과 투석",
    short: "신질환과 투석",
    question:
      "신질환, 신부전, 투석 환자에서 보충제와 영양 제제의 사용, 효과, 위해를 다룬 문헌",
    spoken: "신질환과 투석 문헌을 찾으시고",
  },
  {
    id: "HRS3_PREGNANCY",
    label: "임신, 수유, 태아 노출",
    short: "임신과 수유",
    question:
      "임신과 수유 중 보충제와 영양 제제의 사용, 효과, 위해 및 태아 노출을 다룬 사람 문헌",
    spoken: "임신, 수유, 태아 노출 문헌을 찾으시고",
  },
  {
    id: "HRS4_LIVER_DISEASE",
    label: "간질환과 간독성",
    short: "간질환과 간독성",
    question:
      "간질환과 간부전 환자의 보충제 사용 또는 보충제와 영양 제제의 간독성을 다룬 사람 문헌",
    spoken: "간질환과 간독성 문헌을 찾으시고",
  },
  {
    id: "HRS5_ANTICOAGULATION",
    label: "항응고, 항혈소판, 출혈",
    short: "항응고와 출혈",
    question:
      "항응고제, 항혈소판제 병용 또는 출혈 위험 상황에서 보충제와 영양 제제의 사용, 효과, 위해를 다룬 사람 문헌",
    spoken: "항응고, 항혈소판, 출혈 문헌을 찾으시고",
  },
];

export const situationById = new Map(situations.map((item) => [item.id, item]));

export type AxisMeta = {
  id: AxisId;
  /** 사용자가 채우는 입력란 이름. 비어 있으면 그 축은 적용되지 않습니다. */
  field: "age" | "medication" | "dose" | "sex" | "condition";
  /**
   * 화면에 거는 이름. 공공 누리집이 쓰는 짧은 명사로 적는다.
   * 이 화면이 실제로 하는 일은 "그 항목이 초록에 언급됐는가"를 보는 것이다.
   */
  label: string;
  placeholder: string;
  /** 이 조건이 실제로 무엇을 잡는지. 체크박스 아래 한 줄로 붙는다. */
  filterHint: string;
  /**
   * 여러 조건이 함께 걸렸을 때 한 문장으로 묶기 위한 명사.
   * 조건마다 문장을 따로 붙이면 같은 말이 반복돼 읽기 어렵다.
   */
  noun: string;
};

export const axes: AxisMeta[] = [
  {
    id: "age_group",
    field: "age",
    label: "연령",
    placeholder: "예: 68세",
    filterHint: "age, older 등 연령을 언급한 문헌",
    noun: "연령",
  },
  {
    id: "concomitant_medication",
    field: "medication",
    label: "병용 약물",
    placeholder: "예: 와파린",
    filterHint: "drug, anticoagulation 등 약물을 언급한 문헌",
    noun: "병용 약물",
  },
  {
    id: "dose_range",
    field: "dose",
    label: "용량",
    placeholder: "예: 2000 mg",
    filterHint: "500 mg, 2000 IU 등 용량을 적은 문헌",
    noun: "용량",
  },
  {
    id: "sex",
    field: "sex",
    label: "성별",
    placeholder: "예: 여성",
    filterHint: "female, male 등 성별을 나눈 문헌",
    noun: "성별",
  },
  {
    id: "underlying_condition",
    field: "condition",
    label: "기저 질환",
    placeholder: "예: 고혈압",
    filterHint: "kidney, liver 등 질환이나 상황을 언급한 문헌",
    noun: "기저 질환",
  },
];

export const axisById = new Map(axes.map((item) => [item.id, item]));
export const axisByField = new Map(axes.map((item) => [item.field, item]));

/** 이 사이트가 무엇을 하지 않는지. 모든 응답과 화면에 그대로 붙는다. */
export const evidenceOnlyDisclaimer =
  "연구가 누구를 대상으로 무엇을 확인했는지, 그 문장이 초록 어디에 있는지까지 이어서 보여줍니다. 복용 시작과 중단, 용량은 지시하지 않으며 진료를 대신하지 않습니다.";
