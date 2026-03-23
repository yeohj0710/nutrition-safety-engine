import Link from "next/link";

import {
  getEvidenceCheckHint,
  getEvidenceClaimLabel,
  getEvidenceExcerptLabel,
  getEvidenceLocatorText,
  getEvidencePrimaryExcerpt,
  getEvidenceSearchKeywords,
  getEvidenceSecondaryExcerpt,
  getSourceReferenceLinks,
  getSourceTrustSummary,
  hasOriginalEvidenceExcerpt,
  sortEvidenceChunksByPriority,
  sortSourcesByPriority,
} from "@/src/lib/references";
import type { RuleMatch } from "@/src/types/knowledge";

const confirmedSeverityMeta = {
  contraindicated: {
    label: "복용 금지",
    tone: "border border-red-200 bg-red-50 text-red-900",
  },
  avoid: {
    label: "회피 권고",
    tone: "border border-orange-200 bg-orange-50 text-orange-900",
  },
  warn: {
    label: "주의 필요",
    tone: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  monitor: {
    label: "모니터링",
    tone: "border border-sky-200 bg-sky-50 text-sky-900",
  },
} as const;

const classificationMeta = {
  possibly_relevant: {
    label: "함께 참고",
    tone: "border border-stone-200 bg-stone-50 text-stone-800",
  },
  needs_more_info: {
    label: "추가 확인",
    tone: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  excluded: {
    label: "이번 결과 제외",
    tone: "border border-stone-200 bg-stone-50 text-stone-700",
  },
} as const;

const actionPanelToneMap = {
  definitely_matched: {
    contraindicated: "border-red-200 bg-red-50/70",
    avoid: "border-orange-200 bg-orange-50/70",
    warn: "border-amber-200 bg-amber-50/70",
    monitor: "border-sky-200 bg-sky-50/70",
  },
  possibly_relevant: "border-stone-200 bg-stone-50/70",
  needs_more_info: "border-amber-200 bg-amber-50/70",
  excluded: "border-stone-200 bg-stone-50/70",
} as const;

const ruleCategoryLabelMap: Record<string, string> = {
  adverse_effect_signal: "이상반응",
  disease_caution: "질환 주의",
  dose_limit: "용량 기준",
  interaction: "약물 상호작용",
  monitoring: "모니터링",
  population_caution: "집단 주의",
  pregnancy_lactation: "임신/수유",
  quality_signal: "품질 이슈",
  timing_separation: "복용 간격",
};

const operatorLabelMap: Record<string, string> = {
  ">": "초과",
  ">=": "이상",
  "<": "미만",
  "<=": "이하",
};

function renderList(items: string[]) {
  return items.length > 0 ? items.join(", ") : "해당 없음";
}

function sanitizeExplanations(items: string[], fallback: string) {
  const cleaned = items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (/[占�]/.test(item) ? fallback : item));

  return cleaned.length > 0 ? cleaned : [fallback];
}

function formatBadgeLabel(value: string | null | undefined) {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

function stripTrailingPunctuation(value: string) {
  return value.trim().replace(/[.!?]\s*$/u, "").trim();
}

function ensureSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
}

function formatThreshold(match: RuleMatch) {
  const { threshold, thresholdOperator, unit } = match.rule;
  if (threshold === null || !thresholdOperator || !unit) return null;

  const formattedThreshold = Number.isInteger(threshold)
    ? threshold.toLocaleString("en-US")
    : threshold.toLocaleString("en-US", { maximumFractionDigits: 2 });

  return `${formattedThreshold} ${unit} ${operatorLabelMap[thresholdOperator] ?? thresholdOperator}`;
}

function humanizeMissingReason(reason: string) {
  const trimmed = stripTrailingPunctuation(reason);
  if (!trimmed) return "안전 기준을 판단하려면 정보가 조금 더 필요합니다.";

  const replacements: Array<[RegExp, string]> = [
    [/일일 섭취량.*없어.*보류/u, "현재 드시는 양 정보가 아직 없어 먼저 확인이 필요합니다"],
    [/용량 기준 규칙.*보류/u, "용량 기준을 판단하려면 현재 드시는 양 정보가 더 필요합니다"],
    [/임신.*정보가 없어.*보류/u, "임신 상태 정보가 있으면 더 정확하게 안내해 드릴 수 있습니다"],
    [/수유.*정보가 없어.*보류/u, "수유 상태 정보가 있으면 더 정확하게 안내해 드릴 수 있습니다"],
    [/흡연 상태.*정보가 없어.*보류/u, "흡연 상태 정보가 있으면 더 정확하게 안내해 드릴 수 있습니다"],
    [/약물.*정보가 없어.*보류/u, "함께 복용 중인 약물 정보를 알면 더 정확하게 확인할 수 있습니다"],
    [/질환.*정보가 없어.*보류/u, "현재 질환 또는 상태 정보를 알면 더 정확하게 확인할 수 있습니다"],
    [/형태 정보가 없어.*보류/u, "제품 형태 정보가 있으면 더 정확하게 확인할 수 있습니다"],
    [/같은 날 복용 여부가 없어.*보류/u, "같은 날 함께 드시는지 알면 더 정확하게 확인할 수 있습니다"],
    [/장기 복용 기간 정보가 없어.*보류/u, "얼마 동안 드셨는지 알면 더 정확하게 확인할 수 있습니다"],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(trimmed)) return `${replacement}.`;
  }

  return ensureSentence(trimmed.replace(/\s+/g, " "));
}

function toPoliteRuleSummary(message: string) {
  const normalized = stripTrailingPunctuation(message)
    .replace(/\s+/g, " ")
    .replace(/기본적으로 금기 처리한다$/u, "기본적으로 함께 복용하지 않는 편이 안전합니다")
    .replace(/기본 금기로 둔다$/u, "기본적으로 함께 복용하지 않는 편이 안전합니다")
    .replace(/금기로 둔다$/u, "함께 복용하지 않는 편이 안전합니다")
    .replace(/금기 처리한다$/u, "함께 복용하지 않는 편이 안전합니다")
    .replace(/보수적으로 사용한다$/u, "조금 더 신중하게 살펴보는 편이 좋습니다")
    .replace(/보수적으로 해석한다$/u, "제품을 고를 때 더 신중하게 보는 편이 좋습니다")
    .replace(/시간 간격을 둔다$/u, "같은 시간대에 함께 드시지 않는 편이 좋습니다")
    .replace(/모니터링이 필요하다$/u, "복용 중에는 함께 살펴보는 것이 좋습니다")
    .replace(/제한한다$/u, "넘기지 않게 맞추는 편이 좋습니다")
    .replace(/피한다$/u, "피하는 편이 좋습니다")
    .replace(/권장된다$/u, "권장됩니다")
    .replace(/확인이 필요하다$/u, "확인이 필요합니다")
    .replace(/필요하다$/u, "필요합니다")
    .replace(/바람직하다$/u, "바람직합니다")
    .replace(/상호작용할 수 있다$/u, "상호작용할 수 있습니다")
    .replace(/관련될 수 있다$/u, "관련될 수 있습니다")
    .replace(/생길 수 있다$/u, "생길 수 있습니다")
    .replace(/높일 수 있다$/u, "높일 수 있습니다")
    .replace(/낮출 수 있다$/u, "낮출 수 있습니다")
    .replace(/늘릴 수 있다$/u, "늘릴 수 있습니다")
    .replace(/있다$/u, "있습니다");

  return ensureSentence(normalized);
}

function getTargetSummary(match: RuleMatch) {
  const targets: string[] = [];
  if (match.rule.interactionDrugs.length > 0) {
    targets.push(`복용 약물: ${match.rule.interactionDrugs.join(", ")}`);
  }
  if (match.rule.interactionDiseases.length > 0) {
    targets.push(`질환/상태: ${match.rule.interactionDiseases.join(", ")}`);
  }
  if (match.rule.populationTags.length > 0) {
    targets.push(`대상 집단: ${match.rule.populationTags.join(", ")}`);
  }
  if (targets.length === 0 && match.rule.conditions.length > 0) {
    const labels = match.rule.conditions.map((condition) => condition.labelKo).filter(Boolean);
    if (labels.length > 0) targets.push(`연결 조건: ${labels.join(", ")}`);
  }

  return targets.length > 0
    ? targets.join(" / ")
    : "개인 조건과 직접 연결된 항목은 아니지만, 선택하신 성분 자체를 볼 때 참고하면 좋은 기본 안내입니다.";
}

function getAdviceHeading(match: RuleMatch) {
  if (match.classification === "needs_more_info") return "이 정보를 먼저 확인해 주세요";
  if (match.classification === "possibly_relevant") return "함께 참고해 두시면 좋아요";

  switch (match.resolvedSeverity) {
    case "contraindicated":
      return "이 점을 먼저 살펴봐 주세요";
    case "avoid":
      return "가능하면 피하는 쪽이 안전해요";
    case "warn":
      return "주의해서 확인해 주세요";
    case "monitor":
      return "복용 중에는 함께 살펴봐 주세요";
  }
}

function getActionSentence(match: RuleMatch) {
  if (match.classification === "needs_more_info") {
    return "현재 입력만으로는 바로 단정하기 어려워서, 관련 정보를 조금 더 확인해 주세요.";
  }
  if (match.classification === "possibly_relevant") {
    return "지금 바로 위험하다고 단정할 단계는 아니지만, 함께 참고해 두시면 좋습니다.";
  }

  switch (match.resolvedSeverity) {
    case "contraindicated":
      return "함께 드시지 않는 쪽이 안전합니다.";
    case "avoid":
      return "가능하면 피하는 쪽이 더 안전합니다.";
    case "warn":
      return "복용 전후로 몸 상태와 복용 조건을 한 번 더 확인해 주세요.";
    case "monitor":
      return "복용 중에는 몸 상태나 관련 수치를 함께 살펴봐 주세요.";
  }
}

function buildMainMessage(match: RuleMatch) {
  const summarySource = match.rule.messageLong || match.resolvedMessage || match.rule.messageShort;
  const politeSummary = toPoliteRuleSummary(summarySource);
  const thresholdText = formatThreshold(match);

  if (match.classification === "needs_more_info") {
    if (thresholdText) {
      return `${politeSummary} 현재 드시는 양 정보가 아직 없어, ${thresholdText} 기준에 해당하는지 먼저 확인해 주세요.`;
    }

    const missingReason = humanizeMissingReason(
      sanitizeExplanations(
        match.needsMoreInfo,
        "안전 기준을 판단하려면 정보가 조금 더 필요합니다.",
      )[0]!,
    );
    return `${politeSummary} ${missingReason}`;
  }

  return `${politeSummary} ${getActionSentence(match)}`;
}

function buildFriendlyReason(match: RuleMatch) {
  if (match.classification === "needs_more_info") {
    const messages = sanitizeExplanations(
      match.needsMoreInfo,
      "안전 기준을 판단하려면 정보가 조금 더 필요합니다.",
    ).map(humanizeMissingReason);
    return `지금 입력하신 정보만으로는 바로 판단하기 어려워서, ${messages.join(" / ")}`;
  }

  if (match.classification === "possibly_relevant") {
    return "입력하신 개인 조건과 바로 연결된 내용은 아니지만, 선택하신 성분을 볼 때 같이 알아두시면 좋은 안내예요.";
  }

  const reasons = sanitizeExplanations(
    match.matchedBecause,
    "입력하신 정보와 이 규칙이 직접 연결돼 있습니다.",
  );
  return `입력하신 정보 중 이 부분과 연결돼 있어요: ${reasons.join(" / ")}`;
}

function getBadgeMeta(match: RuleMatch) {
  return match.classification === "definitely_matched"
    ? confirmedSeverityMeta[match.resolvedSeverity]
    : classificationMeta[match.classification];
}

function getActionPanelTone(match: RuleMatch) {
  return match.classification === "definitely_matched"
    ? actionPanelToneMap.definitely_matched[match.resolvedSeverity]
    : actionPanelToneMap[match.classification];
}

export function RuleCard({
  match,
  defaultExpandedEvidence = false,
}: {
  match: RuleMatch;
  defaultExpandedEvidence?: boolean;
}) {
  const badgeMeta = getBadgeMeta(match);
  const actionPanelTone = getActionPanelTone(match);
  const sourceLookup = new Map(match.supportingSources.map((source) => [source.id, source]));
  const sortedSources = sortSourcesByPriority(match.supportingSources);
  const sortedEvidenceChunks = sortEvidenceChunksByPriority(match.supportingEvidenceChunks, sourceLookup);
  const primarySource = sortedSources[0] ?? null;
  const primaryLinks = primarySource ? getSourceReferenceLinks(primarySource) : [];
  const primaryEvidence = sortedEvidenceChunks[0] ?? null;
  const primaryEvidenceExcerpt = primaryEvidence ? getEvidencePrimaryExcerpt(primaryEvidence) : null;
  const primaryEvidenceSecondary = primaryEvidence ? getEvidenceSecondaryExcerpt(primaryEvidence) : null;
  const confidenceLabel = formatBadgeLabel(match.rule.confidence) ?? "unknown";
  const supportingSourceCount = sortedSources.length;
  const supportingEvidenceCount = sortedEvidenceChunks.length;

  return (
    <article className="surface-card overflow-hidden rounded-[1.5rem] px-5 py-5 md:px-6 md:py-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_19rem]">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${badgeMeta.tone}`}>
                  {badgeMeta.label}
                </span>
                <span className="rounded-full border border-border-subtle bg-white/82 px-3 py-1 text-[11px] text-muted">
                  {ruleCategoryLabelMap[match.rule.ruleCategory] ?? match.rule.ruleCategory}
                </span>
                {match.rule.jurisdiction ? (
                  <span className="rounded-full border border-border-subtle bg-white/82 px-3 py-1 text-[11px] text-muted">
                    {match.rule.jurisdiction}
                  </span>
                ) : null}
                <span className="rounded-full border border-border-subtle bg-[color:rgba(244,240,233,0.88)] px-3 py-1 text-[11px] text-muted">
                  신뢰도 {confidenceLabel}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  {getAdviceHeading(match)}
                </p>
                <h3 className="mt-2 text-[clamp(1.35rem,2.4vw,1.8rem)] font-semibold tracking-[-0.03em] text-foreground">
                  {match.rule.nutrientOrIngredient}
                </h3>
              </div>
            </div>

            <Link
              href={`/rules/${match.ruleId}`}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-foreground transition duration-150 hover:border-stone-300 hover:bg-stone-50"
            >
              규칙 상세
            </Link>
          </div>

          <div className={`rounded-[1rem] border px-5 py-4 ${actionPanelTone}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">핵심 안내</p>
            <p className="mt-2 text-sm leading-7 text-stone-900">{buildMainMessage(match)}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
            <section className="rounded-[1rem] border border-stone-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                왜 이 결과가 떴나요
              </p>
              <p className="mt-3 text-sm leading-7 text-foreground">{buildFriendlyReason(match)}</p>
              <p className="mt-4 text-xs leading-6 text-muted">
                현재 연결된 조건: {getTargetSummary(match)}
              </p>
            </section>

            <section className="rounded-[1rem] border border-stone-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                요약 정보
              </p>
              <dl className="mt-3 grid gap-3 text-sm">
                <div className="flex items-start justify-between gap-3 border-b border-border-subtle/70 pb-3">
                  <dt className="text-muted">정량 기준</dt>
                  <dd className="min-w-0 text-right text-foreground">{formatThreshold(match) ?? "없음"}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-border-subtle/70 pb-3">
                  <dt className="text-muted">신뢰도</dt>
                  <dd className="min-w-0 text-right text-foreground">
                    {formatBadgeLabel(match.rule.confidence) ?? "unknown"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted">마지막 검토</dt>
                  <dd className="min-w-0 text-right text-foreground">
                    {match.rule.lastReviewedAt ?? "정보 없음"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>

        <aside className="rounded-[1rem] border border-stone-200 bg-white px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            근거
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-[1rem] border border-stone-200 bg-stone-50/60 px-4 py-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">출처</p>
              <p className="mt-2 text-2xl font-semibold leading-none text-foreground tabular-nums">
                {supportingSourceCount}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">근거 청크</p>
              <p className="mt-2 text-2xl font-semibold leading-none text-foreground tabular-nums">
                {supportingEvidenceCount}
              </p>
            </div>
          </div>

          {primarySource ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-accent-soft px-3 py-1 text-accent-strong">
                  {getSourceTrustSummary(primarySource)}
                </span>
                {primarySource.year ? (
                  <span className="rounded-full border border-stone-200 px-3 py-1 text-muted">
                    {primarySource.year}
                  </span>
                ) : null}
              </div>

              <Link
                href={`/sources/${primarySource.id}`}
                className="block text-base font-semibold leading-7 text-foreground transition hover:text-stone-700"
              >
                {primarySource.title}
              </Link>

              <div className="flex flex-wrap gap-2">
                {primaryLinks.length > 0 ? (
                  primaryLinks.map((link) => (
                    <a
                      key={`${primarySource.id}-${link.label}-${link.url}`}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-foreground transition duration-150 hover:border-stone-300 hover:bg-stone-50"
                    >
                      {link.label}
                    </a>
                  ))
                ) : (
                  <span className="text-xs text-muted">외부 원문 링크 정보가 아직 없습니다.</span>
                )}
              </div>

              <div className="rounded-[1rem] border border-stone-200 bg-stone-50/60 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {primaryEvidence ? getEvidenceExcerptLabel(primaryEvidence) : "대표 근거"}
                </p>
                <blockquote className="mt-3 text-sm leading-7 text-foreground">
                  {primaryEvidenceExcerpt
                    ? hasOriginalEvidenceExcerpt(primaryEvidence!)
                      ? `"${primaryEvidenceExcerpt}"`
                      : primaryEvidenceExcerpt
                    : "대표 근거 문장이 아직 등록되지 않았습니다."}
                </blockquote>
                {primaryEvidenceSecondary ? (
                  <p className="mt-3 text-sm leading-6 text-muted">{primaryEvidenceSecondary}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-muted">연결된 주요 레퍼런스가 아직 없습니다.</p>
          )}
        </aside>
      </div>

      <details className="mt-5 rounded-[1rem] border border-stone-200 bg-white" open={defaultExpandedEvidence}>
        <summary className="list-none px-4 py-4 text-sm font-semibold text-foreground">
          세부 조건과 근거 더 보기
        </summary>

        <div className="grid gap-5 border-t border-stone-200 px-4 py-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-5">
            <section>
              <h4 className="text-sm font-semibold text-foreground">규칙 요약</h4>
              <dl className="mt-3 grid gap-3 text-sm">
                <div className="rounded-[1rem] border border-border-subtle bg-white/72 px-4 py-3">
                  <dt className="font-medium text-muted">현재 안내 문구</dt>
                  <dd className="mt-1 leading-6 text-foreground">
                    {toPoliteRuleSummary(match.rule.messageLong || match.resolvedMessage)}
                  </dd>
                </div>
                <div className="rounded-[1rem] border border-border-subtle bg-white/72 px-4 py-3">
                  <dt className="font-medium text-muted">현재 연결 조건</dt>
                  <dd className="mt-1 leading-6 text-foreground">{getTargetSummary(match)}</dd>
                </div>
                <div className="rounded-[1rem] border border-border-subtle bg-white/72 px-4 py-3">
                  <dt className="font-medium text-muted">추가로 확인하면 좋은 정보</dt>
                  <dd className="mt-1 leading-6 text-foreground">
                    {match.needsMoreInfo.length > 0
                      ? sanitizeExplanations(match.needsMoreInfo, "추가 정보는 없습니다.")
                          .map(humanizeMissingReason)
                          .join(" / ")
                      : "추가 정보는 없습니다."}
                  </dd>
                </div>
                <div className="rounded-[1rem] border border-border-subtle bg-white/72 px-4 py-3">
                  <dt className="font-medium text-muted">약물 상호작용</dt>
                  <dd className="mt-1 leading-6 text-foreground">{renderList(match.rule.interactionDrugs)}</dd>
                </div>
                <div className="rounded-[1rem] border border-border-subtle bg-white/72 px-4 py-3">
                  <dt className="font-medium text-muted">질환/상태</dt>
                  <dd className="mt-1 leading-6 text-foreground">{renderList(match.rule.interactionDiseases)}</dd>
                </div>
              </dl>
            </section>

            {sortedSources.length > 0 ? (
              <section>
                <h4 className="text-sm font-semibold text-foreground">연결된 출처</h4>
                <ul className="mt-3 space-y-3">
                  {sortedSources.map((source) => {
                    const externalLinks = getSourceReferenceLinks(source);

                    return (
                      <li key={source.id} className="rounded-[1.25rem] border border-border-subtle bg-white/76 px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent-strong">
                            {getSourceTrustSummary(source)}
                          </span>
                          {source.year ? (
                            <span className="rounded-full border border-border-subtle px-2.5 py-1 text-muted">
                              {source.year}
                            </span>
                          ) : null}
                          {source.jurisdiction ? (
                            <span className="rounded-full border border-border-subtle px-2.5 py-1 text-muted">
                              {source.jurisdiction}
                            </span>
                          ) : null}
                        </div>

                        <Link
                          href={`/sources/${source.id}`}
                          className="mt-3 block text-sm font-semibold leading-6 text-foreground underline decoration-border-subtle underline-offset-4"
                        >
                          {source.title}
                        </Link>
                        <p className="mt-1 text-xs leading-5 text-muted">
                          {source.journalOrPublisher ?? "발행 정보 없음"}
                        </p>

                        {externalLinks.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {externalLinks.map((link) => (
                              <a
                                key={`${source.id}-${link.label}-${link.url}`}
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-border-subtle px-3 py-1.5 text-xs font-medium text-foreground transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:bg-white"
                              >
                                {link.label}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>

          {sortedEvidenceChunks.length > 0 ? (
            <section>
              <h4 className="text-sm font-semibold text-foreground">근거 확인 포인트</h4>
              <ul className="mt-3 space-y-3">
                {sortedEvidenceChunks.map((chunk) => {
                  const source = sourceLookup.get(chunk.sourceId) ?? null;
                  const searchKeywords = getEvidenceSearchKeywords(chunk);
                  const claimLabel = getEvidenceClaimLabel(chunk);
                  const primaryExcerpt = getEvidencePrimaryExcerpt(chunk);
                  const secondaryExcerpt = getEvidenceSecondaryExcerpt(chunk);

                  return (
                    <li key={chunk.id} className="rounded-[1.25rem] border border-border-subtle bg-white/76 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        {claimLabel ? (
                          <span className="rounded-full bg-foreground px-2.5 py-1 text-white">{claimLabel}</span>
                        ) : null}
                        {source ? (
                          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent-strong">
                            {getSourceTrustSummary(source)}
                          </span>
                        ) : null}
                        {getEvidenceLocatorText(chunk) ? (
                          <span className="rounded-full border border-border-subtle px-2.5 py-1 text-muted">
                            {getEvidenceLocatorText(chunk)}
                          </span>
                        ) : null}
                      </div>

                      {source ? (
                        <p className="mt-3 text-sm font-semibold leading-6 text-foreground">{source.title}</p>
                      ) : null}

                      {primaryExcerpt ? (
                        <div className="mt-3 rounded-[1rem] bg-stone-50 px-4 py-4">
                          <p className="text-xs font-semibold text-muted">{getEvidenceExcerptLabel(chunk)}</p>
                          <blockquote className="mt-2 text-sm leading-6 text-foreground">
                            {hasOriginalEvidenceExcerpt(chunk) ? `"${primaryExcerpt}"` : primaryExcerpt}
                          </blockquote>
                          {secondaryExcerpt ? (
                            <p className="mt-3 text-sm leading-6 text-muted">{secondaryExcerpt}</p>
                          ) : null}
                        </div>
                      ) : null}

                      <p className="mt-3 text-sm leading-6 text-foreground">
                        {getEvidenceCheckHint(chunk, source)}
                      </p>

                      {searchKeywords.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {searchKeywords.map((keyword) => (
                            <span
                              key={`${chunk.id}-${keyword}`}
                              className="rounded-full border border-border-subtle bg-white px-2.5 py-1 text-[11px] text-muted"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <section className="rounded-[1.25rem] border border-dashed border-border-subtle bg-white/56 px-4 py-5">
              <h4 className="text-sm font-semibold text-foreground">근거 확인 포인트</h4>
              <p className="mt-2 text-sm leading-6 text-muted">현재 연결된 근거 청크가 없습니다.</p>
            </section>
          )}
        </div>
      </details>
    </article>
  );
}
