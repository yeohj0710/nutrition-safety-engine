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
  /** 사용자가 채우는 입력란 이름. 비어 있으면 그 축은 적용되지 않습니다. */
  field: "age" | "medication" | "dose" | "sex" | "condition";
  /**
   * 화면에 거는 이름.
   *
   * "연령 관련 표현"처럼 쓰면 정확하긴 해도 입으로 하는 말이 아니라, 무엇을 고르는
   * 것인지 읽는 사람이 한 번 더 옮겨야 한다. 이 화면이 실제로 하는 일은 "그 이야기가
   * 초록에 나왔는가"를 보는 것이므로 이름도 그렇게 적는다.
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
    label: "나이 이야기",
    placeholder: "예: 68세",
    filterHint: "age, older 처럼 나이를 말한 문헌",
    noun: "나이",
  },
  {
    id: "concomitant_medication",
    field: "medication",
    label: "함께 먹는 약 이야기",
    placeholder: "예: 와파린",
    filterHint: "drug, anticoagulation 처럼 약을 말한 문헌",
    noun: "함께 먹는 약",
  },
  {
    id: "dose_range",
    field: "dose",
    label: "용량 이야기",
    placeholder: "예: 2000 mg",
    filterHint: "500 mg, 2000 IU 처럼 양을 적은 문헌",
    noun: "용량",
  },
  {
    id: "sex",
    field: "sex",
    label: "남녀 구분",
    placeholder: "예: 여성",
    filterHint: "female, male 처럼 성별을 나눈 문헌",
    noun: "남녀",
  },
  {
    id: "underlying_condition",
    field: "condition",
    label: "앓는 병 이야기",
    placeholder: "예: 고혈압",
    filterHint: "kidney, liver 처럼 병이나 상황을 말한 문헌",
    noun: "앓는 병",
  },
];

export const axisById = new Map(axes.map((item) => [item.id, item]));
export const axisByField = new Map(axes.map((item) => [item.field, item]));

/** 이 사이트가 무엇을 하지 않는지. 모든 응답과 화면에 그대로 붙는다. */
export const evidenceOnlyDisclaimer =
  "연구가 누구를 보고 무엇을 확인했는지, 그 문장이 초록 어디에 있는지까지 이어서 보여드립니다. 먹기 시작할지 끊을지, 양을 얼마로 할지는 지시하지 않으며 진료를 대신하지 않습니다.";
