// 생성 명령: python -m tools.build.build_site rules
// 원본: research/systematic_review/personalized_rules.json
import type { AxisId, SituationId } from "@/src/lib/clinical-situations";

export const axisCoverage: Record<SituationId, Record<AxisId, number | null>> = {
  "HRS1_PERIOPERATIVE": {
    "age_group": 6,
    "concomitant_medication": null,
    "dose_range": 4,
    "sex": 3,
    "underlying_condition": 5
  },
  "HRS2_KIDNEY_DISEASE": {
    "age_group": 4,
    "concomitant_medication": 2,
    "dose_range": 3,
    "sex": null,
    "underlying_condition": 9
  },
  "HRS3_PREGNANCY": {
    "age_group": 5,
    "concomitant_medication": null,
    "dose_range": 4,
    "sex": 3,
    "underlying_condition": 6
  },
  "HRS4_LIVER_DISEASE": {
    "age_group": 9,
    "concomitant_medication": null,
    "dose_range": 6,
    "sex": 1,
    "underlying_condition": 12
  },
  "HRS5_ANTICOAGULATION": {
    "age_group": 2,
    "concomitant_medication": 2,
    "dose_range": 2,
    "sex": null,
    "underlying_condition": 2
  }
};

export const coreCoverage: Record<SituationId, number> = {
  "HRS1_PERIOPERATIVE": 11,
  "HRS2_KIDNEY_DISEASE": 9,
  "HRS3_PREGNANCY": 7,
  "HRS4_LIVER_DISEASE": 13,
  "HRS5_ANTICOAGULATION": 4
};
