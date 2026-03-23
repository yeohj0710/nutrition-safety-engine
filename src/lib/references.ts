import type { EvidenceChunk, JsonValue, KnowledgeSource } from "@/src/types/knowledge";

type ReferenceLink = {
  label: string;
  url: string;
};

const evidenceLevelScoreMap: Record<string, number> = {
  systematic_review_meta_analysis: 170,
  rct: 155,
  scientific_opinion: 145,
  national_reference: 140,
  regulation: 140,
  government_guideline: 135,
  regional_guideline: 132,
  government_safety_alert: 128,
  government_fact_sheet: 118,
  government_notice: 112,
  government_database: 104,
  national_reference_context: 102,
  narrative_review: 96,
  analytical_study: 92,
  post_marketing_signal: 84,
  observational_genetic_association: 78,
  case_series: 72,
  case_report: 66,
  licensed_clinical_database: 60,
  quality_standard: 58,
};

const sourceTypeScoreMap: Record<string, number> = {
  systematic_review_meta_analysis: 70,
  rct: 60,
  review: 45,
  scientific_opinion: 42,
  technical_report: 36,
  government_guideline: 34,
  regulation_notice: 34,
  national_dri: 34,
  government_fact_sheet: 28,
  government_safety_alert: 26,
  adverse_event_dataset: 18,
  analytical_study: 18,
  case_series: 12,
  case_report: 10,
};

const chunkConfidenceScoreMap: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const claimTypeLabelMap: Record<string, string> = {
  adverse_effect_signal: "이상반응 신호",
  case_series_finding: "사례군 근거",
  contraindication: "금기/회피 근거",
  definition: "정의/기준",
  disease_caution: "질환 주의",
  dose_limit: "섭취량 기준",
  general_safety: "일반 안전성",
  genetic_caution: "유전형 주의",
  government_safety_alert: "정부 경고",
  interaction: "상호작용",
  mechanistic_interaction: "기전 기반 상호작용",
  population_caution: "특정 집단 주의",
  pregnancy_lactation: "임신/수유",
  quality_signal: "품질 이슈",
  reference_framework: "참고 프레임",
  regulatory_anchor: "규제 기준",
  timing_separation: "복용 간격",
};

const noisyKeywordSet = new Set([
  "required",
  "warn",
  "avoid",
  "high",
  "medium",
  "low",
  "true",
  "false",
  "not formal ul",
  "us",
  "eu",
  "intl",
]);

function getRecordString(record: Record<string, JsonValue>, key: string) {
  const value = record[key];

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function normalizePmid(value: string | null) {
  if (!value) return null;

  const match = value.match(/(\d{5,})/);
  return match ? match[1] : null;
}

function normalizeDoi(value: string | null) {
  if (!value) return null;

  const trimmed = value
    .replace(/^https?:\/\/doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim();

  return /^10\./.test(trimmed) ? trimmed : null;
}

function normalizeUrl(value: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

function extractPmidFromUrl(url: string | null) {
  if (!url) return null;
  const match = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
  return match ? match[1] : null;
}

function extractDoiFromUrl(url: string | null) {
  if (!url) return null;
  const match = url.match(/doi\.org\/(.+)$/i);
  return match ? match[1] : null;
}

function buildPubMedUrl(pmid: string) {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

function buildDoiUrl(doi: string) {
  return `https://doi.org/${doi}`;
}

function getChunkMetadataString(chunk: EvidenceChunk, key: string) {
  return getRecordString(chunk.metadata, key);
}

function flattenKeywordStrings(value: JsonValue, bucket: string[]) {
  if (typeof value === "string") {
    bucket.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) flattenKeywordStrings(item, bucket);
    return;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      flattenKeywordStrings(nested, bucket);
    }
  }
}

function normalizeExcerpt(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function getSourceIdentifiers(source: KnowledgeSource) {
  const rawUrl = getRecordString(source.raw, "url");
  const sourceUrl = normalizeUrl(rawUrl) ?? normalizeUrl(source.urlOrIdentifier);
  const pmid =
    normalizePmid(getRecordString(source.raw, "pmid")) ??
    normalizePmid(source.urlOrIdentifier) ??
    extractPmidFromUrl(sourceUrl);
  const doi =
    normalizeDoi(getRecordString(source.raw, "doi")) ??
    normalizeDoi(source.urlOrIdentifier) ??
    extractDoiFromUrl(sourceUrl);

  return {
    pmid,
    doi,
    url: sourceUrl,
  };
}

export function getSourceReferenceLinks(source: KnowledgeSource) {
  const links: ReferenceLink[] = [];
  const seenUrls = new Set<string>();
  const identifiers = getSourceIdentifiers(source);

  function add(label: string, url: string | null) {
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    links.push({ label, url });
  }

  add("PubMed", identifiers.pmid ? buildPubMedUrl(identifiers.pmid) : null);
  add("DOI", identifiers.doi ? buildDoiUrl(identifiers.doi) : null);

  const sourceUrlLabel = identifiers.url?.toLowerCase().includes("pubmed")
    ? "PubMed"
    : identifiers.url?.toLowerCase().includes("doi.org")
      ? "DOI"
      : identifiers.url?.toLowerCase().includes(".pdf")
        ? "PDF 원문"
        : "원문/기관 페이지";

  add(sourceUrlLabel, identifiers.url);

  return links;
}

export function getSourcePriority(source: KnowledgeSource) {
  const identifiers = getSourceIdentifiers(source);

  return (
    (evidenceLevelScoreMap[source.evidenceLevel ?? ""] ?? 0) +
    (sourceTypeScoreMap[source.sourceType] ?? 0) +
    (identifiers.pmid ? 220 : 0) +
    (identifiers.doi ? 70 : 0) +
    (identifiers.url ? 20 : 0)
  );
}

export function sortSourcesByPriority<T extends KnowledgeSource>(sources: T[]) {
  return [...sources].sort((left, right) => {
    const priorityDifference = getSourcePriority(right) - getSourcePriority(left);
    if (priorityDifference !== 0) return priorityDifference;

    const yearDifference = (right.year ?? 0) - (left.year ?? 0);
    if (yearDifference !== 0) return yearDifference;

    return left.title.localeCompare(right.title, "en");
  });
}

export function sortEvidenceChunksByPriority<T extends EvidenceChunk>(chunks: T[], sourceLookup: Map<string, KnowledgeSource>) {
  return [...chunks].sort((left, right) => {
    const leftSource = sourceLookup.get(left.sourceId);
    const rightSource = sourceLookup.get(right.sourceId);
    const priorityDifference = (rightSource ? getSourcePriority(rightSource) : 0) - (leftSource ? getSourcePriority(leftSource) : 0);
    if (priorityDifference !== 0) return priorityDifference;

    const confidenceDifference =
      (chunkConfidenceScoreMap[getChunkMetadataString(right, "confidence") ?? ""] ?? 0) -
      (chunkConfidenceScoreMap[getChunkMetadataString(left, "confidence") ?? ""] ?? 0);
    if (confidenceDifference !== 0) return confidenceDifference;

    return left.id.localeCompare(right.id, "en");
  });
}

export function getSourceTrustSummary(source: KnowledgeSource) {
  const identifiers = getSourceIdentifiers(source);

  if (identifiers.pmid && source.sourceType === "systematic_review_meta_analysis") return "PubMed 메타분석";
  if (identifiers.pmid && source.sourceType === "rct") return "PubMed 무작위시험";
  if (identifiers.pmid && source.sourceType === "review") return "PubMed 리뷰";
  if (identifiers.pmid) return "PubMed 색인 논문";
  if (["national_reference", "government_guideline", "regional_guideline", "regulation"].includes(source.evidenceLevel ?? "")) {
    return "공공 기준 문서";
  }
  if ((source.evidenceLevel ?? "").startsWith("government_")) return "정부/공공 자료";
  if (source.evidenceLevel === "post_marketing_signal") return "시판 후 안전성 신호";
  if (source.sourceType === "case_report" || source.sourceType === "case_series") return "사례 보고";
  return source.evidenceLevel ?? source.sourceType;
}

export function getEvidenceClaimLabel(chunk: EvidenceChunk) {
  const claimType = getChunkMetadataString(chunk, "claimType");
  return claimType ? claimTypeLabelMap[claimType] ?? claimType : null;
}

export function getEvidenceLocatorText(chunk: EvidenceChunk) {
  return [chunk.locatorType ?? null, chunk.locatorValue ?? null].filter(Boolean).join(" ");
}

export function getEvidencePrimaryExcerpt(chunk: EvidenceChunk) {
  return chunk.verbatimQuote ?? chunk.quote ?? chunk.chunkText ?? chunk.summary ?? null;
}

export function getEvidenceSecondaryExcerpt(chunk: EvidenceChunk) {
  const primary = normalizeExcerpt(getEvidencePrimaryExcerpt(chunk));
  const translated = normalizeExcerpt(chunk.translatedQuote);
  const summary = normalizeExcerpt(chunk.summary);
  const chunkText = normalizeExcerpt(chunk.chunkText);

  for (const candidate of [translated, summary, chunkText]) {
    if (candidate && candidate !== primary) {
      return candidate;
    }
  }

  return null;
}

export function getEvidenceExcerptLabel(chunk: EvidenceChunk) {
  return chunk.verbatimQuote ? "원문 발췌" : "등록된 발췌";
}

export function hasOriginalEvidenceExcerpt(chunk: EvidenceChunk) {
  return Boolean(chunk.verbatimQuote);
}

export function getEvidenceCheckHint(chunk: EvidenceChunk, source?: KnowledgeSource | null) {
  const locatorType = chunk.locatorType ?? "";
  const locatorValue = chunk.locatorValue ?? "저장된 locator";
  const hasPubMed = Boolean(source && getSourceIdentifiers(source).pmid);

  if (locatorType === "abstract") {
    return hasPubMed
      ? `PubMed 페이지에서 Abstract 영역의 ${locatorValue} 부분을 먼저 확인하세요.`
      : `원문 초록(Abstract)의 ${locatorValue} 부분을 먼저 확인하세요.`;
  }

  if (locatorType === "conclusion") {
    return "논문의 Conclusion 또는 마지막 요약 문단을 확인하면 해당 근거를 가장 빨리 찾을 수 있습니다.";
  }

  if (locatorType === "table") {
    return `원문 표 또는 요약 테이블에서 ${locatorValue} 항목을 확인하세요.`;
  }

  if (locatorType === "lines") {
    return hasPubMed
      ? `저장된 추출 위치는 ${locatorValue}입니다. PubMed에서 원문 링크를 연 뒤, 성분명과 위험 키워드를 함께 검색해 해당 문단을 확인하세요.`
      : `저장된 추출 위치는 ${locatorValue}입니다. 원문 페이지를 연 뒤 브라우저 찾기(Ctrl/Cmd+F)로 성분명과 위험 키워드를 검색해 해당 문단을 확인하세요.`;
  }

  return "원문 링크를 열고 제목, 성분명, 위험 키워드로 해당 부분을 직접 찾아 확인하세요.";
}

export function getEvidenceSearchKeywords(chunk: EvidenceChunk) {
  const collected: string[] = [];
  const structuredClaim = chunk.metadata.structuredClaim;

  if (structuredClaim) {
    flattenKeywordStrings(structuredClaim, collected);
  }

  for (const entity of chunk.relevantEntities) {
    collected.push(entity);
  }

  const unique = new Set<string>();
  const keywords: string[] = [];

  for (const rawValue of collected) {
    const normalized = rawValue.replace(/_/g, " ").trim();
    const lowered = normalized.toLowerCase();

    if (!normalized || noisyKeywordSet.has(lowered) || unique.has(lowered)) continue;
    if (normalized.length < 3 && !/\d/.test(normalized)) continue;

    unique.add(lowered);
    keywords.push(normalized);

    if (keywords.length === 4) break;
  }

  return keywords;
}
