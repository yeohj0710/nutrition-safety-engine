import type { AxisId, SituationId } from "@/src/lib/clinical-situations";

export type PersonalizedSafetyExample = {
  id: string;
  title: string;
  summary: string;
  expectedEvidenceCount: number;
  input: {
    situation: SituationId;
    axes: AxisId[];
  };
};

// 구체적인 환자값을 예시로 넣으면 값까지 대조하는 검색처럼 보인다. 이 예시는
// 실제 규칙이 하는 일 그대로, 초록에서 포착한 메타데이터 표현만 선택한다.
export const publicInputExamples: PersonalizedSafetyExample[] = [
  {
    id: "kidney-dose-metadata",
    title: "콩팥질환 · 용량 표현",
    summary: "핵심 15건 중 수치·단위 표현이 있는 기록 9건을 봅니다.",
    expectedEvidenceCount: 9,
    input: {
      situation: "HRS2_KIDNEY_DISEASE",
      axes: ["dose_range"],
    },
  },
  {
    id: "perioperative-core",
    title: "수술 전후 핵심 근거",
    summary: "표현 필터 없이 핵심 기록 15건을 봅니다.",
    expectedEvidenceCount: 15,
    input: {
      situation: "HRS1_PERIOPERATIVE",
      axes: [],
    },
  },
  {
    id: "pregnancy-dose-metadata",
    title: "임신 · 용량 표현",
    summary: "핵심 15건 중 수치·단위 표현이 있는 기록 8건을 봅니다.",
    expectedEvidenceCount: 8,
    input: {
      situation: "HRS3_PREGNANCY",
      axes: ["dose_range"],
    },
  },
  {
    id: "liver-age-metadata",
    title: "간질환 · 연령 표현",
    summary: "핵심 15건 중 연령 관련 표현이 있는 기록 6건을 봅니다.",
    expectedEvidenceCount: 6,
    input: {
      situation: "HRS4_LIVER_DISEASE",
      axes: ["age_group"],
    },
  },
  {
    id: "anticoagulation-sex-metadata",
    title: "항응고제 · 성별 표현",
    summary: "핵심 15건 중 성별 관련 표현이 있는 기록 4건을 봅니다.",
    expectedEvidenceCount: 4,
    input: {
      situation: "HRS5_ANTICOAGULATION",
      axes: ["sex"],
    },
  },
];
