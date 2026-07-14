import { describe, expect, it } from "vitest";
import { finalValidationBundles, finalValidationEvidence } from "@/src/lib/final-research-validation";

describe("final research validation", () => {
  it("bundles the remaining agent research into one approval event", () => {
    expect(finalValidationBundles).toHaveLength(5);
    expect(new Set(finalValidationBundles.map((bundle) => bundle.id)).size).toBe(5);
  });
  it("preserves the human and completion boundaries", () => {
    expect(finalValidationEvidence.pubmed_records).toBe(19619);
    expect(finalValidationEvidence.numeric_candidates).toBe(144);
    expect(finalValidationEvidence.numeric_context_complete).toBe(144);
    expect(finalValidationEvidence.independent_reviewers_completed).toBe(0);
    expect(finalValidationEvidence.human_individual_decisions_recorded).toBe(0);
    expect(finalValidationEvidence.final_search_claim_allowed).toBe(false);
    expect(finalValidationEvidence.research_complete).toBe(false);
  });
});
