import { describe, expect, it } from "vitest";
import { thesisBundleSchema } from "@/src/domain/thesis";
import { runThesisEngineWithBundle } from "@/src/engine/run-thesis-engine";

function bundle() {
  const claim = (id: string) => ({ claim_id: id, claim_text: `Synthetic matcher claim ${id}`,
    certainty: "low", verification_status: "validated", scope_status: "validated_thesis_scope" });
  return thesisBundleSchema.parse({
    meta: { schemaVersion: "test", bundleVersion: "synthetic-matcher-only", engineCommit: "test",
      sourceNamespace: "data/curated", scope: "validated_thesis_scope", generationMode: "deterministic",
      sourceCount: 0, reportCount: 0, studyCount: 0, extractionCount: 0, riskOfBiasCount: 0,
      certaintyAssessmentCount: 0, claimCount: 3, ruleCount: 3 },
    sources: [], reports: [], studies: [], extractions: [], riskOfBias: [], certaintyAssessments: [],
    claims: [claim("CLM-A"), claim("CLM-B"), claim("CLM-C")],
    rules: [
      { rule_id: "RUL-B", question_id: "A1", action_class: "information_only", severity: "low",
        message_template: "Synthetic information action.", claim_ids: ["CLM-B"],
        conditions: { candidate_item_names_any: ["vitamin K"], medications_any: ["warfarin"] } },
      { rule_id: "RUL-A", question_id: "A1", action_class: "pharmacist_review", severity: "high",
        message_template: "Synthetic pharmacist review action.", claim_ids: ["CLM-A"],
        conditions: { candidate_item_names_any: ["vitamin K"], jurisdictions_any: ["KR"] } },
      { rule_id: "RUL-C", question_id: "A2", action_class: "urgent_referral", severity: "critical",
        message_template: "Must not partial-match.", claim_ids: ["CLM-C"],
        conditions: { candidate_item_names_any: ["vitamin"] } },
    ],
  });
}

const input = { profile: { age: 40, medications: ["WARFARIN"], conditions: [], allergies: [], jurisdiction: "kr" },
  candidateItems: [{ name: "Vitamin K", dailyIntakeValue: 100, dailyIntakeUnit: "mcg" }] };

describe("deterministic validated-rule matcher contract", () => {
  it("matches exact normalized terms, orders actions, and resolves claims", () => {
    const result = runThesisEngineWithBundle(input, bundle());
    expect(result.matched_rules.map((row) => row.rule_id)).toEqual(["RUL-A", "RUL-B"]);
    expect(result.actions.map((row) => row.action_class)).toEqual(["pharmacist_review", "information_only"]);
    expect(result.evidence_claims.map((row) => row.claim_id)).toEqual(["CLM-A", "CLM-B"]);
  });

  it("is byte-deterministic and rejects partial-string false positives", () => {
    const first = runThesisEngineWithBundle(input, bundle());
    const second = runThesisEngineWithBundle(input, bundle());
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.matched_rules.some((row) => row.rule_id === "RUL-C")).toBe(false);
  });

  it("rejects unknown rule-condition fields", () => {
    const value = bundle();
    value.rules[0].conditions = { synthetic_unknown: true };
    expect(() => runThesisEngineWithBundle(input, value)).toThrow();
  });
});
