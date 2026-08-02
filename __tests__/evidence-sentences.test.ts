import { describe, expect, it } from "vitest";
import rules from "@/research/systematic_review_v40/personalized_rules.json";
import {
  deriveEvidenceSource,
  flattenTranslatedFindings,
  splitEvidenceSentences,
} from "@/src/lib/evidence-sentences";

type EvidenceFixture = { record_id: string; key_finding_ko: string };
type RuleFixture = {
  personalization_axis: string;
  all_evidence: EvidenceFixture[];
};

const allRules = rules as unknown as RuleFixture[];

describe("evidence sentence presentation", () => {
  it("splits an actual multi-sentence core finding without splitting decimals", () => {
    const fixture = allRules
      .find((rule) => rule.personalization_axis === "base")!
      .all_evidence.find((item) => item.record_id === "pubmed:36580029")!;

    const sentences = splitEvidenceSentences(fixture.key_finding_ko);
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toContain("0.7 g/dL");
    expect(sentences[0]).toContain("0.1 g/dL");
    expect(sentences[1]).toContain("0.5 units/patient");
    expect(sentences[1]).toContain("1.2 units/pt");
  });

  it("does not split common abbreviations or decimal values", () => {
    expect(
      splitEvidenceSentences(
        "Dr. Kim reported 0.7 mg, e.g., in the first group. The result remained stable.",
      ),
    ).toEqual([
      "Dr. Kim reported 0.7 mg, e.g., in the first group.",
      "The result remained stable.",
    ]);
  });

  it("uses the sentence embedded in a locator when key_finding is blank", () => {
    expect(
      deriveEvidenceSource(
        "",
        "ABSTRACT_SENTENCE_8: The observed value was 0.7 mg.",
      ),
    ).toEqual({
      sourceLocator: "ABSTRACT_SENTENCE_8",
      sourceSentence: "The observed value was 0.7 mg.",
    });
  });

  it("flattens papers before taking the first three displayed sentences", () => {
    const baseEvidence = allRules.find(
      (rule) => rule.personalization_axis === "base",
    )!.all_evidence;
    const multiSentence = baseEvidence.find(
      (item) => item.record_id === "pubmed:36580029",
    )!;
    const nextPaper = baseEvidence.find(
      (item) => item.record_id !== multiSentence.record_id,
    )!;

    const flattened = flattenTranslatedFindings([multiSentence, nextPaper]);
    expect(flattened.slice(0, 3)).toHaveLength(3);
    expect(flattened.slice(0, 3).map((item) => item.paperNumber)).toEqual([
      1, 1, 2,
    ]);
    expect(flattened[0].sentence).not.toBe(flattened[1].sentence);
  });
});
