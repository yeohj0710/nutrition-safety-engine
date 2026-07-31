// 이 파일은 생성물이다. 손으로 고치지 말 것.
// 원본: research/systematic_review_v40/personalized_rules.json
// 규칙 파일은 원장이 SHA-256 을 기록하고 있어 재생성이 불가능하므로, 화면이 쓰는
// 상황×축 건수만 여기에 옮겨 둔다. 값이 어긋나면
// __tests__/personalized-safety-api.test.ts 가 잡는다.

import type { AxisId, SituationId } from "@/src/lib/clinical-situations";

/** 이 상황에서 그 축을 실제로 보고한 문헌 수. 축 자체가 없으면 null. */
export const axisCoverage: Record<SituationId, Record<AxisId, number | null>> = {
  HRS1_PERIOPERATIVE: {
    age_group: 7,
    concomitant_medication: 3,
    dose_range: 8,
    sex: 3,
    underlying_condition: 14,
  },
  HRS2_KIDNEY_DISEASE: {
    age_group: 10,
    concomitant_medication: 5,
    dose_range: 9,
    sex: null,
    underlying_condition: 15,
  },
  HRS3_PREGNANCY: {
    age_group: 8,
    concomitant_medication: 5,
    dose_range: 8,
    sex: 10,
    underlying_condition: 13,
  },
  HRS4_LIVER_DISEASE: {
    age_group: 6,
    concomitant_medication: 6,
    dose_range: 6,
    sex: 3,
    underlying_condition: 15,
  },
  HRS5_ANTICOAGULATION: {
    age_group: 12,
    concomitant_medication: 15,
    dose_range: 3,
    sex: 4,
    underlying_condition: 3,
  },
};

/** 이 상황의 핵심 근거 수(축을 하나도 켜지 않았을 때 나오는 수). */
export const coreCoverage: Record<SituationId, number> = {
  HRS1_PERIOPERATIVE: 15,
  HRS2_KIDNEY_DISEASE: 15,
  HRS3_PREGNANCY: 15,
  HRS4_LIVER_DISEASE: 15,
  HRS5_ANTICOAGULATION: 15,
};
