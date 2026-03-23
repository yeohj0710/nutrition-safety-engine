"use client";

import Link from "next/link";

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

function renderList(items: string[]) {
  return items.length > 0 ? items.join(", ") : "해당 없음";
}

export function RuleCard({ match }: { match: RuleMatch }) {
  const severityTone = severityToneMap[match.resolvedSeverity];
  const severityLabel = severityLabelMap[match.resolvedSeverity];

  return (
    <article className="rounded-3xl border border-stone-200 bg-white/95 p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityTone}`}>
              {severityLabel}
            </span>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
              {match.rule.ruleCategory}
            </span>
            {match.rule.jurisdiction ? (
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                {match.rule.jurisdiction}
              </span>
            ) : null}
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
            {match.matchedBecause.length > 0 ? match.matchedBecause.join(" / ") : "직접 매칭 이유 없음"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-900">추가 정보 필요</dt>
          <dd className="mt-1 text-stone-700">
            {match.needsMoreInfo.length > 0 ? match.needsMoreInfo.join(" / ") : "없음"}
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

      {match.supportingEvidenceChunks.length > 0 ? (
        <section className="mt-5 rounded-2xl bg-stone-50 p-4">
          <h4 className="text-sm font-semibold text-stone-900">근거 발췌</h4>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-700">
            {match.supportingEvidenceChunks.slice(0, 2).map((chunk) => (
              <li key={chunk.id}>
                <span className="font-medium text-stone-900">
                  {chunk.locatorType ?? "위치"} {chunk.locatorValue ?? ""}
                </span>
                <span className="ml-2">{chunk.summary ?? chunk.quote ?? chunk.chunkText}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 border-t border-stone-100 pt-4 text-sm text-stone-600">
        <p>
          출처:{" "}
          {match.supportingSources.length > 0
            ? match.supportingSources.map((source) => source.title).join(" / ")
            : "연결된 출처 없음"}
        </p>
        {match.rule.lastReviewedAt ? <p>마지막 검토: {match.rule.lastReviewedAt.slice(0, 10)}</p> : null}
      </div>
    </article>
  );
}
