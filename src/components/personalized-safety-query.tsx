"use client";

import {
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatedDetails } from "@/src/components/animated-details";
import { InfoTip } from "@/src/components/info-tip";
import {
  axes,
  axisById,
  evidenceOnlyDisclaimer,
  situations,
  type AxisId,
  type SituationId,
} from "@/src/lib/clinical-situations";
import { publicInputExamples } from "@/src/lib/personalized-safety-examples";
import { axisCoverage, coreCoverage } from "@/src/lib/axis-coverage";
import {
  flattenTranslatedFindings,
  splitEvidenceSentences,
} from "@/src/lib/evidence-sentences";

type EvidenceItem = {
  record_id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  url: string;
  source_locator: string;
  source_sentence: string;
  source_scope: "abstract_only" | "title_only";
  key_finding: string;
  key_finding_ko: string;
  publication_types: string;
  dose: string;
  population: string;
  outcome: string;
  translation_authorship: "ai_generated" | null;
  sentence_role:
    | "result_or_conclusion"
    | "background_or_methods"
    | "unclassified";
};

type AppliedAxis = {
  axis: AxisId;
  field: string;
  value: string;
  reported: number;
};

type ApiResult = {
  situation: SituationId;
  situation_label: string;
  research_question: string;
  applied_axes: AppliedAxis[];
  ignored_axes: AppliedAxis[];
  unavailable_axes: { axis: AxisId; field: string; value: string }[];
  core_evidence_count: number;
  evidence: EvidenceItem[];
  evidence_total_after_filter: number;
  evidence_summary: {
    displayed_records: number;
    unique_titles: number;
    source_scope: { abstract_only: number; title_only: number };
    ai_extracted_sentences: number;
    title_derived_records: number;
    ai_translated_sentences: number;
  };
  matching_basis:
    | "metadata_axis_presence"
    | "metadata_axis_presence_extended"
    | "question_core_evidence"
    | "expanded_question_corpus";
  filter_mode: "metadata_axis_presence" | "core";
  filter_trace: { axis: AxisId | "base"; label: string; count: number }[];
  query_snapshot: {
    situation: SituationId;
    requested_axes: AxisId[];
    active_axes: AxisId[];
  };
  checks: string[];
  summary: string;
  narrative?: string[];
  disclaimer: string;
  expanded: boolean;
  expanded_offset: number;
  expanded_page_size: number;
  extended_total: number;
  extended_pool_total: number;
  extended_match_total: number;
  extended_note: string;
  error?: string;
};

type FormState = {
  situation: SituationId | "";
  axes: AxisId[];
};

const emptyForm: FormState = { situation: "", axes: [] };
const SUMMARY_SENTENCE_LIMIT = 3;

function sortedAxes(values: AxisId[]) {
  return [...values].sort().join("|");
}

function isSameQuery(form: FormState, result: ApiResult) {
  return (
    form.situation === result.query_snapshot.situation &&
    sortedAxes(form.axes) === sortedAxes(result.query_snapshot.requested_axes)
  );
}

function resultCountLabel(result: ApiResult) {
  if (result.expanded) {
    const first = result.evidence.length ? result.expanded_offset + 1 : 0;
    const last = result.expanded_offset + result.evidence.length;
    const scope = result.applied_axes.length ? "표현 필터 뒤" : "확장 근거 전체";
    return `${scope} ${result.extended_total.toLocaleString("ko-KR")}건 · ${first}–${last}`;
  }
  if (result.filter_mode === "metadata_axis_presence") {
    return `표현 필터 뒤 ${result.evidence_total_after_filter.toLocaleString("ko-KR")}건`;
  }
  return `핵심 근거 ${result.evidence_total_after_filter.toLocaleString("ko-KR")}건`;
}

function resultHeading(result: ApiResult) {
  if (result.expanded)
    return result.applied_axes.length
      ? "선택한 표현이 있는 확장 근거"
      : "이 상황의 확장 근거";
  if (result.filter_mode === "metadata_axis_presence")
    return "선택한 표현이 있는 핵심 근거";
  return "이 상황의 핵심 근거";
}

function resultBasisCopy(result: ApiResult) {
  if (result.expanded)
    return result.applied_axes.length
      ? `이 상황의 근거 ${result.extended_pool_total.toLocaleString("ko-KR")}건 전체에 같은 표현 필터를 걸었습니다. 핵심 근거 15건 밖까지 포함합니다. 실제 값과 논문 내용을 대조하지는 않습니다.`
      : "확장 근거는 이 상황의 전체 후보 기록입니다. 기록을 페이지별로 보여줍니다.";
  if (result.filter_mode === "metadata_axis_presence")
    return "실제 나이·약 이름·용량 값과 논문 내용을 대조하지 않습니다. 선택한 종류의 표현이 초록에 포착됐는지만 확인합니다.";
  return "표현 필터를 적용하지 않은 상황별 핵심 근거입니다. 연구 질문별 우선순위에 따라 고른 기록을 보여줍니다.";
}

function resultStatusMessage(result: ApiResult) {
  if (result.expanded) {
    const scope = result.applied_axes.length ? "표현 필터 뒤" : "확장 근거 전체";
    if (!result.evidence.length)
      return `${scope} ${result.extended_total.toLocaleString("ko-KR")}건 중 표시할 기록이 없습니다.`;
    const first = result.expanded_offset + 1;
    const last = result.expanded_offset + result.evidence.length;
    return `${scope} ${result.extended_total.toLocaleString("ko-KR")}건 중 ${first}번째부터 ${last}번째 기록을 표시했습니다.`;
  }
  return `${result.evidence.length}건을 표시했습니다.`;
}

function locatorLabel(locator: string, sourceScope: EvidenceItem["source_scope"]) {
  if (sourceScope === "title_only" || locator === "TITLE") return "제목만 확인";
  const match = /^ABSTRACT_SENTENCE_(\d+)$/.exec(locator);
  return match ? `초록 ${match[1]}번째 문장` : locator || "초록 문장";
}

function sentenceRoleLabel(role: EvidenceItem["sentence_role"]) {
  if (role === "result_or_conclusion") return "결과·결론 문장";
  if (role === "background_or_methods") return "배경·방법 문장 · 해석 주의";
  return "문장 역할 자동 구분 안 됨";
}

function EvidenceFinding({
  item,
  number,
  sentence,
  sentenceIndex,
}: {
  item: EvidenceItem;
  number: number;
  sentence: string;
  sentenceIndex: number;
}) {
  const kind = item.publication_types.split("|")[0] || "연구유형 미표시";

  return (
    <li className="border-t border-blue-100 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-800">
        <span>AI 자동 번역</span>
        <span aria-hidden="true">·</span>
        <span>{item.year || "연도 미표시"}</span>
        <span aria-hidden="true">·</span>
        <span>{kind}</span>
        <span aria-hidden="true">·</span>
        <span>문장 {sentenceIndex + 1}</span>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <a
          href={`#result-ref-${number}`}
          aria-label={`${number}번 문헌의 ${sentenceIndex + 1}번째 문장 출처로 이동`}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 px-2 text-xs font-bold text-white no-underline transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {number}
        </a>
        <p className="pt-2 text-sm font-medium leading-6 text-[#333d4b]">
          {sentence}
        </p>
      </div>
      <p lang="en" className="mt-3 break-words text-xs leading-5 text-stone-600">
        {item.title}
      </p>
    </li>
  );
}

function ResultSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="surface-card motion-enter flex min-h-40 flex-col justify-center gap-4 rounded-2xl p-6"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"
        />
        <p className="text-sm font-semibold text-stone-800">
          선택한 표현 필터로 문헌을 연결하는 중…
        </p>
      </div>
      <div aria-hidden="true" className="grid gap-2">
        <span className="loading-skeleton block h-4 w-4/5 rounded" />
        <span className="loading-skeleton block h-4 w-3/5 rounded" />
      </div>
    </div>
  );
}

function EvidenceRecord({
  item,
  number,
}: {
  item: EvidenceItem;
  number: number;
}) {
  const metadata = [
    item.authors,
    item.venue,
    item.year ? String(item.year) : "",
    item.publication_types.split("|")[0],
  ].filter(Boolean);
  const locator = locatorLabel(item.source_locator, item.source_scope);

  return (
    <li
      id={`result-ref-${number}`}
      className="evidence-record flex scroll-mt-24 flex-col gap-4 py-6"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-stone-950 px-2 text-xs font-bold text-white">
          {number}
        </span>
        <div className="min-w-0">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            lang="en"
            className="break-words text-base font-bold leading-6 text-stone-950 underline decoration-stone-300 underline-offset-4 transition-colors hover:decoration-blue-500"
          >
            {item.title}
            <span className="sr-only"> 새 탭에서 PubMed 열림</span>
          </a>
          <p lang="en" className="mt-2 break-words text-xs leading-5 text-stone-500">
            {metadata.join(" · ") || "서지정보 미표시"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pl-11 text-xs font-semibold">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
          {item.source_scope === "abstract_only" ? "초록 범위" : "제목만"}
        </span>
        <span
          className={`rounded-full px-3 py-1 ${
            item.sentence_role === "background_or_methods"
              ? "bg-amber-50 text-amber-800"
              : "bg-stone-100 text-stone-600"
          }`}
        >
          {item.source_scope === "title_only"
            ? "제목 기반 · 문장 역할 구분 안 함"
            : sentenceRoleLabel(item.sentence_role)}
        </span>
      </div>

      {item.key_finding_ko ? (
        <div className="ml-11 rounded-xl bg-blue-50/70 p-4">
          <p className="text-xs font-bold text-blue-700">AI 자동 번역</p>
          <div className="mt-1 space-y-2 text-sm leading-6 text-stone-800">
            {splitEvidenceSentences(item.key_finding_ko).map(
              (sentence, sentenceIndex) => (
                <p key={`${item.record_id}-detail-${sentenceIndex}`}>
                  {sentence}
                </p>
              ),
            )}
          </div>
        </div>
      ) : null}

      <blockquote className="ml-11 border-l-2 border-blue-300 pl-4">
        <p className="text-xs font-bold text-blue-700">
          {item.source_scope === "title_only"
            ? `제목에서 가져옴 · ${locator}`
            : `AI 자동 추출 · ${locator}`}
        </p>
        <p lang="en" className="mt-1 break-words text-sm leading-6 text-stone-700">
          {item.source_sentence || "표시할 원문 문장이 없습니다."}
        </p>
      </blockquote>

      {item.population || item.dose || item.outcome ? (
        <details className="ml-11 rounded-xl border border-stone-200 bg-stone-50/70">
          <summary className="flex min-h-12 list-none items-center justify-between px-4 py-3 text-sm font-semibold text-stone-700">
            <span>자동 추출 정보 더 보기</span>
            <span aria-hidden="true" className="text-stone-400">↓</span>
          </summary>
          <dl className="grid gap-4 border-t border-stone-200 p-4 text-xs leading-5">
            {item.population ? (
              <div>
                <dt className="font-bold text-stone-700">연구 대상 표현</dt>
                <dd lang="en" className="mt-1 break-words text-stone-600">
                  {item.population}
                </dd>
              </div>
            ) : null}
            {item.dose ? (
              <div>
                <dt className="font-bold text-stone-700">포착된 용량 표현</dt>
                <dd lang="en" className="mt-1 break-words text-stone-600">
                  {item.dose}
                </dd>
              </div>
            ) : null}
            {item.outcome ? (
              <div>
                <dt className="font-bold text-stone-700">결과 관련 표현</dt>
                <dd lang="en" className="mt-1 break-words text-stone-600">
                  {item.outcome}
                </dd>
              </div>
            ) : null}
          </dl>
        </details>
      ) : null}
    </li>
  );
}

function focusSoon<T extends HTMLElement>(ref: RefObject<T | null>) {
  window.requestAnimationFrame(() => ref.current?.focus());
}

export function PersonalizedSafetyQuery() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [activeExample, setActiveExample] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const firstSituationRef = useRef<HTMLInputElement | null>(null);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  const run = useCallback(
    async (
      values: FormState,
      extra: { expanded?: boolean; offset?: number } = {},
      options: { scroll?: boolean } = {},
    ) => {
      if (!values.situation) {
        setError("먼저 문헌을 찾을 상황을 하나 선택하세요.");
        focusSoon(firstSituationRef);
        return;
      }

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setPending(true);
      setError("");

      try {
        const response = await fetch("/api/personalized-safety", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...values, ...extra }),
          signal: controller.signal,
        });
        const body = (await response.json()) as ApiResult;
        if (!response.ok) {
          setError(body.error ?? "문헌 결과를 불러오지 못했습니다. 다시 시도하세요.");
          focusSoon(errorRef);
          return;
        }

        setResult(body);
        window.requestAnimationFrame(() => {
          if (options.scroll !== false) {
            const reduceMotion = window.matchMedia(
              "(prefers-reduced-motion: reduce)",
            ).matches;
            resultRef.current?.scrollIntoView({
              behavior: reduceMotion ? "auto" : "smooth",
              block: "start",
            });
          }
          window.requestAnimationFrame(() =>
            resultHeadingRef.current?.focus({ preventScroll: true }),
          );
        });
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError("네트워크 문제로 문헌 결과를 불러오지 못했습니다. 다시 시도하세요.");
        focusSoon(errorRef);
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setPending(false);
        }
      }
    },
    [],
  );

  function selectSituation(situation: SituationId) {
    setForm((previous) => ({
      situation,
      axes: previous.axes.filter((axis) => axisCoverage[situation][axis] !== null),
    }));
    setActiveExample("");
    setError("");
  }

  function toggleAxis(axis: AxisId) {
    setForm((previous) => ({
      ...previous,
      axes: previous.axes.includes(axis)
        ? previous.axes.filter((item) => item !== axis)
        : [...previous.axes, axis],
    }));
    setActiveExample("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(form);
  }

  function runExample(example: (typeof publicInputExamples)[number]) {
    setForm(example.input);
    setActiveExample(example.id);
    void run(example.input);
  }

  function runResultPage(extra: { expanded?: boolean; offset?: number }) {
    if (!result) return;
    void run(
      {
        situation: result.query_snapshot.situation,
        axes: result.query_snapshot.requested_axes,
      },
      extra,
      { scroll: false },
    );
  }

  function reset() {
    requestRef.current?.abort();
    requestRef.current = null;
    setForm(emptyForm);
    setResult(null);
    setPending(false);
    setError("");
    setActiveExample("");
    focusSoon(firstSituationRef);
  }

  const staleResult = result ? !isSameQuery(form, result) : false;
  const selectedSituation = situations.find((item) => item.id === form.situation);
  const featuredExample = publicInputExamples[0];
  const otherExamples = publicInputExamples.slice(1);
  const findingSentences = result
    ? flattenTranslatedFindings(result.evidence)
    : [];

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="demo-title" className="rounded-2xl bg-blue-50 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p id="demo-title" className="text-base font-bold text-stone-950">
              20초 데모
            </p>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              연구 자료에 표시된 표현 종류로 결과를 좁히는 과정을 재현합니다.
            </p>
          </div>
          <InfoTip label="데모">
            데모는 개인 상태를 판정하지 않습니다. 연구 질문과 초록에서 포착한 표현을
            연결하는 방식만 보여줍니다.
          </InfoTip>
        </div>

        <button
          type="button"
          disabled={pending}
          aria-pressed={activeExample === featuredExample.id}
          onClick={() => runExample(featuredExample)}
          className="mt-4 flex min-h-12 w-full items-center justify-between gap-4 rounded-xl border border-blue-200 bg-white px-4 py-3 text-left transition-colors hover:border-blue-400 disabled:cursor-wait disabled:opacity-60"
        >
          <span className="min-w-0">
            <span className="block text-sm font-bold text-stone-950">
              {featuredExample.title}
            </span>
            <span className="mt-1 block text-xs leading-5 text-stone-600">
              {featuredExample.summary}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-blue-700 px-3 py-1 text-xs font-bold text-white">
            {featuredExample.expectedEvidenceCount}건
          </span>
        </button>

        <AnimatedDetails
          className="mt-3 rounded-xl border border-blue-200 bg-white/80"
          summaryClassName="flex min-h-12 list-none items-center justify-between px-4 py-3 text-sm font-semibold text-blue-800"
          bodyClassName="grid gap-2 border-t border-blue-100 p-3 sm:grid-cols-2"
          summary={
            <>
              <span>다른 상황 데모 {otherExamples.length}개</span>
              <span aria-hidden="true" className="collapsible-chevron">↓</span>
            </>
          }
        >
          {otherExamples.map((example) => (
            <button
              key={example.id}
              type="button"
              disabled={pending}
              aria-pressed={activeExample === example.id}
              onClick={() => runExample(example)}
              className="flex min-h-12 flex-col rounded-xl border border-stone-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="text-sm font-bold text-stone-900">{example.title}</span>
              <span className="mt-1 text-xs leading-5 text-stone-600">
                {example.summary}
              </span>
            </button>
          ))}
        </AnimatedDetails>
      </section>

      <form id="evidence-query-form" onSubmit={submit} className="scroll-mt-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <fieldset>
            <legend className="text-base font-bold text-stone-950">
              1. 문헌을 찾을 상황
              <span className="ml-2 text-xs font-semibold text-red-600">필수</span>
            </legend>
            <div className="mt-4 grid gap-2">
              {situations.map((situation, index) => {
                const checked = form.situation === situation.id;
                return (
                  <label key={situation.id} className="block cursor-pointer">
                    <input
                      ref={index === 0 ? firstSituationRef : undefined}
                      type="radio"
                      name="situation"
                      value={situation.id}
                      checked={checked}
                      onChange={() => selectSituation(situation.id)}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-blue-300 peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-800 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2">
                      <span>{situation.label}</span>
                      <span className="shrink-0 text-xs font-medium text-stone-500">
                        핵심 {coreCoverage[situation.id]}건
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-base font-bold text-stone-950">
              2. 초록 표현으로 좁히기
              <span className="ml-2 text-xs font-normal text-stone-500">선택</span>
            </legend>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              선택한 표현이 포착된 기록만 남깁니다. 나이·약 이름·용량 값 자체를 대조하지 않습니다.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {axes.map((axis) => {
                const coverage = form.situation
                  ? axisCoverage[form.situation][axis.id]
                  : undefined;
                const unavailable = coverage === null;
                const checked = form.axes.includes(axis.id);
                return (
                  <label
                    key={axis.id}
                    className={`flex min-h-12 items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      unavailable
                        ? "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400"
                        : checked
                          ? "cursor-pointer border-blue-500 bg-blue-50"
                          : "cursor-pointer border-stone-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="evidence-axis"
                      value={axis.id}
                      checked={checked}
                      disabled={!form.situation || unavailable}
                      onChange={() => toggleAxis(axis.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{axis.label}</span>
                      <span className="mt-1 block text-xs leading-5">
                        {!form.situation
                          ? "상황을 먼저 선택하세요"
                          : unavailable
                            ? "이 상황에는 필터 규칙이 없습니다"
                            : `${axis.filterHint} · ${coverage}건`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="sticky bottom-3 z-20 -mx-2 mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:static sm:mx-0 sm:rounded-none sm:border-x-0 sm:border-b-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-6 sm:shadow-none">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-blue-700 px-6 text-sm font-bold text-white transition-colors hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60 sm:flex-none"
          >
            {pending ? "문헌을 연결하는 중…" : "문헌 결과 보기"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50"
          >
            선택 초기화
          </button>
          {selectedSituation ? (
            <span className="text-sm text-stone-500">
              {selectedSituation.short} · 필터 {form.axes.length}개
            </span>
          ) : null}
        </div>
      </form>

      <div ref={resultRef} className="scroll-mt-20">
        <p role="status" aria-live="polite" className="sr-only">
          {pending
            ? "문헌 결과를 불러오는 중입니다."
            : error
              ? error
              : result
                ? resultStatusMessage(result)
                : ""}
        </p>

        {error ? (
          <div
            ref={errorRef}
            tabIndex={-1}
            aria-label="문헌 결과 오류"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700"
          >
            {error}
          </div>
        ) : null}

        {pending && !result ? <ResultSkeleton /> : null}

        {!pending && !result && !error ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
            <p className="text-base font-bold text-stone-800">아직 표시할 문헌이 없습니다</p>
            <p className="mx-auto mt-2 max-w-[42rem] text-sm leading-6 text-stone-500">
              위 데모를 실행하거나 상황을 선택해 문헌 결과를 확인하세요.
            </p>
          </div>
        ) : null}

        {result ? (
          <article
            aria-busy={pending}
            className={`rounded-2xl border border-stone-200 bg-white ${
              pending ? "opacity-60" : "motion-enter"
            }`}
          >
            <header className="flex flex-col gap-6 p-4 sm:p-6">
              {pending ? (
                <p className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">
                  새 조건의 문헌을 연결하는 중… 현재 결과는 요청이 끝날 때까지 유지합니다.
                </p>
              ) : null}
              {staleResult ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                  입력 선택이 바뀌었습니다. 아래 내용은 요청 당시 조건의 결과입니다.
                </p>
              ) : null}
              {result.expanded ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  {result.applied_axes.length
                    ? `확장 목록에도 같은 표현 필터를 걸었습니다. 이 상황의 근거 ${result.extended_pool_total.toLocaleString("ko-KR")}건 가운데 ${result.extended_total.toLocaleString("ko-KR")}건이 남았습니다. `
                    : "확장 목록은 이 상황의 전체 후보 기록입니다. "}
                  한국어 번역 없이 영어 근거 문장을 표시합니다.
                </p>
              ) : null}

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-700 px-3 py-1 text-xs font-bold text-white">
                    {result.situation_label}
                  </span>
                  <span className="text-xs font-semibold text-stone-500">
                    {resultCountLabel(result)}
                  </span>
                </div>
                <h2
                  ref={resultHeadingRef}
                  tabIndex={-1}
                  className="mt-3 max-w-[66ch] text-xl font-bold leading-8 text-stone-950 focus:outline-none sm:text-2xl"
                >
                  {resultHeading(result)}
                </h2>
                <p className="mt-2 max-w-[66ch] text-sm leading-6 text-stone-600">
                  요청 당시 조건: {result.situation_label}
                  {result.query_snapshot.requested_axes.length
                    ? ` · ${result.query_snapshot.requested_axes
                        .map((axis) => axisById.get(axis)?.label ?? axis)
                        .join(" · ")}`
                    : " · 표현 필터 없음"}
                </p>
              </div>

              <dl className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-stone-50 p-4">
                  <dt className="text-xs font-semibold text-stone-600">
                    {result.expanded ? "현재 페이지 기록" : "현재 표시 기록"}
                  </dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-stone-950">
                    {result.evidence_summary.displayed_records.toLocaleString("ko-KR")}건
                  </dd>
                </div>
                <div className="rounded-xl bg-stone-50 p-4">
                  <dt className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                    제목 기준 고유 문헌
                    <InfoTip label="제목 기준 고유 문헌">
                      제목을 영문 소문자와 공백 기준으로 정규화해 중복 제목을 한 편으로
                      계산했습니다. record ID 수와 다를 수 있습니다.
                    </InfoTip>
                  </dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-stone-950">
                    {result.evidence_summary.unique_titles.toLocaleString("ko-KR")}편
                  </dd>
                </div>
                <div className="rounded-xl bg-stone-50 p-4">
                  <dt className="text-xs font-semibold text-stone-600">출처 범위</dt>
                  <dd className="mt-1 text-sm font-bold leading-7 text-stone-950">
                    초록 {result.evidence_summary.source_scope.abstract_only}건 · 제목만{" "}
                    {result.evidence_summary.source_scope.title_only}건
                  </dd>
                </div>
              </dl>

              {result.filter_mode === "metadata_axis_presence" &&
              result.filter_trace.length > 1 ? (
                <div>
                  <p className="text-xs font-bold text-stone-700">필터별 기록 수</p>
                  <ol className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-600">
                    {result.filter_trace.map((step, index) => (
                      <li key={step.axis} className="flex items-center gap-2">
                        {index ? <span aria-hidden="true">→</span> : null}
                        <span className="rounded-full bg-stone-100 px-3 py-1.5">
                          {step.label} {step.count}건
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <div className="max-w-[66ch] rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-stone-700">
                <p className="font-bold text-stone-950">근거 범위를 먼저 확인하세요</p>
                <p className="mt-1">{resultBasisCopy(result)}</p>
                <p className="mt-2 text-xs text-stone-600">
                  초록 자동 추출 기록 {result.evidence_summary.ai_extracted_sentences}건 · AI 자동 번역 문장{" "}
                  {result.evidence_summary.ai_translated_sentences}개
                  {result.evidence_summary.title_derived_records
                    ? ` · 제목에서 가져온 기록 ${result.evidence_summary.title_derived_records}건`
                    : ""}
                </p>
              </div>

              {!result.expanded && findingSentences.length ? (
                <section aria-labelledby="evidence-findings-title" className="max-w-[66ch]">
                  <div className="flex items-center gap-2">
                    <h3 id="evidence-findings-title" className="text-base font-bold text-stone-950">
                      초록에서 자동 추출한 문장
                    </h3>
                    <InfoTip label="AI 자동 추출 문장">
                      초록 문장 중 자동 점수가 높은 문장을 골라 AI가 한국어로 번역했습니다.
                      사람의 원문 대조를 거친 문장이라는 뜻은 아닙니다.
                    </InfoTip>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    각 번역 문장은 그 문장을 가져온 문헌 번호 하나와 연결됩니다.
                  </p>
                  <ol className="mt-3 rounded-xl border border-blue-100 bg-blue-50/40 px-4">
                    {findingSentences
                      .slice(0, SUMMARY_SENTENCE_LIMIT)
                      .map((finding) => (
                        <EvidenceFinding
                          key={`${finding.item.record_id}-summary-${finding.sentenceIndex}`}
                          item={finding.item}
                          number={finding.paperNumber}
                          sentence={finding.sentence}
                          sentenceIndex={finding.sentenceIndex}
                        />
                      ))}
                  </ol>
                  {findingSentences.length > SUMMARY_SENTENCE_LIMIT ? (
                    <AnimatedDetails
                      className="mt-3 rounded-xl border border-blue-100"
                      summaryClassName="flex min-h-12 list-none items-center justify-between px-4 py-3 text-sm font-bold text-blue-700"
                      bodyClassName="border-t border-blue-100 px-4"
                      summary={
                        <>
                          <span>
                            나머지 {findingSentences.length - SUMMARY_SENTENCE_LIMIT}개 자동 추출 문장 보기
                          </span>
                          <span aria-hidden="true" className="collapsible-chevron">↓</span>
                        </>
                      }
                    >
                      <ol>
                        {findingSentences
                          .slice(SUMMARY_SENTENCE_LIMIT)
                          .map((finding) => (
                            <EvidenceFinding
                              key={`${finding.item.record_id}-remaining-${finding.sentenceIndex}`}
                              item={finding.item}
                              number={finding.paperNumber}
                              sentence={finding.sentence}
                              sentenceIndex={finding.sentenceIndex}
                            />
                          ))}
                      </ol>
                    </AnimatedDetails>
                  ) : null}
                </section>
              ) : null}

              {result.evidence.length ? (
                <nav aria-label="결과 안에서 이동" className="flex flex-wrap gap-2">
                  <a
                    href="#evidence-list"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-stone-950 px-5 text-sm font-bold text-white no-underline transition-colors hover:bg-stone-800"
                  >
                    전체 문헌 목록 보기
                  </a>
                  <a
                    href="#evidence-query-form"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-300 bg-white px-5 text-sm font-bold text-stone-700 no-underline transition-colors hover:border-blue-400"
                  >
                    선택 조건으로 돌아가기
                  </a>
                </nav>
              ) : null}

              <AnimatedDetails
                className="rounded-xl border border-stone-200"
                summaryClassName="flex min-h-12 list-none items-center justify-between px-4 py-3 text-sm font-semibold text-stone-800"
                bodyClassName="border-t border-stone-200 p-4"
                summary={
                  <>
                    <span>연구 질문과 추출 기준 보기</span>
                    <span aria-hidden="true" className="collapsible-chevron">↓</span>
                  </>
                }
              >
                <p className="max-w-[66ch] text-sm leading-6 text-stone-600">
                  <span className="font-bold text-stone-800">연구 질문</span>
                  <br />
                  {result.research_question}
                </p>
                {result.checks.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {result.checks.map((check) => (
                      <li
                        key={check}
                        className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600"
                      >
                        {check}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </AnimatedDetails>

              {result.unavailable_axes.length ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  이 상황에는 {result.unavailable_axes
                    .map((item) => axisById.get(item.axis)?.label ?? item.axis)
                    .join(", ")} 필터 규칙이 없어 적용하지 않았습니다.
                </p>
              ) : null}
            </header>

            {result.evidence.length ? (
              <ol
                id="evidence-list"
                className="scroll-mt-20 divide-y divide-stone-200 border-t border-stone-200 px-4 sm:px-6"
              >
                {result.evidence.map((item, index) => {
                  const number = result.expanded
                    ? result.expanded_offset + index + 1
                    : index + 1;
                  return <EvidenceRecord key={item.record_id} item={item} number={number} />;
                })}
              </ol>
            ) : (
              <div className="border-t border-stone-200 px-4 py-8 sm:px-6">
                <p className="text-sm leading-6 text-stone-700">
                  {result.expanded
                    ? "선택한 표현 종류를 모두 가진 확장 기록이 없습니다."
                    : result.filter_mode === "metadata_axis_presence"
                      ? "선택한 표현 종류를 모두 가진 핵심 기록이 없습니다."
                      : "이 상황에는 표시할 핵심 기록이 없습니다."}
                </p>
                {result.filter_mode === "metadata_axis_presence" &&
                result.query_snapshot.requested_axes.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next = {
                        situation: result.query_snapshot.situation,
                        axes: result.query_snapshot.requested_axes.slice(0, -1),
                      };
                      setForm(next);
                      void run(next);
                    }}
                    disabled={pending}
                    className="mt-4 inline-flex min-h-12 items-center rounded-xl border border-blue-700 px-5 text-sm font-bold text-blue-800 transition-colors hover:bg-blue-50 disabled:opacity-50"
                  >
                    마지막 필터 하나 빼기
                  </button>
                ) : null}
              </div>
            )}

            {result.extended_total > result.evidence.length || result.expanded ? (
              <div className="flex flex-col gap-3 border-t border-stone-200 px-4 py-5 sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  {result.expanded && result.expanded_offset > 0 ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        runResultPage({
                          expanded: true,
                          offset: Math.max(
                            0,
                            result.expanded_offset - result.expanded_page_size,
                          ),
                        })
                      }
                      className="inline-flex min-h-12 items-center rounded-xl border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-700 transition-colors hover:border-blue-400 disabled:opacity-50"
                    >
                      이전 {result.expanded_page_size}건
                    </button>
                  ) : null}
                  {result.expanded_offset + result.evidence.length < result.extended_total ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        runResultPage({
                          expanded: true,
                          offset: result.expanded
                            ? result.expanded_offset + result.expanded_page_size
                            : 0,
                        })
                      }
                      className="inline-flex min-h-12 items-center rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
                    >
                      {result.expanded
                        ? `다음 ${result.expanded_page_size}건`
                        : result.applied_axes.length
                          ? `조건에 맞는 확장 근거 ${result.extended_match_total.toLocaleString("ko-KR")}건 보기`
                          : `이 상황의 확장 근거 ${result.extended_total.toLocaleString("ko-KR")}건 보기`}
                    </button>
                  ) : null}
                  {result.expanded ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => runResultPage({})}
                      className="inline-flex min-h-12 items-center rounded-xl border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-700 transition-colors hover:border-blue-400 disabled:opacity-50"
                    >
                      핵심 근거로 돌아가기
                    </button>
                  ) : null}
                </div>
                <p className="max-w-[66ch] text-xs leading-5 text-stone-500">
                  {result.extended_note}
                </p>
              </div>
            ) : null}

            <footer className="rounded-b-2xl border-t border-stone-200 bg-blue-50/60 px-4 py-4 text-xs leading-5 text-stone-700 sm:px-6">
              {result.disclaimer || evidenceOnlyDisclaimer}
            </footer>
          </article>
        ) : null}
      </div>
    </div>
  );
}
