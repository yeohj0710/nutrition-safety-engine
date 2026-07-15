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

export const personalizedSafetyIngredientOrder = [
  "비타민 K",
  "오메가-3",
  "칼슘",
  "비타민 D",
  "비타민 C",
] as const;

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
    id: "omega3-apixaban-nosebleed",
    title: "아픽사반 복용, 코피가 남",
    description: "EPA+DHA 2,000 mg/day와 출혈 증상을 함께 보는 경우",
    input: {
      ingredient: "오메가-3",
      dose: "EPA+DHA 2000 mg/day",
      medication: "아픽사반",
      condition: "코피가 자주 남",
      labs: "",
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
    id: "calcium-stone-high-urine-calcium",
    title: "결석 병력, 요중 칼슘 280",
    description: "칼슘 600 mg/day를 먹고 요중 칼슘이 높은 경우",
    input: {
      ingredient: "칼슘",
      dose: "600 mg/day",
      medication: "",
      condition: "칼슘옥살산 신장결석 병력",
      labs: "24시간 요중 칼슘 280 mg/day",
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
  {
    id: "vitamin-d-upper-limit-stone",
    title: "4,000 IU/day, 결석 병력",
    description: "성인 상한과 같고 고칼슘뇨 병력이 있는 경우",
    input: {
      ingredient: "비타민 D",
      dose: "4000 IU/day",
      medication: "",
      condition: "신장결석 및 고칼슘뇨 병력",
      labs: "25(OH)D 48 ng/mL",
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
    id: "vitamin-d-moderate-no-risk",
    title: "2,000 IU/day, 특별한 증상 없음",
    description: "성인 상한 아래이며 결석 관련 병력이 없는 경우",
    input: {
      ingredient: "비타민 D",
      dose: "2000 IU/day",
      medication: "복용 약 없음",
      condition: "특별한 증상 없음",
      labs: "25(OH)D 28 ng/mL",
    },
  },
  {
    id: "vitamin-c-high-oxalate",
    title: "1,000 mg/day, 요중 옥살산 상승",
    description: "성인 상한 아래지만 결석 위험 조건이 있는 경우",
    input: {
      ingredient: "비타민 C",
      dose: "1000 mg/day",
      medication: "",
      condition: "칼슘옥살산 신장결석 병력",
      labs: "요중 옥살산 상승",
    },
  },
  {
    id: "vitamin-c-kidney-function",
    title: "2,000 mg/day, 신장기능 저하",
    description: "일반 상한에 해당하고 신장 관련 위험이 있는 경우",
    input: {
      ingredient: "비타민 C",
      dose: "2000 mg/day",
      medication: "",
      condition: "신장기능 저하",
      labs: "eGFR 48 mL/min/1.73m²",
    },
  },
  {
    id: "vitamin-c-low-dose-no-risk",
    title: "500 mg/day, 결석 병력 없음",
    description: "성인 상한 아래이며 신장 관련 위험이 없는 경우",
    input: {
      ingredient: "비타민 C",
      dose: "500 mg/day",
      medication: "복용 약 없음",
      condition: "특별한 증상 없음",
      labs: "",
    },
  },
];
