"use client";

import Link from "next/link";

import {
  buildDeterministicSummarySegments,
  buildEvidenceCitationsFromResponse,
  type CitedSummarySegment,
  type EvidenceCitation,
} from "@/src/lib/evidence-citations";
import type { EngineResponse } from "@/src/types/knowledge";

type ResultOverviewItem = {
  key: string;
  shortLabel: string;
  count: number;
};

function CitationMarks({
  numbers,
  citations,
}: {
  numbers: number[];
  citations: EvidenceCitation[];
}) {
  const valid = new Set(citations.map((citation) => citation.citationNumber));
  const normalized = [...new Set(numbers)].filter((number) => valid.has(number));
  if (normalized.length === 0) return null;

  return (
    <span className="ml-1 inline-flex translate-y-[-0.2em] gap-0.5 align-super text-[0.62em] font-semibold leading-none">
      {normalized.map((number) => (
        <a
          key={`summary-citation-${number}`}
          href={`#result-ref-${number}`}
          className="rounded px-0.5 text-blue-600 hover:bg-blue-50"
          aria-label={`${number}번 출처로 이동`}
        >
          [{number}]
        </a>
      ))}
    </span>
  );
}

function SummaryParagraph({
  segments,
  citations,
}: {
  segments: CitedSummarySegment[];
  citations: EvidenceCitation[];
}) {
  return (
    <p className="break-keep text-lg font-semibold leading-8 text-stone-950 md:text-2xl md:leading-10">
      {segments.map((segment, index) => (
        <span key={`${segment.text}-${index}`}>
          {index > 0 ? " " : null}
          {segment.text}
          <CitationMarks numbers={segment.citationNumbers} citations={citations} />
        </span>
      ))}
    </p>
  );
}

function ReferenceList({ citations }: { citations: EvidenceCitation[] }) {
  if (citations.length === 0) {
    return <p className="text-sm leading-6 text-stone-500">연결된 출처가 없습니다.</p>;
  }

  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {citations.map((citation) => {
        const sourceHref = citation.sourceId
          ? `/legacy/sources/${citation.sourceId}`
          : null;
        return (
          <li
            key={`result-ref-${citation.citationNumber}`}
            id={`result-ref-${citation.citationNumber}`}
            className="scroll-mt-24 rounded-xl border border-stone-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span className="rounded-md bg-stone-950 px-2 py-1 font-semibold text-white">
                [{citation.citationNumber}]
              </span>
              {citation.sourceTrust ? <span>{citation.sourceTrust}</span> : null}
              {citation.sourceYear ? <span>{citation.sourceYear}</span> : null}
            </div>
            {sourceHref ? (
              <Link
                href={sourceHref}
                className="mt-3 block break-words text-sm font-semibold leading-6 text-stone-950 underline decoration-stone-300 underline-offset-4"
              >
                {citation.sourceTitle}
              </Link>
            ) : (
              <p className="mt-3 break-words text-sm font-semibold leading-6 text-stone-950">
                {citation.sourceTitle}
              </p>
            )}
            <p className="mt-1 text-xs leading-5 text-stone-500">
              {[citation.journalOrPublisher, citation.locator, citation.claimLabel]
                .filter(Boolean)
                .join(" · ") || "출처 메타데이터 확인 필요"}
            </p>
            {citation.excerpt ? (
              <p className="mt-3 text-sm leading-6 text-stone-700">{citation.excerpt}</p>
            ) : null}
            {citation.externalUrl ? (
              <a
                href={citation.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-800"
              >
                원문 열기
              </a>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function EvidenceSummaryPanel({
  response,
  resultOverview,
}: {
  response: EngineResponse;
  resultOverview: readonly ResultOverviewItem[];
}) {
  const citations = buildEvidenceCitationsFromResponse(response);
  const segments = buildDeterministicSummarySegments(response, citations);

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="border-b border-stone-200 p-5 md:p-7">
        <p className="text-sm font-bold text-blue-600">결정론적 규칙 요약</p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-stone-950">
          근거와 결과를 함께 확인하세요
        </h2>
        <div className="mt-6 max-w-4xl">
          <SummaryParagraph segments={segments} citations={citations} />
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          {resultOverview.map((item) => (
            <div key={item.key} className="rounded-xl bg-[#f7f8fa] p-4">
              <p className="text-xs font-semibold text-stone-500">{item.shortLabel}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-stone-950">
                {item.count}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#f7f8fa] p-5 md:p-7">
        <p className="mb-3 text-sm font-bold text-stone-950">출처 각주</p>
        <ReferenceList citations={citations} />
      </div>
    </section>
  );
}
