import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertValidatedThesisProvenance } from "@/src/evidence/validate-thesis-provenance";

const quote = "Synthetic unit-test quote only.";
const quoteSha = createHash("sha256").update(quote).digest("hex");

function fixture() {
  const sourcePath = "data/curated/source.xml";
  const sourceSha = "1".repeat(64);
  return {
    sources: [{ source_id: "SRC-1", source_path: sourcePath, source_file_sha256: sourceSha, verification_status: "validated" }],
    reports: [{ report_id: "RPT-1", source_id: "SRC-1", question_id: "A1", verification_status: "validated" }],
    extractions: [{ extraction_id: "EXT-1", report_id: "RPT-1", source_id: "SRC-1", question_id: "A1",
      locator: "body//p[1]", locator_text_sha256: "2".repeat(64), supporting_quote: quote,
      supporting_quote_sha256: quoteSha, verification_status: "validated" }],
    certaintyAssessments: [{ certainty_assessment_id: "GRADE-1", question_id: "A1", certainty: "low", verification_status: "validated" }],
    claims: [{
      claim_id: "CLM-1", question_id: "A1", verification_status: "validated", scope_status: "validated_thesis_scope",
      verified_by: ["REV-1"], certainty: "low", certainty_assessment_id: "GRADE-1",
      support: [{ source_id: "SRC-1", report_id: "RPT-1", extraction_id: "EXT-1", source_path: sourcePath,
        source_file_sha256: sourceSha, locator: "body//p[1]", locator_text_sha256: "2".repeat(64),
        supporting_quote: quote, supporting_quote_sha256: quoteSha, human_verified_by: ["REV-1"] }],
    }],
    rules: [{ rule_id: "RUL-1", question_id: "A1", scope_status: "validated_thesis_scope", validation_status: "validated",
      claim_ids: ["CLM-1"], validation_evidence: ["expert_review:REV-2", "independent_scenario:GOLD-1"] }],
  };
}

describe("validated thesis provenance contract", () => {
  it("accepts a fully linked validated fixture", () => {
    expect(() => assertValidatedThesisProvenance(fixture())).not.toThrow();
  });

  it.each([
    ["legacy source", (value: ReturnType<typeof fixture>) => { value.claims[0].support[0].source_path = "data/legacy_unverified/source.xml"; }],
    ["wrong quote hash", (value: ReturnType<typeof fixture>) => { value.claims[0].support[0].supporting_quote_sha256 = "f".repeat(64); }],
    ["missing extraction", (value: ReturnType<typeof fixture>) => { value.extractions = []; }],
    ["missing certainty", (value: ReturnType<typeof fixture>) => { value.certaintyAssessments = []; }],
    ["extraction locator mismatch", (value: ReturnType<typeof fixture>) => { value.extractions[0].locator = "body//p[2]"; }],
    ["question mismatch", (value: ReturnType<typeof fixture>) => { value.rules[0].question_id = "B1"; }],
    ["missing expert review", (value: ReturnType<typeof fixture>) => { value.rules[0].validation_evidence = ["independent_scenario:GOLD-1"]; }],
  ])("rejects %s", (_label, mutate) => {
    const value = fixture();
    mutate(value);
    expect(() => assertValidatedThesisProvenance(value)).toThrow();
  });
});
