export type PersonalizedSafetyExample = {
  id: string;
  title: string;
  description: string;
  input: {
    ingredient: string;
    dose: string;
    medication: string;
    condition: string;
    labs: string;
  };
};

// 순서는 v3.0 선별을 통과해 별칭에 연결된 후보 근거 수를 따른다.
// 비타민 K 7건, 비타민 C 5건, 비타민 D 2건, 오메가-3 1건, 칼슘 1건.
// 근거가 두꺼운 보충제를 앞에 두어 첫 화면에서 근거가 실제로 붙는 사례를 먼저 보여준다.
export const personalizedSafetyIngredientOrder = [
  "비타민 K",
  "비타민 C",
  "비타민 D",
  "오메가-3",
  "칼슘",
] as const;

// 각 예시는 실제로 문헌이 붙는 조합으로 골랐다. 별칭 A1·A2 의 근거는 와파린과 비타민 K
// 상호작용을 다루고, B1·B2·B3 의 근거는 전부 만성콩팥병·투석 문헌이다. 그래서 B 계열은
// 결석·옥살산이 아니라 신장기능 저하를 기준으로 입력을 구성해야 개인화 신호가 발화한다.
export const personalizedSafetyExamples: PersonalizedSafetyExample[] = [
  {
    id: "vitamin-k-warfarin-inr",
    title: "와파린 복용, INR 3.1",
    description: "100 mcg/day를 먹고 있으며 최근 INR 수치가 있는 경우",
    input: {
      ingredient: "비타민 K",
      dose: "100 mcg/day",
      medication: "와파린",
      condition: "항응고 치료 중",
      labs: "INR 3.1",
    },
  },
  {
    id: "vitamin-k-unknown-dose",
    title: "하루 섭취량을 모름",
    description: "와파린을 먹고 있으며 INR이 자주 달라지는 경우",
    input: {
      ingredient: "비타민 K",
      dose: "잘 모르겠어요",
      medication: "와파린",
      condition: "INR이 자주 바뀜",
      labs: "",
    },
  },
  {
    id: "vitamin-k-bruising",
    title: "200 mcg/day, 멍이 잘 듦",
    description: "와파린과 함께 먹고 있으며 멍이 늘어난 경우",
    input: {
      ingredient: "비타민 K",
      dose: "200 mcg/day",
      medication: "와파린",
      condition: "멍이 잘 듦",
      labs: "INR 3.8",
    },
  },
  {
    id: "vitamin-c-kidney-function",
    title: "2,000 mg/day, 신장기능 저하",
    description: "일반 상한에 해당하고 신장기능이 떨어진 경우",
    input: {
      ingredient: "비타민 C",
      dose: "2000 mg/day",
      medication: "",
      condition: "신장기능 저하",
      labs: "eGFR 48 mL/min/1.73m²",
    },
  },
  {
    id: "vitamin-c-ckd-iron",
    title: "만성콩팥병, 철분제와 함께",
    description: "신장기능이 떨어진 상태에서 철분제와 같이 먹는 경우",
    input: {
      ingredient: "비타민 C",
      dose: "1000 mg/day",
      medication: "철분제",
      condition: "만성콩팥병으로 신장기능 저하",
      labs: "eGFR 32 mL/min/1.73m²",
    },
  },
  {
    id: "vitamin-c-low-dose-no-risk",
    title: "500 mg/day, 신장 관련 위험 없음",
    description: "성인 상한 아래이며 신장 관련 위험이 없는 경우",
    input: {
      ingredient: "비타민 C",
      dose: "500 mg/day",
      medication: "복용 약 없음",
      condition: "특별한 증상 없음",
      labs: "",
    },
  },
  {
    id: "vitamin-d-ckd-hypercalcemia",
    title: "4,000 IU/day, 만성콩팥병",
    description: "성인 상한과 같고 혈중 칼슘이 높은 경우",
    input: {
      ingredient: "비타민 D",
      dose: "4000 IU/day",
      medication: "",
      condition: "만성콩팥병",
      labs: "혈청 칼슘 10.7 mg/dL",
    },
  },
  {
    id: "vitamin-d-peritoneal-dialysis",
    title: "2,000 IU/day, 복막투석 중",
    description: "투석을 받고 있으며 상한 아래로 먹고 있는 경우",
    input: {
      ingredient: "비타민 D",
      dose: "2000 IU/day",
      medication: "",
      condition: "복막투석 중이며 신장기능 저하",
      labs: "eGFR 12 mL/min/1.73m²",
    },
  },
  {
    id: "vitamin-d-microgram-thiazide",
    title: "100 μg, 티아지드 이뇨제 복용",
    description: "μg를 IU로 환산하고 높은 혈중 칼슘도 함께 보는 경우",
    input: {
      ingredient: "비타민 D",
      dose: "100 μg/day",
      medication: "티아지드 이뇨제",
      condition: "칼슘 수치가 높다고 들음",
      labs: "혈청 칼슘 10.7 mg/dL",
    },
  },
  {
    id: "omega3-warfarin-bruising",
    title: "와파린 복용, 멍이 잘 듦",
    description: "EPA+DHA 2,000 mg/day와 출혈 증상을 함께 보는 경우",
    input: {
      ingredient: "오메가-3",
      dose: "EPA+DHA 2000 mg/day",
      medication: "와파린",
      condition: "멍이 잘 듦",
      labs: "INR 2.6",
    },
  },
  {
    id: "omega3-warfarin-high-dose",
    title: "와파린 복용, 6,000 mg/day",
    description: "일반 기준보다 많은 양을 먹고 멍이 잘 드는 경우",
    input: {
      ingredient: "오메가-3",
      dose: "EPA+DHA 6000 mg/day",
      medication: "와파린",
      condition: "멍이 잘 듦",
      labs: "",
    },
  },
  {
    id: "omega3-aspirin-no-symptoms",
    title: "아스피린 복용, 증상 없음",
    description: "EPA+DHA 1,000 mg/day를 먹고 출혈 증상은 없는 경우",
    input: {
      ingredient: "오메가-3",
      dose: "EPA+DHA 1000 mg/day",
      medication: "아스피린",
      condition: "특별한 증상 없음",
      labs: "",
    },
  },
  {
    id: "calcium-ckd-hypercalcemia",
    title: "600 mg/day, 만성콩팥병",
    description: "신장기능이 떨어졌고 혈중 칼슘이 높은 경우",
    input: {
      ingredient: "칼슘",
      dose: "600 mg/day",
      medication: "",
      condition: "만성콩팥병으로 신장기능 저하",
      labs: "혈청 칼슘 10.6 mg/dL",
    },
  },
  {
    id: "calcium-levothyroxine",
    title: "레보티록신과 함께 복용",
    description: "칼슘 500 mg/day의 양과 약 흡수 영향을 함께 보는 경우",
    input: {
      ingredient: "칼슘",
      dose: "500 mg/day",
      medication: "레보티록신",
      condition: "특별한 증상 없음",
      labs: "",
    },
  },
  {
    id: "calcium-unknown-antibiotic",
    title: "항생제 복용, 칼슘 양을 모름",
    description: "제품 함량을 모르는 상태에서 복용 시간도 확인하는 경우",
    input: {
      ingredient: "칼슘",
      dose: "잘 모르겠어요",
      medication: "퀴놀론계 항생제",
      condition: "변비",
      labs: "",
    },
  },
];
