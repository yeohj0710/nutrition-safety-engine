import "server-only";

import knowledgeIndexJson from "@/src/generated/knowledge-index.json";
import {
  knowledgeIndexSchema,
  type EvidenceChunk,
  type KnowledgeIndex,
  type KnowledgeSource,
  type SafetyRule,
} from "@/src/types/knowledge";

const knowledgeIndex = knowledgeIndexSchema.parse(knowledgeIndexJson) as KnowledgeIndex;

export function getKnowledgeIndex() {
  return knowledgeIndex;
}

export function getKnowledgeMeta() {
  return knowledgeIndex.meta;
}

export function getIngredientOptions() {
  return knowledgeIndex.ingredients.map((ingredient) => ({
    id: ingredient.id,
    label: ingredient.nameKo,
    aliases: ingredient.aliases,
    category: ingredient.category,
  }));
}

export function getSourceById(sourceId: string) {
  return knowledgeIndex.sources.find((source) => source.id === sourceId) ?? null;
}

export function getRuleById(ruleId: string) {
  return knowledgeIndex.safetyRules.find((rule) => rule.id === ruleId) ?? null;
}

export function getIngredientById(ingredientId: string) {
  return knowledgeIndex.ingredients.find((ingredient) => ingredient.id === ingredientId) ?? null;
}

export function getEvidenceChunkById(chunkId: string) {
  return knowledgeIndex.evidenceChunks.find((chunk) => chunk.id === chunkId) ?? null;
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

export function getRuleBrowseData() {
  return knowledgeIndex.safetyRules.map((rule) => ({
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
  return {
    meta: knowledgeIndex.meta,
    ingredients: getIngredientOptions(),
    sources: knowledgeIndex.sources.map((source) => ({
      id: source.id,
      title: source.title,
      jurisdiction: source.jurisdiction,
      evidenceLevel: source.evidenceLevel,
    })),
    jurisdictions: [
      ...new Set(
        knowledgeIndex.safetyRules
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
