import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import {
  confidenceSchema,
  type IngredientRecord,
  ingredientRecordSchema,
  knowledgeIndexSchema,
  knowledgeSourceSchema,
  type JsonValue,
  type KnowledgeIndex,
  type RuleCondition,
  safetyRuleSchema,
} from "@/src/types/knowledge";

type RawSource = {
  source_id: string;
  title: string;
  source_type: string;
  organization?: string | null;
  jurisdiction?: string | null;
  publication_year?: number | null;
  publication_date?: string | null;
  url?: string | null;
  doi?: string | null;
  pmid?: string | null;
  authors?: string[] | string | null;
  journal?: string | null;
  evidence_tier?: string | null;
  [key: string]: unknown;
};

type RawIngredient = {
  ingredient_id: string;
  ingredient_name_ko: string;
  ingredient_name_en?: string | null;
  category?: string | null;
  forms?: string[] | null;
  matching_aliases_ko?: string[] | null;
  matching_aliases_en?: string[] | null;
  quality_notes_ko?: string | null;
};

type RawEvidenceChunk = {
  chunk_id: string;
  source_id: string;
  ingredient_ids?: string[] | null;
  locator_type?: string | null;
  locator_value?: string | null;
  excerpt_summary_ko?: string | null;
  claim_type?: string | null;
  structured_claim?: Record<string, unknown> | null;
  confidence?: string | null;
  notes_ko?: string | null;
};

type RawRule = {
  rule_id: string;
  rule_group_id?: string | null;
  ingredient_id: string;
  rule_name_ko: string;
  rule_category: string;
  severity: string;
  priority: number;
  jurisdiction?: string | null;
  applies_when?: Record<string, unknown>;
  threshold_operator?: string | null;
  threshold_value?: number | null;
  threshold_unit?: string | null;
  threshold_scope?: string | null;
  action_text_ko: string;
  rationale_ko: string;
  monitoring_ko?: string | null;
  exception_ko?: string | null;
  evidence_chunk_ids?: string[] | null;
  source_ids?: string[] | null;
  review_status?: string | null;
  [key: string]: unknown;
};

type RawKnowledgePack = {
  package_meta?: {
    package_name?: string;
    version?: string;
    generated_at?: string;
    description_ko?: string;
  };
  sources?: RawSource[];
  ingredients?: RawIngredient[];
  evidence_chunks?: RawEvidenceChunk[];
  safety_rules?: RawRule[];
};

function splitAuthors(authors: RawSource["authors"]) {
  if (!authors) {
    return [];
  }

  if (Array.isArray(authors)) {
    return authors.filter(Boolean);
  }

  return authors
    .split(/[,;|]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function inferConfidence(rule: RawRule, chunks: RawEvidenceChunk[]) {
  if (rule.review_status === "starter_validated") {
    return confidenceSchema.parse("high");
  }

  if (rule.review_status === "starter_hypothesis") {
    return confidenceSchema.parse("low");
  }

  const confidences = chunks
    .map((chunk) => chunk.confidence)
    .filter((value): value is string => Boolean(value));

  if (confidences.includes("high")) {
    return confidenceSchema.parse("high");
  }

  if (confidences.includes("medium")) {
    return confidenceSchema.parse("medium");
  }

  if (confidences.includes("low")) {
    return confidenceSchema.parse("low");
  }

  return confidenceSchema.parse("unknown");
}

function conditionLabelKo(field: string) {
  switch (field) {
    case "age_years":
      return "연령 조건";
    case "candidate_daily_intake":
      return "일일 섭취량 조건";
    case "candidate_products_any":
      return "제품 유형 조건";
    case "coingredients_any":
      return "동시 성분 조건";
    case "devices_any":
      return "의료기기 조건";
    case "diseases_any":
      return "질환 조건";
    case "exposure_any":
      return "노출 이력 조건";
    case "immune_status_any":
      return "면역 상태 조건";
    case "ingredient_forms_any":
      return "성분 제형 조건";
    case "jurisdiction_preference_any":
      return "관할권 조건";
    case "long_term_use_days":
      return "장기 복용 조건";
    case "medications_any":
    case "or_medications_any":
      return "약물 상호작용 조건";
    case "or_lactating":
      return "수유 조건";
    case "or_pregnant_or_lactating":
      return "임신 또는 수유 조건";
    case "or_use_general":
      return "일반 사용 경고";
    case "population_any":
      return "특정 인구집단 조건";
    case "pregnancy_status_any":
      return "임신 상태 조건";
    case "same_day":
      return "같은 날 복용 조건";
    case "smoking_status_any":
      return "흡연 상태 조건";
    default:
      return `${field} 조건`;
  }
}

function buildRequirementGroup(field: string, appliesWhen: Record<string, unknown>) {
  const has = (candidate: string) => Object.prototype.hasOwnProperty.call(appliesWhen, candidate);

  if ((field === "pregnancy_status_any" || field === "or_lactating") && has("pregnancy_status_any") && has("or_lactating")) {
    return "pregnancy_or_lactation";
  }

  if (
    (field === "population_any" || field === "or_pregnant_or_lactating") &&
    has("population_any") &&
    has("or_pregnant_or_lactating")
  ) {
    return "population_or_pregnancy";
  }

  if ((field === "diseases_any" || field === "or_medications_any") && has("diseases_any") && has("or_medications_any")) {
    return "disease_or_medication";
  }

  if ((field === "diseases_any" || field === "or_use_general") && has("diseases_any") && has("or_use_general")) {
    return "disease_or_general_use";
  }

  if ((field === "smoking_status_any" || field === "exposure_any") && has("smoking_status_any") && has("exposure_any")) {
    return "smoking_or_exposure";
  }

  if ((field === "immune_status_any" || field === "devices_any") && has("immune_status_any") && has("devices_any")) {
    return "immune_or_device";
  }

  return field;
}

function buildRuleConditions(appliesWhen: Record<string, unknown>): RuleCondition[] {
  return Object.entries(appliesWhen).map(([field, value]) => ({
    id: `${field}:${JSON.stringify(value)}`,
    field,
    operator: Array.isArray(value) ? "includes_any" : typeof value === "object" && value ? "structured" : "equals",
    value: value as JsonValue,
    requirementGroup: buildRequirementGroup(field, appliesWhen),
    labelKo: conditionLabelKo(field),
  }));
}

function buildIngredientRecord(rawIngredient: RawIngredient) {
  const aliases = [
    rawIngredient.ingredient_name_ko,
    rawIngredient.ingredient_name_en ?? "",
    ...(rawIngredient.forms ?? []),
    ...(rawIngredient.matching_aliases_ko ?? []),
    ...(rawIngredient.matching_aliases_en ?? []),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return ingredientRecordSchema.parse({
    id: rawIngredient.ingredient_id,
    nameKo: rawIngredient.ingredient_name_ko,
    nameEn: rawIngredient.ingredient_name_en ?? null,
    category: rawIngredient.category ?? null,
    forms: rawIngredient.forms ?? [],
    aliases: [...new Set(aliases)],
    qualityNotes: rawIngredient.quality_notes_ko ?? null,
  });
}

function buildSafetyRule(
  rawRule: RawRule,
  ingredient: IngredientRecord | undefined,
  evidenceChunks: RawEvidenceChunk[],
  generatedAt: string,
) {
  const appliesWhen = rawRule.applies_when ?? {};
  const medicationsAny = Array.isArray(appliesWhen.medications_any) ? appliesWhen.medications_any : [];
  const orMedicationsAny = Array.isArray(appliesWhen.or_medications_any) ? appliesWhen.or_medications_any : [];
  const diseasesAny = Array.isArray(appliesWhen.diseases_any) ? appliesWhen.diseases_any : [];
  const pregnancyValues = Array.isArray(appliesWhen.pregnancy_status_any) ? appliesWhen.pregnancy_status_any : [];
  const smokerValues = Array.isArray(appliesWhen.smoking_status_any) ? appliesWhen.smoking_status_any : [];
  const ageRule = typeof appliesWhen.age_years === "object" && appliesWhen.age_years ? (appliesWhen.age_years as { min?: number; max?: number }) : {};
  const ingredientFormsAny = Array.isArray(appliesWhen.ingredient_forms_any) ? appliesWhen.ingredient_forms_any : [];

  return safetyRuleSchema.parse({
    id: rawRule.rule_id,
    groupId: rawRule.rule_group_id ?? null,
    ingredientId: rawRule.ingredient_id,
    nutrientOrIngredient: ingredient?.nameKo ?? rawRule.ingredient_id,
    nutrientForm: ingredientFormsAny.length === 1 ? String(ingredientFormsAny[0]) : null,
    ruleCategory: rawRule.rule_category,
    severity: rawRule.severity,
    priority: rawRule.priority,
    jurisdiction: rawRule.jurisdiction ?? null,
    populationTags: Array.isArray(appliesWhen.population_any)
      ? appliesWhen.population_any.map((value) => String(value))
      : [],
    conditions: buildRuleConditions(appliesWhen),
    threshold: rawRule.threshold_value ?? null,
    thresholdOperator: rawRule.threshold_operator ?? null,
    unit: rawRule.threshold_unit ?? null,
    scope: rawRule.threshold_scope ?? null,
    messageShort: rawRule.action_text_ko,
    messageLong: rawRule.rationale_ko,
    action: rawRule.action_text_ko,
    contraindications: rawRule.severity === "contraindicated" ? [rawRule.action_text_ko] : [],
    interactionDrugs: [...new Set([...medicationsAny, ...orMedicationsAny].map((value) => String(value)))],
    interactionDiseases: [...new Set(diseasesAny.map((value) => String(value)))],
    pregnancyFlag: pregnancyValues.length > 0 || appliesWhen.or_pregnant_or_lactating === true ? true : null,
    lactationFlag: appliesWhen.or_lactating === true || appliesWhen.or_pregnant_or_lactating === true ? true : null,
    smokerFlag: smokerValues.length > 0 ? true : null,
    ageMin: typeof ageRule.min === "number" ? ageRule.min : null,
    ageMax: typeof ageRule.max === "number" ? ageRule.max : null,
    sex: null,
    evidenceChunkIds: rawRule.evidence_chunk_ids ?? [],
    sourceIds: rawRule.source_ids ?? [],
    confidence: inferConfidence(rawRule, evidenceChunks),
    lastReviewedAt: generatedAt,
    outcome: {
      action: rawRule.action_text_ko,
      messageShort: rawRule.action_text_ko,
      messageLong: rawRule.rationale_ko,
      monitoring: rawRule.monitoring_ko ?? null,
      exception: rawRule.exception_ko ?? null,
    },
    rawAppliesWhen: appliesWhen,
    raw: rawRule,
  });
}

async function readKnowledgePack(projectRoot: string) {
  const knowledgePackPath = path.join(projectRoot, "data", "knowledge_pack.json");

  try {
    const knowledgePackRaw = await readFile(knowledgePackPath, "utf8");
    return JSON.parse(knowledgePackRaw) as RawKnowledgePack;
  } catch {
    const [sourcesRaw, ingredientsRaw, evidenceRaw, rulesRaw] = await Promise.all([
      readFile(path.join(projectRoot, "data", "source_registry.json"), "utf8"),
      readFile(path.join(projectRoot, "data", "ingredients.json"), "utf8"),
      readFile(path.join(projectRoot, "data", "evidence_chunks.json"), "utf8"),
      readFile(path.join(projectRoot, "data", "safety_rules.json"), "utf8"),
    ]);

    return {
      package_meta: {
        package_name: "fallback_local_pack",
        version: "0.0.0",
        generated_at: new Date().toISOString(),
        description_ko: null,
      },
      sources: JSON.parse(sourcesRaw) as RawSource[],
      ingredients: JSON.parse(ingredientsRaw) as RawIngredient[],
      evidence_chunks: JSON.parse(evidenceRaw) as RawEvidenceChunk[],
      safety_rules: JSON.parse(rulesRaw) as RawRule[],
    };
  }
}

export async function buildKnowledgeIndex(projectRoot: string) {
  const knowledgePack = await readKnowledgePack(projectRoot);
  const generatedAt = knowledgePack.package_meta?.generated_at ?? new Date().toISOString();

  const ingredients = (knowledgePack.ingredients ?? []).map(buildIngredientRecord);
  const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

  const sources = (knowledgePack.sources ?? []).map((rawSource) =>
    knowledgeSourceSchema.parse({
      id: rawSource.source_id,
      sourceType: rawSource.source_type,
      title: rawSource.title,
      authors: splitAuthors(rawSource.authors),
      year: rawSource.publication_year ?? null,
      journalOrPublisher: rawSource.journal ?? rawSource.organization ?? null,
      jurisdiction: rawSource.jurisdiction ?? null,
      urlOrIdentifier: rawSource.url ?? rawSource.doi ?? rawSource.pmid ?? null,
      updatedAt: rawSource.publication_date ?? generatedAt,
      evidenceLevel: rawSource.evidence_tier ?? null,
      raw: rawSource,
    }),
  );

  const evidenceChunks = (knowledgePack.evidence_chunks ?? []).map((rawChunk) => ({
    id: rawChunk.chunk_id,
    sourceId: rawChunk.source_id,
    locatorType: rawChunk.locator_type ?? null,
    locatorValue: rawChunk.locator_value ?? null,
    quote: rawChunk.excerpt_summary_ko ?? null,
    summary: rawChunk.excerpt_summary_ko ?? null,
    chunkText: rawChunk.notes_ko ?? rawChunk.excerpt_summary_ko ?? null,
    relevantEntities: rawChunk.ingredient_ids ?? [],
    metadata: {
      claimType: rawChunk.claim_type ?? null,
      structuredClaim: rawChunk.structured_claim ?? null,
      confidence: rawChunk.confidence ?? null,
      notesKo: rawChunk.notes_ko ?? null,
    },
  }));

  const rawEvidenceMap = new Map((knowledgePack.evidence_chunks ?? []).map((chunk) => [chunk.chunk_id, chunk]));

  const safetyRules = (knowledgePack.safety_rules ?? []).map((rawRule) => {
    const ruleEvidenceChunks = (rawRule.evidence_chunk_ids ?? [])
      .map((chunkId) => rawEvidenceMap.get(chunkId))
      .filter((chunk): chunk is RawEvidenceChunk => Boolean(chunk));

    return buildSafetyRule(rawRule, ingredientMap.get(rawRule.ingredient_id), ruleEvidenceChunks, generatedAt);
  });

  return knowledgeIndexSchema.parse({
    meta: {
      packageName: knowledgePack.package_meta?.package_name ?? "knowledge_pack",
      version: knowledgePack.package_meta?.version ?? "0.0.0",
      generatedAt,
      descriptionKo: knowledgePack.package_meta?.description_ko ?? null,
      sourceCount: sources.length,
      ingredientCount: ingredients.length,
      evidenceChunkCount: evidenceChunks.length,
      safetyRuleCount: safetyRules.length,
    },
    sources,
    ingredients,
    evidenceChunks,
    safetyRules,
  }) as KnowledgeIndex;
}

export async function writeKnowledgeIndex(projectRoot: string) {
  const outputPath = path.join(projectRoot, "src", "generated", "knowledge-index.json");
  const result = await buildKnowledgeIndex(projectRoot);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}
