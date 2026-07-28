import type { SituationId } from "@/src/lib/clinical-situations";

export type PersonalizedSafetyExample = {
  id: string;
  title: string;
  summary: string;
  input: {
    situation: SituationId;
    age: string;
    medication: string;
    dose: string;
    sex: string;
    condition: string;
  };
};

// 다섯 상황을 모두 덮고, 축을 하나도 안 채운 경우와 여러 개 채운 경우를 함께 둔다.
// 축을 많이 채울수록 그 조건을 모두 보고한 문헌만 남아 결과가 줄어드는데,
// 줄어드는 모습 자체가 이 도구가 보여주려는 것이다.
export const publicInputExamples: PersonalizedSafetyExample[] = [
  {
    id: "perioperative-plain",
    title: "다음 달에 수술이 잡혀 있어요",
    summary: "조건을 더 넣지 않고 이 상황의 핵심 근거부터 봅니다.",
    input: {
      situation: "HRS1_PERIOPERATIVE",
      age: "",
      medication: "",
      dose: "",
      sex: "",
      condition: "",
    },
  },
  {
    id: "perioperative-elderly-antiplatelet",
    title: "68세, 수술 전인데 아스피린을 먹고 있어요",
    summary: "연령과 병용약을 모두 보고한 문헌만 남깁니다.",
    input: {
      situation: "HRS1_PERIOPERATIVE",
      age: "68세",
      medication: "아스피린",
      dose: "",
      sex: "",
      condition: "",
    },
  },
  {
    id: "kidney-dialysis",
    title: "투석 중인데 보충제를 먹어도 되는지 궁금해요",
    summary: "만성콩팥병·투석 상황의 근거를 봅니다.",
    input: {
      situation: "HRS2_KIDNEY_DISEASE",
      age: "",
      medication: "",
      dose: "",
      sex: "",
      condition: "투석 중",
    },
  },
  {
    id: "pregnancy-dose",
    title: "임신 중이고 하루 2000 mg을 먹고 있어요",
    summary: "복용량을 보고한 문헌만 남깁니다.",
    input: {
      situation: "HRS3_PREGNANCY",
      age: "",
      medication: "",
      dose: "2000 mg",
      sex: "",
      condition: "",
    },
  },
  {
    id: "liver-elevated-enzymes",
    title: "간수치가 높다고 들었어요",
    summary: "간질환 상황에서 기저질환을 보고한 문헌만 남깁니다.",
    input: {
      situation: "HRS4_LIVER_DISEASE",
      age: "",
      medication: "",
      dose: "",
      sex: "",
      condition: "간수치 상승",
    },
  },
  {
    id: "anticoagulation-warfarin",
    title: "와파린을 먹는데 멍이 잘 들어요",
    summary: "항응고제 복용 상황에서 병용약을 보고한 문헌만 남깁니다.",
    input: {
      situation: "HRS5_ANTICOAGULATION",
      age: "",
      medication: "와파린",
      dose: "",
      sex: "",
      condition: "멍이 잘 듦",
    },
  },
];
