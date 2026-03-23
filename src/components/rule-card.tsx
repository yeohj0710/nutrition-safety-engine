import Link from "next/link";

import {
  getEvidenceCheckHint,
  getEvidenceClaimLabel,
  getEvidenceLocatorText,
  getEvidenceSearchKeywords,
  getSourceReferenceLinks,
  getSourceTrustSummary,
  sortEvidenceChunksByPriority,
  sortSourcesByPriority,
} from "@/src/lib/references";
import type { RuleMatch } from "@/src/types/knowledge";

const severityLabelMap = {
  contraindicated: "금지/중단",
  avoid: "금지/중단",
  warn: "강한 주의",
  monitor: "일반 주의",
} as const;

const severityToneMap = {
  contraindicated: "border-red-300 bg-red-50 text-red-900",
  avoid: "border-red-300 bg-red-50 text-red-900",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  monitor: "border-sky-300 bg-sky-50 text-sky-900",
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
    const labels = match.rule.conditions
      .map((condition) => condition.labelKo)
      .filter(Boolean);

    if (labels.length > 0) {
      targets.push(`조건: ${labels.join(", ")}`);
    }
  }

  return targets.length > 0 ? targets.join(" / ") : "일반 사용자 기준 참고 규칙";
}

export function RuleCard({
  match,
  defaultExpandedEvidence = false,
}: {
  match: RuleMatch;
  defaultExpandedEvidence?: boolean;
}) {
  const severityTone = severityToneMap[match.resolvedSeverity];
  const severityLabel = severityLabelMap[match.resolvedSeverity];
  const sourceLookup = new Map(
    match.supportingSources.map((source) => [source.id, source]),
  );
  const sortedSources = sortSourcesByPriority(match.supportingSources);
  const sortedEvidenceChunks = sortEvidenceChunksByPriority(
    match.supportingEvidenceChunks,
    sourceLookup,
  );
  const primarySource = sortedSources[0] ?? null;
  const primaryLinks = primarySource ? getSourceReferenceLinks(primarySource) : [];

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${severityTone}`}
            >
              {severityLabel}
            </span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] text-stone-700">
              {ruleCategoryLabelMap[match.rule.ruleCategory] ??
                match.rule.ruleCategory}
            </span>
            {match.rule.jurisdiction ? (
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] text-stone-700">
                {match.rule.jurisdiction}
              </span>
            ) : null}
          </div>
          <h3 className="text-lg font-semibold text-stone-950">
            {match.rule.nutrientOrIngredient}
          </h3>
          <p className="text-sm leading-6 text-stone-700">
            {match.resolvedMessage}
          </p>
        </div>

        <Link
          href={`/rules/${match.ruleId}`}
          className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
        >
          규칙 상세
        </Link>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-xl bg-stone-50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            조건 대상
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-800">
            {getTargetSummary(match)}
          </p>
        </div>

        <div className="rounded-xl bg-stone-50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            논문 원문 / 레퍼런스
          </p>
          {primarySource ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-900">
                  {getSourceTrustSummary(primarySource)}
                </span>
                {primarySource.year ? (
                  <span className="rounded-full bg-white px-2.5 py-1 text-stone-700">
                    {primarySource.year}
                  </span>
                ) : null}
              </div>
              <Link
                href={`/sources/${primarySource.id}`}
                className="block text-sm font-medium leading-6 text-stone-900 underline decoration-stone-300 underline-offset-4"
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
                      className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                    >
                      {link.label}
                    </a>
                  ))
                ) : (
                  <span className="text-xs text-stone-500">
                    외부 원문 링크 정보 없음
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-stone-500">
              연결된 레퍼런스가 없습니다.
            </p>
          )}
        </div>
      </div>

      <details
        className="mt-4 rounded-xl border border-stone-200 bg-stone-50/70"
        open={defaultExpandedEvidence}
      >
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-stone-700">
          자세히 보기
        </summary>

        <div className="space-y-4 border-t border-stone-200 px-4 py-4">
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="font-semibold text-stone-900">매칭 이유</dt>
              <dd className="mt-1 text-stone-700">
                {sanitizeExplanations(
                  match.matchedBecause,
                  "프로필 조건과 규칙 조건이 일치합니다.",
                ).join(" / ")}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-900">추가 정보 필요</dt>
              <dd className="mt-1 text-stone-700">
                {match.needsMoreInfo.length > 0
                  ? sanitizeExplanations(
                      match.needsMoreInfo,
                      "추가 프로필 정보가 필요합니다.",
                    ).join(" / ")
                  : "없음"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-900">정량 기준</dt>
              <dd className="mt-1 text-stone-700">
                {match.rule.threshold !== null &&
                match.rule.thresholdOperator &&
                match.rule.unit
                  ? `${match.rule.thresholdOperator} ${match.rule.threshold} ${match.rule.unit}`
                  : "정량 기준 없음"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-900">신뢰도</dt>
              <dd className="mt-1 text-stone-700">
                {match.rule.confidence}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-900">약물 상호작용</dt>
              <dd className="mt-1 text-stone-700">
                {renderList(match.rule.interactionDrugs)}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-900">질환 상호작용</dt>
              <dd className="mt-1 text-stone-700">
                {renderList(match.rule.interactionDiseases)}
              </dd>
            </div>
          </dl>

          {sortedSources.length > 0 ? (
            <section>
              <h4 className="text-sm font-semibold text-stone-900">
                출처 목록
              </h4>
              <ul className="mt-3 space-y-3">
                {sortedSources.map((source) => {
                  const externalLinks = getSourceReferenceLinks(source);

                  return (
                    <li
                      key={source.id}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-900">
                          {getSourceTrustSummary(source)}
                        </span>
                        {source.year ? (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-700">
                            {source.year}
                          </span>
                        ) : null}
                        {source.jurisdiction ? (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-700">
                            {source.jurisdiction}
                          </span>
                        ) : null}
                        {source.evidenceLevel ? (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-700">
                            {formatBadgeLabel(source.evidenceLevel)}
                          </span>
                        ) : null}
                      </div>
                      <Link
                        href={`/sources/${source.id}`}
                        className="mt-2 block text-sm font-medium leading-6 text-stone-900 underline decoration-stone-300 underline-offset-4"
                      >
                        {source.title}
                      </Link>
                      <p className="mt-1 text-xs text-stone-500">
                        {source.journalOrPublisher ?? "발행 정보 없음"}
                      </p>
                      {externalLinks.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {externalLinks.map((link) => (
                            <a
                              key={`${source.id}-${link.label}-${link.url}`}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
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

          {sortedEvidenceChunks.length > 0 ? (
            <section>
              <h4 className="text-sm font-semibold text-stone-900">
                근거 확인 포인트
              </h4>
              <ul className="mt-3 space-y-3">
                {sortedEvidenceChunks.map((chunk) => {
                  const source = sourceLookup.get(chunk.sourceId) ?? null;
                  const searchKeywords = getEvidenceSearchKeywords(chunk);
                  const claimLabel = getEvidenceClaimLabel(chunk);

                  return (
                    <li
                      key={chunk.id}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        {claimLabel ? (
                          <span className="rounded-full bg-stone-900 px-2.5 py-1 text-white">
                            {claimLabel}
                          </span>
                        ) : null}
                        {source ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-900">
                            {getSourceTrustSummary(source)}
                          </span>
                        ) : null}
                      </div>

                      {source ? (
                        <p className="mt-2 text-sm font-medium text-stone-900">
                          {source.title}
                        </p>
                      ) : null}

                      {getEvidenceLocatorText(chunk) ? (
                        <p className="mt-2 text-xs text-stone-500">
                          위치: {getEvidenceLocatorText(chunk)}
                        </p>
                      ) : null}

                      <div className="mt-2 rounded-xl bg-stone-50 px-3 py-3 text-sm leading-6 text-stone-700">
                        {chunk.summary ??
                          chunk.quote ??
                          chunk.chunkText ??
                          "발췌 내용 없음"}
                      </div>

                      <p className="mt-2 text-sm leading-6 text-stone-700">
                        {getEvidenceCheckHint(chunk, source)}
                      </p>

                      {searchKeywords.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {searchKeywords.map((keyword) => (
                            <span
                              key={`${chunk.id}-${keyword}`}
                              className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] text-stone-700"
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
          ) : null}
        </div>
      </details>
    </article>
  );
}
