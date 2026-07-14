import { describe, expect, it } from "vitest";
import { prereviewTotals, screeningPrereviewBundles } from "@/src/lib/pubmed-screening-prereview";

describe("PubMed screening agent prereview bundles", () => {
  it("covers every question and source unit", () => {
    expect(screeningPrereviewBundles.map((bundle) => bundle.questionId)).toEqual(["A1", "A2", "B1", "B2", "B3"]);
    expect(prereviewTotals.uniqueRecords).toBe(19619);
    expect(prereviewTotals.recordQuestionUnits).toBe(19971);
  });

  it("keeps missing abstracts and human authority safeguards visible", () => {
    expect(screeningPrereviewBundles.reduce((total, bundle) => total + bundle.counts.abstractMissing, 0)).toBe(1946);
    expect(screeningPrereviewBundles.every((bundle) => bundle.safeguards.some((text) => text.includes("초록 없는")))).toBe(true);
    expect(prereviewTotals.humanScreeningDecisions).toBe(0);
    expect(prereviewTotals.independentReviewersCompleted).toBe(0);
  });
});
