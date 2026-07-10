import { z } from "zod";

export const THESIS_SCOPE = "validated_thesis_scope" as const;

const optionalText = z.string().trim().min(1).nullable().optional();

export const thesisProfileSchema = z
  .object({
    age: z.number().int().nonnegative().nullable().optional(),
    sex: optionalText,
    pregnancyStatus: optionalText,
    lactationStatus: optionalText,
    smokerStatus: optionalText,
    medications: z.array(z.string().trim().min(1)).default([]),
    conditions: z.array(z.string().trim().min(1)).default([]),
    allergies: z.array(z.string().trim().min(1)).default([]),
    jurisdiction: z.string().trim().min(1).default("KR"),
  })
  .passthrough()
  .default({
    medications: [],
    conditions: [],
    allergies: [],
    jurisdiction: "KR",
  });

export const thesisCandidateItemSchema = z
  .object({
    name: z.string().trim().min(1),
    ingredientId: optionalText,
    form: optionalText,
    dailyIntakeValue: z.number().nonnegative().nullable().optional(),
    dailyIntakeUnit: optionalText,
  })
  .passthrough();

export const thesisQuerySchema = z
  .object({
    profile: thesisProfileSchema,
    candidateItems: z.array(thesisCandidateItemSchema).default([]),
  })
  .passthrough();

const bundleRecordSchema = z.record(z.string(), z.unknown());

export const thesisBundleSchema = z.object({
  meta: z.object({
    schemaVersion: z.string().min(1),
    bundleVersion: z.string().min(1),
    engineCommit: z.string().min(1),
    sourceNamespace: z.literal("data/curated"),
    scope: z.literal(THESIS_SCOPE),
    generationMode: z.literal("deterministic"),
    sourceCount: z.number().int().nonnegative(),
    reportCount: z.number().int().nonnegative(),
    studyCount: z.number().int().nonnegative(),
    extractionCount: z.number().int().nonnegative(),
    riskOfBiasCount: z.number().int().nonnegative(),
    claimCount: z.number().int().nonnegative(),
    ruleCount: z.number().int().nonnegative(),
  }),
  sources: z.array(bundleRecordSchema),
  reports: z.array(bundleRecordSchema),
  studies: z.array(bundleRecordSchema),
  extractions: z.array(bundleRecordSchema),
  riskOfBias: z.array(bundleRecordSchema),
  claims: z.array(bundleRecordSchema),
  rules: z.array(bundleRecordSchema),
});

export const thesisEngineResponseSchema = z.object({
  request_id: z.string().regex(/^req_[a-f0-9]{24}$/),
  bundle_version: z.string().min(1),
  engine_commit: z.string().min(1),
  normalized_input: z.record(z.string(), z.unknown()),
  actions: z.array(z.record(z.string(), z.unknown())),
  missing_information: z.array(z.string()),
  matched_rules: z.array(z.record(z.string(), z.unknown())),
  evidence_claims: z.array(z.record(z.string(), z.unknown())),
  limitations: z.array(z.string()),
  scope: z.literal(THESIS_SCOPE),
});

export type ThesisQuery = z.infer<typeof thesisQuerySchema>;
export type ThesisBundle = z.infer<typeof thesisBundleSchema>;
export type ThesisEngineResponse = z.infer<typeof thesisEngineResponseSchema>;
