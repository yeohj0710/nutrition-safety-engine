import type { AxisId, SituationId } from "@/src/lib/clinical-situations";

export type PersonalizedSafetyExample = {
  id: string;
  /**
   * 예시를 누르면 이 문장이 입력칸에 그대로 들어간다.
   *
   * 예전에는 예시가 라디오·체크박스만 켜고 입력칸은 빈 채로 뒀다. 그래서 "문장으로
   * 찾기"가 무엇을 받는 칸인지 예시로는 알 수 없었고, 사람이 직접 한 문장을 지어내야
   * 시험해 볼 수 있었다. 문장과 조건을 함께 채워야 예시 한 번으로 이 화면이 어떻게
   * 도는지 다 보인다.
   */
  sentence: string;
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
    sentence: "콩팥이 안 좋은데 영양제를 하루 얼마씩 먹는 연구가 있는지 보고 싶어요",
    title: "콩팥 + 용량",
    summary: "핵심 문헌 15건 가운데 용량이 적힌 9건을 봅니다.",
    expectedEvidenceCount: 9,
    input: {
      situation: "HRS2_KIDNEY_DISEASE",
      axes: ["dose_range"],
    },
  },
  {
    id: "perioperative-core",
    sentence: "다음 달에 수술을 받는데 먹던 영양제 이야기가 나온 연구를 보고 싶어요",
    title: "수술 전후 · 조건 없이",
    summary: "조건을 걸지 않고 이 상황의 핵심 문헌 15건을 봅니다.",
    expectedEvidenceCount: 15,
    input: {
      situation: "HRS1_PERIOPERATIVE",
      axes: [],
    },
  },
  {
    id: "pregnancy-dose-metadata",
    sentence: "임신 중인데 철분제를 하루 얼마씩 먹는 연구가 있는지 보고 싶어요",
    title: "임신 + 용량",
    summary: "핵심 문헌 15건 가운데 용량이 적힌 8건을 봅니다.",
    expectedEvidenceCount: 8,
    input: {
      situation: "HRS3_PREGNANCY",
      axes: ["dose_range"],
    },
  },
  {
    id: "liver-age-metadata",
    sentence: "간 수치가 높다고 들었어요. 나이를 나눠서 본 연구가 있는지 궁금해요",
    title: "간질환 + 나이",
    summary: "핵심 문헌 15건 가운데 나이 이야기가 나온 6건을 봅니다.",
    expectedEvidenceCount: 6,
    input: {
      situation: "HRS4_LIVER_DISEASE",
      axes: ["age_group"],
    },
  },
  {
    id: "anticoagulation-sex-metadata",
    sentence: "와파린을 먹고 있는데 남녀를 나눠서 본 연구가 있는지 보고 싶어요",
    title: "항응고제 + 성별",
    summary: "핵심 문헌 15건 가운데 남녀를 나눠 본 4건을 봅니다.",
    expectedEvidenceCount: 4,
    input: {
      situation: "HRS5_ANTICOAGULATION",
      axes: ["sex"],
    },
  },
];
