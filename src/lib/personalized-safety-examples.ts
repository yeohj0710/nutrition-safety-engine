import type { AxisId, SituationId } from "@/src/lib/clinical-situations";

export type PersonalizedSafetyExample = {
  id: string;
  /**
   * 예시를 누르면 이 문장이 입력칸에 그대로 들어간다.
   *
   * 예시가 라디오와 체크박스만 켜고 입력칸은 빈 채로 두면, 문장 입력칸이
   * 무엇을 받는 칸인지 예시로는 알 수 없다. 문장과 조건을 함께 채워야
   * 예시 한 번으로 이 화면이 어떻게 도는지 다 보인다.
   */
  sentence: string;
  title: string;
  summary: string;
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
    sentence: "신질환 환자에게 보충제를 하루 얼마나 썼는지 다룬 연구가 있는지 알고 싶습니다",
    title: "신질환 + 용량",
    summary: "이 상황의 문헌에서 용량을 언급한 후보를 찾습니다.",
    input: {
      situation: "HRS2_KIDNEY_DISEASE",
      axes: ["dose_range"],
    },
  },
  {
    id: "perioperative-core",
    sentence: "다음 달 수술을 앞둔 사람이 먹던 보충제를 다룬 연구를 보고 싶습니다",
    title: "수술 전후, 조건 없음",
    summary: "조건을 걸지 않고 검토한 핵심 문헌을 봅니다.",
    input: {
      situation: "HRS1_PERIOPERATIVE",
      axes: [],
    },
  },
  {
    id: "pregnancy-dose-metadata",
    sentence: "임신 중 철분제 용량을 다룬 연구가 있는지 알고 싶습니다",
    title: "임신 + 용량",
    summary: "이 상황의 문헌에서 용량을 언급한 후보를 찾습니다.",
    input: {
      situation: "HRS3_PREGNANCY",
      axes: ["dose_range"],
    },
  },
  {
    id: "liver-age-metadata",
    sentence: "간 수치가 높은 사람을 연령대로 나누어 본 보충제 연구가 있는지 궁금합니다",
    title: "간질환 + 연령",
    summary: "이 상황의 문헌에서 연령을 언급한 후보를 찾습니다.",
    input: {
      situation: "HRS4_LIVER_DISEASE",
      axes: ["age_group"],
    },
  },
  {
    id: "anticoagulation-medication-metadata",
    sentence: "와파린을 먹는 사람이 다른 약과 함께 보충제를 쓴 연구를 보고 싶습니다",
    title: "항응고제 + 병용 약물",
    summary: "이 상황의 문헌에서 병용 약물을 언급한 후보를 찾습니다.",
    input: {
      situation: "HRS5_ANTICOAGULATION",
      axes: ["concomitant_medication"],
    },
  },
];
