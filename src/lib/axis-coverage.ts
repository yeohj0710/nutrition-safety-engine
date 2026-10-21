// 생성 명령: python -m tools.build.build_site rules
// 원본: research/systematic_review/personalized_rules.json
import type { AxisId, SituationId } from "@/src/lib/clinical-situations";

export const axisCoverage: Record<SituationId, Record<AxisId, number | null>> = {
  "HRS1_PERIOPERATIVE": {
    "age_group": 6,
    "concomitant_medication": null,
    "dose_range": 2,
    "sex": 4,
    "underlying_condition": 5
  },
  "HRS2_KIDNEY_DISEASE": {
    "age_group": 3,
    "concomitant_medication": 2,
    "dose_range": 4,
    "sex": null,
    "underlying_condition": 15
  },
  "HRS3_PREGNANCY": {
    "age_group": 9,
    "concomitant_medication": null,
    "dose_range": 5,
    "sex": 8,
    "underlying_condition": 13
  },
  "HRS4_LIVER_DISEASE": {
    "age_group": 6,
    "concomitant_medication": null,
    "dose_range": 4,
    "sex": 1,
    "underlying_condition": 14
  },
  "HRS5_ANTICOAGULATION": {
    "age_group": 3,
    "concomitant_medication": 13,
    "dose_range": 5,
    "sex": null,
    "underlying_condition": 5
  }
};

export const coreCoverage: Record<SituationId, number> = {
  "HRS1_PERIOPERATIVE": 15,
  "HRS2_KIDNEY_DISEASE": 15,
  "HRS3_PREGNANCY": 15,
  "HRS4_LIVER_DISEASE": 15,
  "HRS5_ANTICOAGULATION": 15
};
