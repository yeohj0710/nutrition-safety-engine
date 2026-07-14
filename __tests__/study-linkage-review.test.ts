import { describe, expect, it } from "vitest";
import { studyLinkageReviewBundles, studyLinkageTotals } from "@/src/lib/study-linkage-review";

describe("study linkage prereview bundles", () => {
  it("matches validated prereview totals", () => {
    expect(studyLinkageReviewBundles).toHaveLength(3);
    expect(studyLinkageTotals.unique_reports).toBe(10385);
    expect(studyLinkageTotals.multi_report_components).toBe(49);
    expect(studyLinkageTotals.reports_in_multi_report_components).toBe(158);
  });
  it("preserves human and synthesis boundaries", () => {
    expect(studyLinkageTotals.human_link_decisions).toBe(0);
    expect(studyLinkageTotals.independent_reviewers_completed).toBe(0);
    expect(studyLinkageTotals.synthesis_allowed).toBe(false);
    expect(studyLinkageReviewBundles[2].safeguards.join(" ")).toContain("사람의 최종 포함 문헌");
  });
});
