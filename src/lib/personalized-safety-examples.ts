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

// 순서는 v3.0 최종 추출 논문 가운데 그 성분을 직접 다룬 문헌 수를 따른다.
// 비타민 K 7건, 비타민 D 2건, 오메가-3 1건, 칼슘 1건이다.
//
// 비타민 C 는 화면에서 뺐다. 별칭 B3 이 연결된 만성콩팥병·투석 질문의 핵심 근거 15건 가운데
// 비타민 C 를 언급한 문헌이 0건이라, 어떤 입력을 넣어도 "이 성분을 직접 다룬 문헌은 없다"는
// 답만 나온다. 검색식을 넓혀 근거가 생기면 다시 넣는다. 별칭 데이터 자체는 v2.1 호환을 위해
// 남아 있으므로 API 로는 계속 조회된다.
export const personalizedSafetyIngredientOrder = [
  "비타민 K",
  "비타민 D",
  "오메가-3",
  "칼슘",
] as const;

// 각 예시는 최종 추출 논문이 성분을 직접 다루고, 입력한 약·병력·검사 중 하나 이상이
// 판단에 반영되는 조합만 남겼다. 약이나 용량을 직접 다루지 않는 보조 예시는 화면에서 뺐다.
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
];
