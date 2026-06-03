export const studyScope = {
  shortLabel: "항응고제와 신장 고위험군",
  description:
    "항응고제 복용자와 신장결석, 고칼슘혈증, 고옥살산뇨 등 신장 관련 고위험군에서 우선 확인할 성분만 노출합니다.",
  ingredientIds: [
    "vitamin_k",
    "omega3_epa_dha",
    "glucosamine_chondroitin",
    "coenzyme_q10",
    "multivitamin_multimineral",
    "milk_thistle_silymarin",
    "vitamin_d",
    "calcium",
    "vitamin_c",
  ],
} as const;

export const studyIngredientIdSet = new Set<string>(studyScope.ingredientIds);
