import "server-only";

import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import knowledgeIndexJson from "@/src/generated/knowledge-index.json";
import {
  getConditionAliases,
  getConditionDisplayLabel,
  getConditionPresetCanonicalValues,
} from "@/src/lib/knowledge/condition-aliases";
import {
  getMedicationAliases,
  getMedicationDisplayLabel,
} from "@/src/lib/knowledge/medication-aliases";
import {
  knowledgeIndexSchema,
  type EvidenceChunk,
  type KnowledgeIndex,
  type KnowledgeSource,
  type SafetyRule,
} from "@/src/types/knowledge";

const knowledgeIndex = knowledgeIndexSchema.parse(knowledgeIndexJson) as KnowledgeIndex;
const generatedKnowledgeIndexPath = path.join(
  process.cwd(),
  "src",
  "generated",
  "knowledge-index.json",
);

let developmentKnowledgeIndex: KnowledgeIndex | null = null;
let developmentKnowledgeIndexMtimeMs = -1;

function getDevelopmentKnowledgeIndex() {
  try {
    const fileStat = statSync(generatedKnowledgeIndexPath);

    if (
      developmentKnowledgeIndex &&
      fileStat.mtimeMs === developmentKnowledgeIndexMtimeMs
    ) {
      return developmentKnowledgeIndex;
    }

    const rawJson = readFileSync(generatedKnowledgeIndexPath, "utf8");
    const parsed = knowledgeIndexSchema.parse(
      JSON.parse(rawJson),
    ) as KnowledgeIndex;

    developmentKnowledgeIndex = parsed;
    developmentKnowledgeIndexMtimeMs = fileStat.mtimeMs;

    return parsed;
  } catch {
    return knowledgeIndex;
  }
}

export function getKnowledgeIndex() {
  return process.env.NODE_ENV === "development"
    ? getDevelopmentKnowledgeIndex()
    : knowledgeIndex;
}

export function getKnowledgeMeta() {
  return getKnowledgeIndex().meta;
}

export function getIngredientOptions() {
  return getKnowledgeIndex().ingredients.map((ingredient) => ({
    id: ingredient.id,
    label: ingredient.nameKo,
    aliases: ingredient.aliases,
    category: ingredient.category,
  }));
}

function humanizeExplorerValue(value: string) {
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function buildMedicationExplorerOptions(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) =>
      getMedicationDisplayLabel(left).localeCompare(getMedicationDisplayLabel(right), "ko"),
    )
    .map((value) => ({
      label: getMedicationDisplayLabel(value),
      canonicalValue: humanizeExplorerValue(value),
      aliases: [...new Set([value, humanizeExplorerValue(value), ...getMedicationAliases(value)])],
    }));
}

function buildConditionExplorerOptions(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) =>
      getConditionDisplayLabel(left).localeCompare(getConditionDisplayLabel(right), "ko"),
    )
    .map((value) => ({
      label: getConditionDisplayLabel(value),
      canonicalValue: humanizeExplorerValue(value),
      aliases: [...new Set([value, humanizeExplorerValue(value), ...getConditionAliases(value)])],
    }));
}

export function getSourceById(sourceId: string) {
  return getKnowledgeIndex().sources.find((source) => source.id === sourceId) ?? null;
}

export function getRuleById(ruleId: string) {
  return getKnowledgeIndex().safetyRules.find((rule) => rule.id === ruleId) ?? null;
}

export function getIngredientById(ingredientId: string) {
  return getKnowledgeIndex().ingredients.find((ingredient) => ingredient.id === ingredientId) ?? null;
}

export function getEvidenceChunkById(chunkId: string) {
  return getKnowledgeIndex().evidenceChunks.find((chunk) => chunk.id === chunkId) ?? null;
}

export function buildReferenceBundle(rule: SafetyRule) {
  const supportingSources = rule.sourceIds
    .map((sourceId) => getSourceById(sourceId))
    .filter((source): source is KnowledgeSource => Boolean(source));
  const supportingEvidenceChunks = rule.evidenceChunkIds
    .map((chunkId) => getEvidenceChunkById(chunkId))
    .filter((chunk): chunk is EvidenceChunk => Boolean(chunk));
  const ingredient = getIngredientById(rule.ingredientId);

  return {
    rule,
    supportingSources,
    supportingEvidenceChunks,
    ingredient,
  };
}

export function getRulesBySourceId(sourceId: string) {
  return getKnowledgeIndex().safetyRules.filter((rule) => rule.sourceIds.includes(sourceId));
}

export function getRulesByEvidenceChunkId(chunkId: string) {
  return getKnowledgeIndex().safetyRules.filter((rule) => rule.evidenceChunkIds.includes(chunkId));
}

export function getEvidenceChunksBySourceId(sourceId: string) {
  return getKnowledgeIndex().evidenceChunks.filter((chunk) => chunk.sourceId === sourceId);
}

export function getSourceDetail(sourceId: string) {
  const source = getSourceById(sourceId);
  if (!source) {
    return null;
  }

  const evidenceChunks = getEvidenceChunksBySourceId(sourceId);
  const linkedRules = getRulesBySourceId(sourceId);

  return {
    source,
    evidenceChunks,
    linkedRules,
  };
}

export function getRuleDetail(ruleId: string) {
  const rule = getRuleById(ruleId);
  if (!rule) {
    return null;
  }

  const supportingSources = rule.sourceIds
    .map((sourceId) => getSourceById(sourceId))
    .filter((source): source is KnowledgeSource => Boolean(source));
  const supportingEvidenceChunks = rule.evidenceChunkIds
    .map((chunkId) => getEvidenceChunkById(chunkId))
    .filter((chunk): chunk is EvidenceChunk => Boolean(chunk));

  return {
    rule,
    ingredient: getIngredientById(rule.ingredientId),
    supportingSources,
    supportingEvidenceChunks,
  };
}

export function getSourceBrowseData() {
  const index = getKnowledgeIndex();

  return index.sources.map((source) => ({
    id: source.id,
    title: source.title,
    sourceType: source.sourceType,
    year: source.year,
    jurisdiction: source.jurisdiction,
    evidenceLevel: source.evidenceLevel,
    journalOrPublisher: source.journalOrPublisher,
    linkedRuleCount: getRulesBySourceId(source.id).length,
    linkedChunkCount: getEvidenceChunksBySourceId(source.id).length,
  }));
}

export function getRuleBrowseData() {
  return getKnowledgeIndex().safetyRules.map((rule) => ({
    id: rule.id,
    ingredientId: rule.ingredientId,
    nutrientOrIngredient: rule.nutrientOrIngredient,
    severity: rule.severity,
    jurisdiction: rule.jurisdiction,
    ruleCategory: rule.ruleCategory,
    confidence: rule.confidence,
    lastReviewedAt: rule.lastReviewedAt,
  }));
}

export function getExplorerMetadata() {
  const index = getKnowledgeIndex();
  const medicationValues = [
    ...index.safetyRules.flatMap((rule) => rule.interactionDrugs),
    ...index.safetyRules.flatMap((rule) =>
      rule.conditions
        .filter((condition) => ["medications_any", "or_medications_any"].includes(condition.field))
        .flatMap((condition) =>
          Array.isArray(condition.value) ? condition.value.map((item) => String(item)) : [],
        ),
    ),
  ];
  const conditionValues = [
    ...index.safetyRules.flatMap((rule) => rule.interactionDiseases),
    ...index.safetyRules.flatMap((rule) =>
      rule.conditions
        .filter((condition) => condition.field === "diseases_any")
        .flatMap((condition) =>
          Array.isArray(condition.value) ? condition.value.map((item) => String(item)) : [],
        ),
    ),
    ...getConditionPresetCanonicalValues(),
  ];

  return {
    meta: index.meta,
    ingredients: getIngredientOptions(),
    medicationOptions: buildMedicationExplorerOptions(medicationValues),
    conditionOptions: buildConditionExplorerOptions(conditionValues),
    sources: index.sources.map((source) => ({
      id: source.id,
      title: source.title,
      jurisdiction: source.jurisdiction,
      evidenceLevel: source.evidenceLevel,
    })),
    sourceEvidenceLevels: [
      ...new Set(
        index.sources
          .map((source) => source.evidenceLevel)
          .filter((value): value is string => Boolean(value)),
      ),
    ],
    jurisdictions: [
      ...new Set(
        index.safetyRules
          .map((rule) => rule.jurisdiction)
          .filter((value): value is string => Boolean(value)),
      ),
    ],
    sortOptions: [
      { value: "severity_desc", label: "위험도 높은 순" },
      { value: "confidence_desc", label: "근거 신뢰도 높은 순" },
      { value: "nutrient_name", label: "성분명 가나다순" },
      { value: "recently_reviewed", label: "최근 검토 순" },
    ],
  };
}
