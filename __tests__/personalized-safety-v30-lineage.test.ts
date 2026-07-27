import { afterAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/personalized-safety/route";
import rules from "@/research/systematic_review_v30/personalized_rules.json";

type CompatibilityRule = {
  question_id: string;
  source_question_id?: string;
  all_evidence: Array<{ record_id: string }>;
};

const originalApiKey = process.env.OPENAI_API_KEY;

afterAll(() => {
  if (originalApiKey) process.env.OPENAI_API_KEY = originalApiKey;
  else delete process.env.OPENAI_API_KEY;
});

describe("v3.0 personalized-safety evidence lineage", () => {
  it.each([
    ["비타민 K", "A1", "HRS5_ANTICOAGULATION"],
    ["오메가-3", "A2", "HRS5_ANTICOAGULATION"],
    ["칼슘", "B1", "HRS2_KIDNEY_DISEASE"],
    ["비타민 D", "B2", "HRS2_KIDNEY_DISEASE"],
    ["비타민 C", "B3", "HRS2_KIDNEY_DISEASE"],
  ])(
    "returns only the new %s compatibility-rule evidence",
    async (ingredient, questionId, sourceQuestionId) => {
      delete process.env.OPENAI_API_KEY;
      const compatibilityRule = (rules as CompatibilityRule[]).find(
        (rule) => rule.question_id === questionId,
      );
      expect(compatibilityRule?.source_question_id).toBe(sourceQuestionId);

      const response = await POST(
        new Request("http://local/api/personalized-safety", {
          method: "POST",
          body: JSON.stringify({ ingredient, dose: "용량 모름" }),
        }),
      );
      const body = await response.json();
      const allowedRecordIds = new Set(
        compatibilityRule?.all_evidence.map((item) => item.record_id),
      );

      expect(response.status).toBe(200);
      expect(body.question_id).toBe(questionId);
      expect(body.evidence_lineage).toEqual({
        track: "v3.0_full_ai_autonomy",
        source_question_id: sourceQuestionId,
      });
      expect(body.evidence.length).toBeGreaterThan(0);
      expect(body.all_evidence.length).toBe(allowedRecordIds.size);
      expect(
        body.all_evidence.every((item: { record_id: string }) =>
          allowedRecordIds.has(item.record_id),
        ),
      ).toBe(true);
      expect(
        body.evidence.every((item: { record_id: string }) =>
          item.record_id.startsWith("pubmed:") &&
          allowedRecordIds.has(item.record_id),
        ),
      ).toBe(true);
    },
  );
});
