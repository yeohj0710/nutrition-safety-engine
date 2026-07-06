"use client";

import Link from "next/link";

import type { AiExplanation } from "@/src/lib/ai/schema";
import { cleanDisplayText } from "@/src/lib/display-text";
import {
  buildDeterministicSummarySegments,
  buildEvidenceCitationsFromResponse,
  type CitedSummarySegment,
  type EvidenceCitation,
} from "@/src/lib/evidence-citations";
import type { EngineResponse } from "@/src/types/knowledge";

export type AiGuidanceStatus = "idle" | "loading" | "ready" | "fallback";

type ResultOverviewItem = {
  key: string;
  shortLabel: string;
  count: number;
};

function normalizeCitationNumbers(
  numbers: number[] | undefined,
  citations: EvidenceCitation[],
) {
  const validNumbers = new Set(citations.map((citation) => citation.citationNumber));
  return [...new Set(numbers ?? [])].filter((number) =>
    validNumbers.has(number),
  );
}

function normalizeAiSegments(
  explanation: AiExplanation | null,
  citations: EvidenceCitation[],
) {
  const segments = explanation?.integratedSummary?.segments ?? [];

  return segments
    .map((segment) => ({
      text: cleanDisplayText(segment.text) ?? "",
      citationNumbers: normalizeCitationNumbers(
        segment.citationNumbers,
        citations,
      ),
    }))
    .filter((segment) => segment.text.length > 0);
}

function CitationMarks({
  numbers,
  citations,
}: {
  numbers: number[];
  citations: EvidenceCitation[];
}) {
  const normalized = normalizeCitationNumbers(numbers, citations);
  if (normalized.length === 0) return null;

  return (
    <span className="ml-1 inline-flex translate-y-[-0.2em] items-start gap-0.5 align-super text-[0.62em] font-semibold leading-none">
      {normalized.map((number) => (
        <a
          key={`summary-citation-${number}`}
          href={`#result-ref-${number}`}
          className="rounded-[0.25rem] px-0.5 text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
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
    <p className="break-keep text-[1.06rem] font-semibold leading-[1.85] text-stone-950 md:text-[1.42rem] md:leading-[1.72]">
      {segments.map((segment, index) => (
        <span key={`${segment.text}-${index}`}>
          {index > 0 ? " " : null}
          {segment.text}
          <CitationMarks
            numbers={segment.citationNumbers}
            citations={citations}
          />
        </span>
      ))}
    </p>
  );
}

function getStatusLabel(status: AiGuidanceStatus) {
  if (status === "loading") return "AI 정리 중";
  if (status === "ready") return "AI 종합 요약";
  return "규칙 기반 요약";
}

function getSourceHref(citation: EvidenceCitation) {
  return citation.sourceId ? `/sources/${citation.sourceId}` : null;
}

function ReferenceList({ citations }: { citations: EvidenceCitation[] }) {
  if (citations.length === 0) {
    return (
      <p className="text-sm leading-6 text-stone-500">
        아직 이 결과에 연결된 출처가 없습니다.
      </p>
    );
  }

  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {citations.map((citation) => {
        const sourceHref = getSourceHref(citation);

        return (
          <li
            key={`result-ref-${citation.citationNumber}`}
            id={`result-ref-${citation.citationNumber}`}
            className="scroll-mt-24 rounded-[0.65rem] border border-stone-200 bg-white px-4 py-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-stone-500">
              <span className="rounded-[0.35rem] bg-stone-950 px-2 py-1 text-white">
                [{citation.citationNumber}]
              </span>
              {citation.sourceTrust ? (
                <span className="rounded-[0.35rem] bg-blue-50 px-2 py-1 text-blue-700">
                  {citation.sourceTrust}
                </span>
              ) : null}
              {citation.sourceYear ? (
                <span className="rounded-[0.35rem] border border-stone-200 px-2 py-1">
                  {citation.sourceYear}
                </span>
              ) : null}
              {citation.threshold ? (
                <span className="rounded-[0.35rem] border border-stone-200 px-2 py-1">
                  {citation.threshold}
                </span>
              ) : null}
            </div>

            {sourceHref ? (
              <Link
                href={sourceHref}
                className="mt-3 block break-words text-sm font-semibold leading-6 text-stone-950 underline decoration-stone-300 underline-offset-4 hover:text-stone-700"
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
              <p className="mt-3 text-sm leading-6 text-stone-700">
                {citation.excerpt}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {citation.externalUrl ? (
                <a
                  href={citation.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[0.45rem] border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
                >
                  원문 열기
                </a>
              ) : null}
              {sourceHref ? (
                <Link
                  href={sourceHref}
                  className="rounded-[0.45rem] border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
                >
                  출처 상세
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function EvidenceSummaryPanel({
  response,
  explanation,
  status,
  resultOverview,
}: {
  response: EngineResponse;
  explanation: AiExplanation | null;
  status: AiGuidanceStatus;
  resultOverview: readonly ResultOverviewItem[];
}) {
  const citations = buildEvidenceCitationsFromResponse(response);
  const aiSegments = normalizeAiSegments(explanation, citations);
  const summarySegments =
    aiSegments.length > 0
      ? aiSegments
      : buildDeterministicSummarySegments(response, citations);
  const title =
    cleanDisplayText(explanation?.integratedSummary?.title) ?? "핵심 총정리";

  return (
    <section className="overflow-hidden rounded-[0.75rem] border border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-5 py-5 md:px-7 md:py-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-bold text-blue-600">{title}</p>
            <h2 className="mt-2 text-[1.38rem] font-bold leading-[1.35] text-stone-950 md:text-[2rem]">
              근거를 한 문단으로 먼저 확인하세요
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-[0.45rem] bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white">
              결과{" "}
              {resultOverview
                .reduce((total, item) => total + item.count, 0)
                .toLocaleString("ko-KR")}
              건
            </span>
            <span className="rounded-[0.45rem] border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600">
              {getStatusLabel(status)}
            </span>
          </div>
        </div>

        <div className="mt-6 max-w-[58rem]">
          <SummaryParagraph segments={summarySegments} citations={citations} />
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          {resultOverview.map((item) => (
            <div
              key={`summary-count-${item.key}`}
              className="rounded-[0.55rem] border border-stone-200 bg-stone-50 px-4 py-3"
            >
              <p className="text-xs font-semibold text-stone-500">
                {item.shortLabel}
              </p>
              <p className="mt-1 text-[1.35rem] font-bold leading-none text-stone-950 tabular-nums">
                {item.count}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-stone-50 px-5 py-5 md:px-7">
        <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold text-stone-950">출처 각주</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              문단의 [번호]를 누르면 원문 링크와 근거 문장으로 이동합니다.
            </p>
          </div>
          <p className="text-xs text-stone-500">
            최대 {citations.length.toLocaleString("ko-KR")}개 표시
          </p>
        </div>
        <ReferenceList citations={citations} />
      </div>
    </section>
  );
}
