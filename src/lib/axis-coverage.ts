// 이 파일은 생성물이다. 손으로 고치지 말 것.
// 원본: research/systematic_review_v41/personalized_rules.json
// 규칙 파일은 원장이 SHA-256 을 기록하고 있어 재생성이 불가능하므로, 화면이 쓰는
// 상황×축 건수만 여기에 옮겨 둔다. 값이 어긋나면
// __tests__/personalized-safety-api.test.ts 가 잡는다.

import type { AxisId, SituationId } from "@/src/lib/clinical-situations";

/** 이 상황에서 그 축을 실제로 보고한 문헌 수. 축 자체가 없으면 null. */
export const axisCoverage: Record<SituationId, Record<AxisId, number | null>> = {
  HRS1_PERIOPERATIVE: {
    age_group: 8,
    concomitant_medication: 1,
    dose_range: 8,
    sex: 4,
    underlying_condition: 8,
  },
  HRS2_KIDNEY_DISEASE: {
    age_group: 8,
    concomitant_medication: 2,
    dose_range: 6,
    sex: null,
    underlying_condition: 15,
  },
  HRS3_PREGNANCY: {
    age_group: 11,
    concomitant_medication: null,
    dose_range: 9,
    sex: 7,
    underlying_condition: 13,
  },
  HRS4_LIVER_DISEASE: {
    age_group: 9,
    concomitant_medication: null,
    dose_range: 7,
    sex: 1,
    underlying_condition: 14,
  },
  HRS5_ANTICOAGULATION: {
    age_group: 10,
    concomitant_medication: 15,
    dose_range: 8,
    sex: 1,
    underlying_condition: 4,
  },
};

/** 이 상황의 핵심 근거 수. 규칙 파일의 base 규칙 건수와 같아야 한다. */
export const coreCoverage: Record<SituationId, number> = {
  HRS1_PERIOPERATIVE: 15,
  HRS2_KIDNEY_DISEASE: 15,
  HRS3_PREGNANCY: 15,
  HRS4_LIVER_DISEASE: 15,
  HRS5_ANTICOAGULATION: 15,
};
