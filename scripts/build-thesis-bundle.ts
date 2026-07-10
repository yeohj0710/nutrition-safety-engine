import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertValidatedThesisProvenance } from "../src/evidence/validate-thesis-provenance";

type JsonRecord = Record<string, unknown>;

type CuratedClaim = JsonRecord & {
  claim_id: string;
  verification_status: string;
  scope_status: string;
  support: JsonRecord[];
};

type CuratedRule = JsonRecord & {
  rule_id: string;
  validation_status: string;
  scope_status: string;
  claim_ids: string[];
};

const projectRoot = process.cwd();
const curatedRoot = path.join(projectRoot, "data", "curated");

function readJsonLines(filename: string): JsonRecord[] {
  const filePath = path.join(curatedRoot, filename);
  const text = readFileSync(filePath, "utf8");

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        const value = JSON.parse(line) as unknown;
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new Error("record must be a JSON object");
        }
        return value as JsonRecord;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${filename}:${index + 1}: ${message}`);
      }
    });
}

function requireString(record: JsonRecord, field: string, location: string) {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${location}: ${field} must be a non-empty string`);
  }
  return value;
}

function requireStringArray(record: JsonRecord, field: string, location: string) {
  const value = record[field];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || item.trim().length === 0)
  ) {
    throw new Error(`${location}: ${field} must be a non-empty string array`);
  }
  return value as string[];
}

function parseClaims(records: JsonRecord[]): CuratedClaim[] {
  return records.map((record, index) => {
    const location = `claims.jsonl:${index + 1}`;
    const support = record.support;
    if (
      !Array.isArray(support) ||
      support.length === 0 ||
      support.some(
        (item) => !item || typeof item !== "object" || Array.isArray(item),
      )
    ) {
      throw new Error(`${location}: support must be a non-empty object array`);
    }
    return {
      ...record,
      claim_id: requireString(record, "claim_id", location),
      verification_status: requireString(
        record,
        "verification_status",
        location,
      ),
      scope_status: requireString(record, "scope_status", location),
      support: support as JsonRecord[],
    };
  });
}

function parseRules(records: JsonRecord[]): CuratedRule[] {
  return records.map((record, index) => {
    const location = `rules.jsonl:${index + 1}`;
    return {
      ...record,
      rule_id: requireString(record, "rule_id", location),
      validation_status: requireString(
        record,
        "validation_status",
        location,
      ),
      scope_status: requireString(record, "scope_status", location),
      claim_ids: requireStringArray(record, "claim_ids", location),
    };
  });
}

function assertUnique(values: string[], label: string) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    throw new Error(`duplicate ${label}: ${[...new Set(duplicates)].join(", ")}`);
  }
}

function readCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown-uncommitted";
  }
}

function buildThesisBundle() {
  const sources = readJsonLines("sources.jsonl");
  const reports = readJsonLines("reports.jsonl");
  const studies = readJsonLines("studies.jsonl");
  const extractions = readJsonLines("extractions.jsonl");
  const riskOfBias = readJsonLines("risk_of_bias.jsonl");
  const certaintyAssessments = readJsonLines("certainty_assessments.jsonl");
  const claims = parseClaims(readJsonLines("claims.jsonl"));
  const rules = parseRules(readJsonLines("rules.jsonl"));
  assertUnique(claims.map((claim) => claim.claim_id), "claim_id");
  assertUnique(rules.map((rule) => rule.rule_id), "rule_id");

  const validatedClaims = claims.filter(
    (claim) =>
      claim.verification_status === "validated" &&
      claim.scope_status === "validated_thesis_scope",
  );
  const validatedClaimIds = new Set(validatedClaims.map((claim) => claim.claim_id));
  const validatedRules = rules.filter(
    (rule) =>
      rule.validation_status === "validated" &&
      rule.scope_status === "validated_thesis_scope",
  );

  for (const rule of validatedRules) {
    const missingClaimIds = rule.claim_ids.filter(
      (claimId) => !validatedClaimIds.has(claimId),
    );
    if (missingClaimIds.length > 0) {
      throw new Error(
        `${rule.rule_id}: validated rule references non-validated claims: ${missingClaimIds.join(", ")}`,
      );
    }
  }
  assertValidatedThesisProvenance({
    sources,
    reports,
    extractions,
    certaintyAssessments,
    claims: validatedClaims,
    rules: validatedRules,
  });

  return {
    meta: {
      schemaVersion: "1.1.0",
      bundleVersion: "0.0.0-phase01-empty",
      engineCommit: readCommit(),
      sourceNamespace: "data/curated",
      scope: "validated_thesis_scope",
      generationMode: "deterministic",
      sourceCount: sources.length,
      reportCount: reports.length,
      studyCount: studies.length,
      extractionCount: extractions.length,
      riskOfBiasCount: riskOfBias.length,
      certaintyAssessmentCount: certaintyAssessments.length,
      claimCount: validatedClaims.length,
      ruleCount: validatedRules.length,
    },
    sources,
    reports,
    studies,
    extractions,
    riskOfBias,
    certaintyAssessments,
    claims: validatedClaims,
    rules: validatedRules,
  };
}

const outputPath = path.join(
  projectRoot,
  "src",
  "generated",
  "thesis-bundle.json",
);
mkdirSync(path.dirname(outputPath), { recursive: true });
const bundle = buildThesisBundle();
writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
console.log(
  `thesis-bundle generated: ${bundle.meta.ruleCount} validated rules, ${bundle.meta.claimCount} validated claims`,
);
