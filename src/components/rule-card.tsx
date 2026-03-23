"use client";

import Link from "next/link";
import { useState } from "react";

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
  dose_limit: "섭취량 기준",
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
    .map((item) => (/[�?]/.test(item) ? fallback : item));

  return cleaned.length > 0 ? cleaned : [fallback];
}

function formatBadgeLabel(value: string | null | undefined) {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

export function RuleCard({
  match,
  defaultExpandedEvidence = false,
}: {
  match: RuleMatch;
  defaultExpandedEvidence?: boolean;
}) {
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(defaultExpandedEvidence);
  const severityTone = severityToneMap[match.resolvedSeverity];
  const severityLabel = severityLabelMap[match.resolvedSeverity];
  const sourceLookup = new Map(match.supportingSources.map((source) => [source.id, source]));
  const sortedSources = sortSourcesByPriority(match.supportingSources);
  const sortedEvidenceChunks = sortEvidenceChunksByPriority(match.supportingEvidenceChunks, sourceLookup);

  return (
    <article className="rounded-3xl border border-stone-200 bg-white/95 p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityTone}`}>
              {severityLabel}
            </span>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
              {ruleCategoryLabelMap[match.rule.ruleCategory] ?? match.rule.ruleCategory}
            </span>
            {match.rule.jurisdiction ? (
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                {match.rule.jurisdiction}
              </span>
            ) : null}
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
              신뢰도 {match.rule.confidence}
            </span>
          </div>
          <h3 className="text-xl font-semibold text-stone-950">{match.rule.nutrientOrIngredient}</h3>
          <p className="text-sm leading-6 text-stone-700">{match.resolvedMessage}</p>
        </div>
        <Link
          href={`/rules/${match.ruleId}`}
          className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
        >
          규칙 상세
        </Link>
      </div>

      <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
        <div>
          <dt className="font-semibold text-stone-900">매칭 이유</dt>
          <dd className="mt-1 text-stone-700">
            {sanitizeExplanations(match.matchedBecause, "프로필 조건과 규칙 조건이 일치했습니다.").join(" / ")}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-900">추가 정보 필요</dt>
          <dd className="mt-1 text-stone-700">
            {match.needsMoreInfo.length > 0
              ? sanitizeExplanations(match.needsMoreInfo, "필수 프로필 정보가 더 필요합니다.").join(" / ")
              : "없음"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-900">대상 집단</dt>
          <dd className="mt-1 text-stone-700">
            {match.rule.populationTags.length > 0
              ? match.rule.populationTags.join(", ")
              : match.rule.conditions.map((condition) => condition.labelKo).filter(Boolean).join(", ") || "일반"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-900">기준값</dt>
          <dd className="mt-1 text-stone-700">
            {match.rule.threshold !== null && match.rule.thresholdOperator && match.rule.unit
              ? `${match.rule.thresholdOperator} ${match.rule.threshold} ${match.rule.unit}`
              : "정량 기준 없음"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-900">약물 상호작용</dt>
          <dd className="mt-1 text-stone-700">{renderList(match.rule.interactionDrugs)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-900">질환 상호작용</dt>
          <dd className="mt-1 text-stone-700">{renderList(match.rule.interactionDiseases)}</dd>
        </div>
      </dl>

      <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50/80">
        <button
          type="button"
          aria-expanded={isEvidenceOpen}
          onClick={() => setIsEvidenceOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-stone-900">근거 및 참고문헌</p>
            <p className="mt-1 text-xs text-stone-600">
              출처 {sortedSources.length}건 · 근거 청크 {sortedEvidenceChunks.length}건
            </p>
          </div>
          <span className="text-sm text-stone-600">{isEvidenceOpen ? "접기" : "펼치기"}</span>
        </button>

        {isEvidenceOpen ? (
          <div className="space-y-4 border-t border-stone-200 px-4 py-4">
            {sortedSources.length > 0 ? (
              <section>
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-stone-900">근거 출처</h4>
                  <span className="text-xs text-stone-500">신뢰도 높은 순으로 정렬</span>
                </div>
                <ul className="mt-3 space-y-3">
                  {sortedSources.map((source) => {
                    const externalLinks = getSourceReferenceLinks(source);

                    return (
                      <li key={source.id} className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-900">
                                {getSourceTrustSummary(source)}
                              </span>
                              {source.year ? (
                                <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">{source.year}</span>
                              ) : null}
                              {source.jurisdiction ? (
                                <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">
                                  {source.jurisdiction}
                                </span>
                              ) : null}
                              {source.evidenceLevel ? (
                                <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">
                                  {formatBadgeLabel(source.evidenceLevel)}
                                </span>
                              ) : null}
                            </div>
                            <div>
                              <p className="font-semibold text-stone-950">{source.title}</p>
                              <p className="mt-1 text-stone-700">{source.journalOrPublisher ?? "발행 정보 없음"}</p>
                              <p className="mt-1 text-xs text-stone-500">{source.id}</p>
                            </div>
                          </div>
                          <Link
                            href={`/sources/${source.id}`}
                            className="rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                          >
                            출처 상세
                          </Link>
                        </div>

                        {externalLinks.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
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
                <h4 className="text-sm font-semibold text-stone-900">근거 청크</h4>
                <ul className="mt-3 space-y-3">
                  {sortedEvidenceChunks.map((chunk) => {
                    const source = sourceLookup.get(chunk.sourceId) ?? null;
                    const externalLinks = source ? getSourceReferenceLinks(source) : [];
                    const searchKeywords = getEvidenceSearchKeywords(chunk);
                    const claimLabel = getEvidenceClaimLabel(chunk);

                    return (
                      <li key={chunk.id} className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              {claimLabel ? (
                                <span className="rounded-full bg-stone-900 px-3 py-1 text-white">{claimLabel}</span>
                              ) : null}
                              {source ? (
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-900">
                                  {getSourceTrustSummary(source)}
                                </span>
                              ) : null}
                            </div>
                            <div>
                              <p className="font-semibold text-stone-950">{source?.title ?? "연결된 출처 없음"}</p>
                              <p className="mt-1 text-xs text-stone-500">{chunk.id}</p>
                            </div>
                          </div>
                          <div className="max-w-sm rounded-2xl bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-600">
                            <span className="font-semibold text-stone-800">위치</span>
                            <span className="ml-2">{getEvidenceLocatorText(chunk) || "미상"}</span>
                          </div>
                        </div>

                        <div className="mt-3 rounded-2xl bg-stone-50 px-4 py-3 leading-6 text-stone-700">
                          {chunk.summary ?? chunk.quote ?? chunk.chunkText ?? "발췌 내용 없음"}
                        </div>

                        <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Direct Check</p>
                          <p className="mt-2 text-sm leading-6 text-stone-700">{getEvidenceCheckHint(chunk, source)}</p>
                        </div>

                        {searchKeywords.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                              찾아볼 키워드
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {searchKeywords.map((keyword) => (
                                <span
                                  key={`${chunk.id}-${keyword}`}
                                  className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700"
                                >
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {source ? (
                            <Link
                              href={`/sources/${source.id}`}
                              className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                            >
                              출처 상세
                            </Link>
                          ) : null}
                          {externalLinks.map((link) => (
                            <a
                              key={`${chunk.id}-${link.label}-${link.url}`}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                            >
                              {link.label}
                            </a>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-stone-100 pt-4 text-sm text-stone-600">
        <p>
          출처:{" "}
          {sortedSources.length > 0
            ? sortedSources.map((source) => source.title).join(" / ")
            : "연결된 출처 없음"}
        </p>
        {match.rule.lastReviewedAt ? <p>마지막 검토 {match.rule.lastReviewedAt.slice(0, 10)}</p> : null}
      </div>
    </article>
  );
}
