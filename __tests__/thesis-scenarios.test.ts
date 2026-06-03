import knowledgeIndexJson from "@/src/generated/knowledge-index.json";
import { runSafetyEngine } from "@/src/lib/safety-engine";
import { knowledgeIndexSchema, type EngineQuery } from "@/src/types/knowledge";
import { describe, expect, it } from "vitest";

const knowledgeIndex = knowledgeIndexSchema.parse(knowledgeIndexJson);

function matchedRuleIds(query: EngineQuery) {
  const response = runSafetyEngine(query, knowledgeIndex);
  return {
    response,
    definite: new Set(response.definitely_matched.map((match) => match.ruleId)),
    active: new Set([
      ...response.definitely_matched,
      ...response.possibly_relevant,
      ...response.needs_more_info,
    ].map((match) => match.ruleId)),
  };
}

describe("Ye thesis scenario evidence checks", () => {
  it("matches warfarin and vitamin K consistency rule", () => {
    const { response, definite } = matchedRuleIds({
      profile: {
        medications: ["warfarin"],
        conditions: ["anticoagulant use"],
        jurisdiction: "US",
        strictestMode: true,
      },
      candidateItems: [
        { ingredientId: "vitamin_k", name: "vitamin K", dailyIntakeValue: 120, dailyIntakeUnit: "mcg/day" },
      ],
      sort: "severity_desc",
    });

    expect(definite.has("RULE-VITK-WARFARIN-CONSISTENCY")).toBe(true);
    expect(response.totalCounts.definitely_matched).toBeGreaterThanOrEqual(1);
  });

  it("matches anticoagulant and high dose omega-3 rules", () => {
    const { response, active } = matchedRuleIds({
      profile: {
        medications: ["warfarin"],
        conditions: ["anticoagulant use", "cardiovascular disease"],
        jurisdiction: "US",
        strictestMode: true,
      },
      candidateItems: [
        { ingredientId: "omega3_epa_dha", name: "fish oil", dailyIntakeValue: 4000, dailyIntakeUnit: "mg/day" },
      ],
      sort: "severity_desc",
    });

    expect(active.has("RULE-OMEGA3-WARFARIN-MONITOR")).toBe(true);
    expect(active.has("RULE-OMEGA3-AF-HIGHRISK")).toBe(true);
    expect(response.totalCounts.definitely_matched).toBeGreaterThanOrEqual(2);
  });

  it("matches kidney stone calcium risk rules", () => {
    const { response, active } = matchedRuleIds({
      profile: {
        age: 55,
        sex: "female",
        conditions: ["history_of_kidney_stones", "hypercalciuria"],
        jurisdiction: "US",
        strictestMode: true,
      },
      candidateItems: [
        {
          ingredientId: "calcium",
          name: "calcium carbonate",
          dailyIntakeValue: 1200,
          dailyIntakeUnit: "mg/day",
          coingredients: ["vitamin_d"],
        },
      ],
      sort: "severity_desc",
    });

    expect(active.has("RULE-CALCIUM-STONE-HISTORY")).toBe(true);
    expect(active.has("RULE-CALCIUM-VITD-POSTMENOPAUSAL-STONE")).toBe(true);
    expect(response.totalCounts.definitely_matched).toBeGreaterThanOrEqual(2);
  });

  it("matches kidney stone and high dose vitamin D rules", () => {
    const { response, active } = matchedRuleIds({
      profile: {
        age: 55,
        conditions: ["history_of_kidney_stones", "hypercalciuria"],
        jurisdiction: "US",
        strictestMode: true,
      },
      candidateItems: [
        {
          ingredientId: "vitamin_d",
          name: "vitamin D3",
          dailyIntakeValue: 5000,
          dailyIntakeUnit: "iu/day",
          longTermUseDays: 90,
        },
      ],
      sort: "severity_desc",
    });

    expect(active.has("RULE-VITD-UL-US-ADULT")).toBe(true);
    expect(active.has("RULE-VITD-STONE-HISTORY")).toBe(true);
    expect(response.totalCounts.definitely_matched).toBeGreaterThanOrEqual(3);
  });

  it("matches hyperoxaluria and high dose vitamin C rules", () => {
    const { response, active } = matchedRuleIds({
      profile: {
        age: 45,
        conditions: ["hyperoxaluria", "history_of_kidney_stones"],
        jurisdiction: "US",
        strictestMode: true,
      },
      candidateItems: [
        { ingredientId: "vitamin_c", name: "vitamin C", dailyIntakeValue: 1000, dailyIntakeUnit: "mg/day" },
      ],
      sort: "severity_desc",
    });

    expect(active.has("RULE-VITC-STONE-HISTORY")).toBe(true);
    expect(active.has("RULE-VITC-MALE-HIGHDose-STONE")).toBe(true);
    expect(response.totalCounts.definitely_matched).toBeGreaterThanOrEqual(2);
  });
});
