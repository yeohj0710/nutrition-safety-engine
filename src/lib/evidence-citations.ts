import {
  getEvidenceClaimLabel,
  getEvidenceContextSummary,
  getEvidenceLocatorText,
  getEvidencePrimaryExcerpt,
  getEvidenceRepresentativeExcerpt,
  getEvidenceSummaryExcerpt,
  getEvidenceTranslationExcerpt,
  getSourceReferenceLinks,
  getSourceTrustSummary,
  pickRepresentativeEvidenceChunk,
  sortEvidenceChunksByPriority,
  sortSourcesByPriority,
} from "@/src/lib/references";
import { cleanDisplayText } from "@/src/lib/display-text";
import type { EngineResponse, RuleMatch } from "@/src/types/knowledge";

const operatorLabelMap: Record<string, string> = {
  ">": "초과",
  ">=": "이상",
  "<": "미만",
  "<=": "이하",
};

export const summaryCitationLimit = 10;

export type EvidenceCitation = {
  citationNumber: number;
  ruleId: string;
  ingredient: string;
  classification: RuleMatch["classification"];
  severity: RuleMatch["resolvedSeverity"];
  sourceId: string | null;
  sourceTitle: string;
  sourceYear: number | null;
  journalOrPublisher: string | null;
  sourceTrust: string | null;
  externalUrl: string | null;
  locator: string | null;
  claimLabel: string | null;
  excerpt: string | null;
  threshold: string | null;
  ruleMessage: string;
  matchedReason: string | null;
  confidence: RuleMatch["rule"]["confidence"];
};

export type CitedSummarySegment = {
  text: string;
  citationNumbers: number[];
};

function truncateCleanText(value: string | null | undefined, maxLength: number) {
  const cleaned = cleanDisplayText(value);
  if (!cleaned) return null;
  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength - 1).trim()}...`
    : cleaned;
}

function getPreferredSourceUrl(
  links: ReturnType<typeof getSourceReferenceLinks>,
) {
  return (
    links.find((link) => link.label === "DOI") ??
    links.find((link) => link.label === "PubMed") ??
    links.find((link) => link.label === "PDF 원문") ??
    links.find((link) => link.label === "원문/기관 페이지") ??
    links[0] ??
    null
  );
}

export function formatRuleThreshold(match: RuleMatch) {
  const { threshold, thresholdOperator, unit } = match.rule;
  if (threshold === null || !thresholdOperator || !unit) return null;

  const formattedThreshold = Number.isInteger(threshold)
    ? threshold.toLocaleString("en-US")
    : threshold.toLocaleString("en-US", { maximumFractionDigits: 2 });

  return `${formattedThreshold} ${unit} ${operatorLabelMap[thresholdOperator] ?? thresholdOperator}`;
}

function getCitationExcerpt(match: RuleMatch) {
  const sourceLookup = new Map(
    match.supportingSources.map((source) => [source.id, source]),
  );
  const sortedSources = sortSourcesByPriority(match.supportingSources);
  const sortedEvidenceChunks = sortEvidenceChunksByPriority(
    match.supportingEvidenceChunks,
    sourceLookup,
  );
  const primarySource = sortedSources[0] ?? null;
  const primaryEvidence =
    (primarySource
      ? pickRepresentativeEvidenceChunk(
          sortedEvidenceChunks.filter(
            (chunk) => chunk.sourceId === primarySource.id,
          ),
        )
      : null) ??
    pickRepresentativeEvidenceChunk(sortedEvidenceChunks) ??
    sortedEvidenceChunks[0] ??
    null;
  const source =
    primarySource ??
    (primaryEvidence ? sourceLookup.get(primaryEvidence.sourceId) : null) ??
    sortedSources[0] ??
    null;
  const sourceLinks = source ? getSourceReferenceLinks(source) : [];
  const preferredLink = getPreferredSourceUrl(sourceLinks);
  const excerpt = primaryEvidence
    ? getEvidenceTranslationExcerpt(primaryEvidence) ??
      getEvidenceSummaryExcerpt(primaryEvidence) ??
      getEvidenceContextSummary(primaryEvidence) ??
      getEvidenceRepresentativeExcerpt(primaryEvidence) ??
      getEvidencePrimaryExcerpt(primaryEvidence)
    : null;

  return {
    source,
    evidence: primaryEvidence,
    sourceUrl: preferredLink?.url ?? null,
    excerpt: truncateCleanText(excerpt, 260),
  };
}

export function buildEvidenceCitationsFromMatches(
  matches: RuleMatch[],
  limit = summaryCitationLimit,
) {
  const citations: EvidenceCitation[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    if (citations.length >= limit) break;

    const { source, evidence, sourceUrl, excerpt } = getCitationExcerpt(match);
    const dedupeKey = `${match.ruleId}:${evidence?.id ?? source?.id ?? "rule"}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    citations.push({
      citationNumber: citations.length + 1,
      ruleId: match.ruleId,
      ingredient: cleanDisplayText(match.rule.nutrientOrIngredient) ?? match.rule.nutrientOrIngredient,
      classification: match.classification,
      severity: match.resolvedSeverity,
      sourceId: source?.id ?? null,
      sourceTitle:
        cleanDisplayText(source?.title) ??
        cleanDisplayText(match.supportingSources[0]?.title) ??
        "연결된 출처 없음",
      sourceYear: source?.year ?? null,
      journalOrPublisher: cleanDisplayText(source?.journalOrPublisher) ?? null,
      sourceTrust: source ? cleanDisplayText(getSourceTrustSummary(source)) : null,
      externalUrl: sourceUrl,
      locator: evidence ? cleanDisplayText(getEvidenceLocatorText(evidence)) : null,
      claimLabel: evidence ? cleanDisplayText(getEvidenceClaimLabel(evidence)) : null,
      excerpt,
      threshold: formatRuleThreshold(match),
      ruleMessage: cleanDisplayText(match.rule.messageLong || match.resolvedMessage) ?? match.resolvedMessage,
      matchedReason: cleanDisplayText(match.matchedBecause[0] ?? match.needsMoreInfo[0]),
      confidence: match.rule.confidence,
    });
  }

  return citations;
}

export function buildEvidenceCitationsFromResponse(
  response: EngineResponse,
  limit = summaryCitationLimit,
) {
  return buildEvidenceCitationsFromMatches(
    [
      ...response.definitely_matched,
      ...response.possibly_relevant,
      ...response.needs_more_info,
    ],
    limit,
  );
}

function findCitationForRule(citations: EvidenceCitation[], ruleId: string) {
  return citations.find((citation) => citation.ruleId === ruleId) ?? null;
}

function citationNumbersForRules(
  citations: EvidenceCitation[],
  matches: RuleMatch[],
  limit = 3,
) {
  return matches
    .map((match) => findCitationForRule(citations, match.ruleId)?.citationNumber)
    .filter((value): value is number => typeof value === "number")
    .slice(0, limit);
}

export function buildDeterministicSummarySegments(
  response: EngineResponse,
  citations: EvidenceCitation[],
) {
  const directMatches = response.definitely_matched;
  const possibleMatches = response.possibly_relevant;
  const needsMoreInfoMatches = response.needs_more_info;
  const totalVisible =
    directMatches.length + possibleMatches.length + needsMoreInfoMatches.length;
  const topDirect = directMatches[0] ?? possibleMatches[0] ?? needsMoreInfoMatches[0] ?? null;
  const topCitation = topDirect
    ? findCitationForRule(citations, topDirect.ruleId)
    : null;
  const thresholdCitations = citations
    .filter((citation) => citation.threshold)
    .slice(0, 2);
  const segments: CitedSummarySegment[] = [];

  if (totalVisible === 0) {
    return [
      {
        text: "현재 입력한 조건에서는 바로 연결되는 안전성 기준을 찾지 못했습니다.",
        citationNumbers: [],
      },
      {
        text: "성분명, 복용량, 함께 복용 중인 약물이나 질환 정보를 더 구체적으로 넣으면 근거 매칭 범위를 다시 좁혀볼 수 있습니다.",
        citationNumbers: [],
      },
    ];
  }

  segments.push({
    text: `이번 조회에서는 직접 관련 ${directMatches.length}건, 함께 참고 ${possibleMatches.length}건, 추가 확인 ${needsMoreInfoMatches.length}건이 잡혔습니다.`,
    citationNumbers: citationNumbersForRules(
      citations,
      [...directMatches, ...possibleMatches, ...needsMoreInfoMatches],
      3,
    ),
  });

  if (topDirect && topCitation) {
    const reason = topCitation.matchedReason
      ? ` ${topCitation.matchedReason.replace(/[.。]\s*$/u, "")} 조건과 연결됩니다.`
      : "";
    const threshold = topCitation.threshold
      ? ` 기준 수치는 ${topCitation.threshold}입니다.`
      : "";

    segments.push({
      text: `가장 먼저 볼 항목은 ${topCitation.ingredient}입니다.${reason}${threshold} 안내문은 "${topCitation.ruleMessage}"로 정리됩니다.`,
      citationNumbers: [topCitation.citationNumber],
    });
  }

  if (thresholdCitations.length > 0) {
    segments.push({
      text: `정량 기준은 ${thresholdCitations
        .map((citation) => `${citation.ingredient} ${citation.threshold}`)
        .join(", ")}처럼 숫자로 확인해야 합니다.`,
      citationNumbers: thresholdCitations.map(
        (citation) => citation.citationNumber,
      ),
    });
  }

  if (needsMoreInfoMatches.length > 0) {
    segments.push({
      text: `판정 보류 항목은 복용량, 기간, 제형, 임신 및 수유 상태처럼 아직 빠진 입력값 때문에 생긴 것이므로, 해당 정보를 보완하면 실제 주의 대상인지 더 정확히 갈라낼 수 있습니다.`,
      citationNumbers: citationNumbersForRules(
        citations,
        needsMoreInfoMatches,
        2,
      ),
    });
  }

  return segments;
}
