import { createHash } from "node:crypto";

type Row = Record<string, unknown>;

const SHA256 = /^[0-9a-f]{64}$/;

function text(row: Row, field: string, location: string) {
  const value = row[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${location}: ${field} must be a non-empty string`);
  }
  return value;
}

function stringArray(row: Row, field: string, location: string) {
  const value = row[field];
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${location}: ${field} must be a non-empty string array`);
  }
  return value as string[];
}

function index(rows: Row[], idField: string, label: string) {
  const result = new Map<string, Row>();
  rows.forEach((row, position) => {
    const id = text(row, idField, `${label}[${position}]`);
    if (result.has(id)) throw new Error(`duplicate ${idField}: ${id}`);
    result.set(id, row);
  });
  return result;
}

function requireSha(value: string, location: string) {
  if (!SHA256.test(value)) throw new Error(`${location}: invalid SHA-256`);
}

export function assertValidatedThesisProvenance(input: {
  sources: Row[];
  reports: Row[];
  extractions: Row[];
  certaintyAssessments: Row[];
  claims: Row[];
  rules: Row[];
}) {
  const sources = index(input.sources, "source_id", "sources");
  const reports = index(input.reports, "report_id", "reports");
  const extractions = index(input.extractions, "extraction_id", "extractions");
  const certaintyAssessments = index(input.certaintyAssessments, "certainty_assessment_id", "certaintyAssessments");
  const claims = index(input.claims, "claim_id", "claims");

  for (const [claimId, claim] of claims) {
    const location = `claim ${claimId}`;
    if (text(claim, "verification_status", location) !== "validated") throw new Error(`${location}: not validated`);
    if (text(claim, "scope_status", location) !== "validated_thesis_scope") throw new Error(`${location}: outside thesis scope`);
    stringArray(claim, "verified_by", location);
    const questionId = text(claim, "question_id", location);
    const certaintyId = text(claim, "certainty_assessment_id", location);
    const certainty = certaintyAssessments.get(certaintyId);
    if (!certainty) throw new Error(`${location}: missing certainty assessment`);
    if (certainty.question_id !== questionId || certainty.verification_status !== "validated" || certainty.certainty !== claim.certainty) {
      throw new Error(`${location}: certainty assessment mismatch or not validated`);
    }
    const support = claim.support;
    if (!Array.isArray(support) || support.length === 0) throw new Error(`${location}: support required`);
    support.forEach((value, position) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${location}: invalid support`);
      const item = value as Row;
      const supportLocation = `${location} support[${position}]`;
      const sourceId = text(item, "source_id", supportLocation);
      const reportId = text(item, "report_id", supportLocation);
      const extractionId = text(item, "extraction_id", supportLocation);
      const sourcePath = text(item, "source_path", supportLocation);
      const sourceSha = text(item, "source_file_sha256", supportLocation);
      text(item, "locator", supportLocation);
      const quote = text(item, "supporting_quote", supportLocation);
      const quoteSha = text(item, "supporting_quote_sha256", supportLocation);
      requireSha(sourceSha, supportLocation);
      requireSha(text(item, "locator_text_sha256", supportLocation), supportLocation);
      requireSha(quoteSha, supportLocation);
      if (sourcePath.includes("legacy_unverified") || sourcePath.includes("synthetic_fixture")) throw new Error(`${supportLocation}: forbidden source namespace`);
      if (createHash("sha256").update(quote, "utf8").digest("hex") !== quoteSha) throw new Error(`${supportLocation}: quote hash mismatch`);
      stringArray(item, "human_verified_by", supportLocation);
      const source = sources.get(sourceId);
      const report = reports.get(reportId);
      const extraction = extractions.get(extractionId);
      if (!source || !report || !extraction) throw new Error(`${supportLocation}: missing source/report/extraction`);
      if (source.source_path !== sourcePath || source.source_file_sha256 !== sourceSha) throw new Error(`${supportLocation}: source row mismatch`);
      if (report.source_id !== sourceId || extraction.source_id !== sourceId) throw new Error(`${supportLocation}: upstream source mismatch`);
      if (report.question_id !== questionId || extraction.question_id !== questionId || extraction.report_id !== reportId) throw new Error(`${supportLocation}: upstream question/report mismatch`);
      if (extraction.locator !== item.locator || extraction.locator_text_sha256 !== item.locator_text_sha256 || extraction.supporting_quote !== quote || extraction.supporting_quote_sha256 !== quoteSha) {
        throw new Error(`${supportLocation}: extraction support mismatch`);
      }
      if (source.verification_status !== "validated" || report.verification_status !== "validated" || extraction.verification_status !== "validated") throw new Error(`${supportLocation}: upstream row not validated`);
    });
  }

  for (const rule of input.rules) {
    const ruleId = text(rule, "rule_id", "rule");
    const location = `rule ${ruleId}`;
    if (text(rule, "scope_status", location) !== "validated_thesis_scope" || text(rule, "validation_status", location) !== "validated") {
      throw new Error(`${location}: validated thesis status required`);
    }
    const questionId = text(rule, "question_id", location);
    const linkedClaims = stringArray(rule, "claim_ids", location).map((claimId) => claims.get(claimId));
    if (linkedClaims.some((claim) => !claim)) throw new Error(`${location}: missing validated claim`);
    if (linkedClaims.some((claim) => claim?.question_id !== questionId)) throw new Error(`${location}: claim question mismatch`);
    const evidence = stringArray(rule, "validation_evidence", location);
    if (!evidence.some((item) => item.startsWith("expert_review:"))) throw new Error(`${location}: expert review missing`);
    if (!evidence.some((item) => item.startsWith("independent_scenario:"))) throw new Error(`${location}: independent scenario missing`);
  }
}
