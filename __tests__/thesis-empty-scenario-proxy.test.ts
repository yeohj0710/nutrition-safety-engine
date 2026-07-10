import { describe, expect, it } from "vitest";

import { runThesisEngine } from "@/src/engine/run-thesis-engine";

const questions = ["A1", "A2", "B1", "B2", "B3"] as const;
const ingredients = ["vitamin K", "omega-3 EPA", "calcium", "vitamin D", "vitamin C"];
const medications = ["warfarin", "apixaban", "", "thiazide", ""];
const conditions = ["bleeding symptom", "atrial fibrillation", "calcium oxalate stone", "hypercalciuria", "hyperoxaluria"];

const scenarios = Array.from({ length: 120 }, (_, index) => {
  const questionIndex = index % questions.length;
  return {
    scenarioId: `SYNTH-${String(index + 1).padStart(3, "0")}`,
    questionId: questions[questionIndex],
    input: {
      profile: {
        age: index % 7 === 0 ? null : 18 + (index % 73),
        sex: index % 3 === 0 ? null : index % 2 === 0 ? "female" : "male",
        medications: medications[questionIndex] ? [medications[questionIndex]] : [],
        conditions: [conditions[questionIndex]],
        allergies: [],
        jurisdiction: "KR",
      },
      candidateItems: [
        {
          name: ingredients[questionIndex],
          dailyIntakeValue: index % 11 === 0 ? 0 : 100 + index,
          dailyIntakeUnit: index % 4 === 0 ? "IU" : "mg",
        },
      ],
    },
  };
});

describe("safe-empty thesis scenario proxy", () => {
  it("keeps 120 synthetic scenarios deterministic and free of legacy results", () => {
    expect(scenarios).toHaveLength(120);
    for (const scenario of scenarios) {
      const outputs = Array.from({ length: 3 }, () => runThesisEngine(scenario.input));
      expect(outputs[1]).toEqual(outputs[0]);
      expect(outputs[2]).toEqual(outputs[0]);
      expect(outputs[0].scope).toBe("validated_thesis_scope");
      expect(outputs[0].actions).toEqual([]);
      expect(outputs[0].matched_rules).toEqual([]);
      expect(outputs[0].evidence_claims).toEqual([]);
      expect(JSON.stringify(outputs[0])).not.toContain("legacy_unverified");
    }
  });
});
