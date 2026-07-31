"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AnimatedDetails } from "@/src/components/animated-details";
import {
  axes,
  evidenceOnlyDisclaimer,
  situations,
  type SituationId,
} from "@/src/lib/clinical-situations";
import { publicInputExamples } from "@/src/lib/personalized-safety-examples";
import { axisCoverage, coreCoverage } from "@/src/lib/axis-coverage";

type EvidenceItem = {
  record_id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  url: string;
  locator: string;
  key_finding_ko: string;
  publication_types: string;
  dose: string;
};

type AppliedAxis = {
  axis: string;
  field: string;
  value: string;
  reported: number;
};

type ApiResult = {
  situation: SituationId;
  situation_label: string;
  research_question: string;
  applied_axes: AppliedAxis[];
  unavailable_axes: { axis: string; field: string; value: string }[];
  core_evidence_count: number;
  evidence: EvidenceItem[];
  evidence_total_after_filter: number;
  checks: string[];
  summary: string;
  /** 상담하듯 읽히는 문단들. 두 번째 문단이 실제로 문헌을 가리킨다. */
  narrative?: string[];
  disclaimer: string;
  expanded: boolean;
  expanded_offset: number;
  expanded_page_size: number;
  extended_total: number;
  extended_note: string;
  error?: string;
};

type FormState = {
  situation: SituationId | "";
  age: string;
  medication: string;
  dose: string;
  sex: string;
  condition: string;
};

const emptyForm: FormState = {
  situation: "",
  age: "",
  medication: "",
  dose: "",
  sex: "",
  condition: "",
};

/** 근거 문장 위치는 "ABSTRACT_SENTENCE_8: 본문" 형태로 저장돼 있다. */
function splitLocator(locator: string) {
  const match = /^([A-Z_]+_(\d+)):\s*([\s\S]*)$/.exec(locator ?? "");
  if (!match) return { label: "", sentence: locator ?? "" };
  return { label: `초록 ${match[2]}번째 문장`, sentence: match[3] };
}

/**
 * 요약 문장 뒤에 붙는 번호 인용 표시. 누르면 아래 출처 항목으로 이동한다.
 * 번호는 화면에 보여주는 근거의 순서(priority_score 내림차순)를 그대로 쓴다.
 * 어떤 문장이 어떤 논문에서 나왔다고 주장하지 않는다 — 이 요약은 데이터에서
 * 결정론적으로 만든 문장이고, 번호는 "아래 목록의 이 항목들"을 가리키는 표시다.
 */
function CitationMarks({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-super">
      {items.map((item, index) => {
        const n = index + 1;
        return (
          // 툴팁을 이 group 안에 두어야 커서를 번호에서 툴팁으로 옮기는 동안
          // hover 가 끊기지 않는다.
          <span key={item.record_id} className="group/cite relative inline-block">
            <a
              href={`#result-ref-${n}`}
              aria-label={`${n}번 출처: ${item.title}`}
              className="rounded bg-blue-100 px-1 text-[0.62em] font-bold leading-4 text-blue-800 no-underline transition hover:bg-blue-200"
            >
              {n}
            </a>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-20 hidden w-64 -translate-x-1/2 pt-1.5 group-hover/cite:block group-focus-within/cite:block"
            >
              <span className="block rounded-lg border border-stone-200 bg-white p-3 text-left shadow-lg">
                <span className="block text-xs font-bold leading-5 text-stone-950">
                  {item.title}
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-stone-500">
                  {item.venue} · {item.year}
                </span>
              </span>
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * 문장 하나에 마우스를 올리면 그 문장을 뒷받침하는 문헌을 툴팁으로 보여준다.
 *
 * CSS group-hover 만으로는 문장에서 툴팁까지 커서를 옮기는 사이(특히 문장이 여러 줄로
 * 감길 때 툴팁과 커서 사이 빈 구간) hover 가 끊겨 툴팁이 닫힌다. 상태와 닫힘 유예시간으로
 * 이동 중에도 열림을 유지한다.
 */
function EvidenceSentence({
  children,
  items,
  onShowAll,
}: {
  children: string;
  items: EvidenceItem[];
  onShowAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  if (!items.length) return <>{children}</>;
  const shown = items.slice(0, 4);

  return (
    <span
      className="group relative inline rounded-md px-0.5 transition-colors hover:bg-blue-100"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <a
        href="#result-ref-1"
        className="ml-1 align-super text-[10px] font-bold text-blue-600 hover:underline"
      >
        근거
      </a>
      <span
        role="tooltip"
        className={`absolute -left-12 bottom-[calc(100%+0.75rem)] z-50 block max-h-[70vh] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-xl border border-blue-100 bg-white p-3 text-left shadow-[0_12px_36px_rgba(15,23,42,0.16)] transition-opacity duration-150 after:absolute after:left-0 after:top-full after:h-3 after:w-full after:content-[''] sm:left-0 ${
          open
            ? "pointer-events-auto visible opacity-100"
            : "pointer-events-none invisible opacity-0"
        }`}
      >
        <span className="block text-[11px] font-bold text-blue-600">
          이 문장의 근거 {items.length}건
        </span>
        <span className="mb-2 mt-0.5 block text-[10px] leading-4 text-stone-500">
          이번 결과에 연결된 문헌만 보여요.
        </span>
        {shown.map((item, index) => {
          const locator = splitLocator(item.locator);
          return (
            <a
              key={item.record_id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block rounded-lg bg-blue-50/60 px-2.5 py-2 transition hover:bg-blue-100"
            >
              <span className="block text-[11px] font-bold leading-4 text-blue-700">
                {index + 1}. {item.venue || "출처"} · {item.year}
              </span>
              {item.key_finding_ko ? (
                <span className="mt-0.5 block text-[11px] font-medium leading-[1.55] text-stone-700">
                  {item.key_finding_ko}
                </span>
              ) : null}
              {locator.sentence ? (
                <span className="mt-2 block border-l-2 border-blue-200 pl-2">
                  <span className="block text-[10px] font-semibold leading-4 text-stone-500">
                    원문 · {locator.label || "근거 문장"}
                  </span>
                  <span
                    lang="en"
                    className="mt-0.5 block text-[10px] leading-4 text-stone-600"
                  >
                    &ldquo;{locator.sentence}&rdquo;
                  </span>
                </span>
              ) : null}
              <span
                lang="en"
                title={item.title}
                className="mt-1 block break-words text-[10px] leading-4 text-stone-500"
              >
                {item.title}
              </span>
            </a>
          );
        })}
        <button
          type="button"
          onClick={onShowAll}
          className="mt-2 flex w-full items-center justify-between rounded-lg border border-blue-100 bg-white px-2.5 py-2 text-[11px] font-bold text-blue-700 transition hover:bg-blue-50"
        >
          <span>이 결과에 쓰인 문헌 {items.length}건 모두 보기</span>
          <span aria-hidden="true">↓</span>
        </button>
      </span>
    </span>
  );
}

const loadingStages = ["입력 조건 확인", "근거 문헌 연결", "결과 정리"];

/** 결과를 기다리는 동안 자리를 잡아 두는 뼈대. 화면이 튀지 않게 한다. */
function ResultSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="surface-card motion-enter flex flex-col gap-4 rounded-xl p-5"
    >
      <span className="sr-only">근거를 정리하고 있습니다</span>
      <div className="flex items-center gap-3">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
          <span className="absolute h-5 w-5 animate-ping rounded-full bg-blue-200/70" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-blue-600" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-stone-950">
            입력한 조건에 맞는 근거를 정리하고 있습니다
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {loadingStages.map((label, index) => (
              <span
                key={label}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500"
              >
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500"
                  style={{ animationDelay: `${index * 180}ms` }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-stone-200 pt-4">
        <span className="loading-skeleton block h-4 w-4/5 rounded" />
        <span className="loading-skeleton block h-4 w-3/5 rounded" />
        <span className="loading-skeleton mt-2 block h-3 w-2/5 rounded" />
        <span className="loading-skeleton block h-3 w-3/4 rounded" />
      </div>
    </div>
  );
}

export function PersonalizedSafetyQuery() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [activeExample, setActiveExample] = useState("");
  const resultRef = useRef<HTMLDivElement | null>(null);
  const evidenceListRef = useRef<HTMLOListElement | null>(null);

  /** 툴팁의 "모두 보기"에서 근거 목록으로 데려간다. */
  const showAllEvidence = useCallback(() => {
    evidenceListRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setActiveExample("");
  };

  /**
   * 예시를 눌렀을 때 setForm 직후 submit 을 부르면 React 상태가 아직 안 바뀌어
   * 이전 값으로 조회된다. 그래서 조회에 쓸 값을 인자로 직접 받는다.
   */
  const run = useCallback(
    async (
      values: FormState,
      extra: { expanded?: boolean; offset?: number } = {},
      options: { scroll?: boolean } = {},
    ) => {
      if (!values.situation) {
        setError("먼저 지금 상황을 하나 고르세요.");
        setResult(null);
        return;
      }
      setPending(true);
      setError("");
      try {
        const response = await fetch("/api/personalized-safety", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...values, ...extra }),
        });
        const body: ApiResult = await response.json();
        if (!response.ok) {
          setError(body.error ?? "결과를 불러오지 못했습니다.");
          setResult(null);
          return;
        }
        setResult(body);
        if (options.scroll !== false) {
          // 예시를 누르면 결과가 화면 밖에 그려지는 일이 없도록 결과로 데려간다.
          requestAnimationFrame(() => {
            resultRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          });
        }
      } catch {
        setError("네트워크 문제로 결과를 불러오지 못했습니다.");
        setResult(null);
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const submit = (
    event: FormEvent | null,
    extra: { expanded?: boolean; offset?: number } = {},
  ) => {
    event?.preventDefault();
    void run(form, extra, { scroll: extra.expanded === undefined });
  };

  /** 한 번 누르면 채우고 바로 조회까지 간다. */
  const runExample = (example: (typeof publicInputExamples)[number]) => {
    setForm(example.input);
    setActiveExample(example.id);
    void run(example.input);
  };

  const filledAxisCount = axes.filter((axis) => form[axis.field].trim()).length;
  const situationLabel =
    situations.find((item) => item.id === form.situation)?.label ?? "";

  return (
    <section className="flex flex-col gap-6">
      {/* ── 한 번에 해볼 수 있는 예시. 폼보다 위에 둔다 ── */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-bold text-stone-950">
            예시로 바로 확인하기
          </p>
          <p className="text-xs text-stone-600">
            누르면 입력이 채워지고 결과까지 바로 나옵니다
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {publicInputExamples.map((example) => {
            const active = activeExample === example.id;
            return (
              <button
                key={example.id}
                type="button"
                disabled={pending}
                aria-pressed={active}
                onClick={() => runExample(example)}
                className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                  active
                    ? "border-blue-600 bg-white ring-1 ring-blue-600"
                    : "border-blue-200/80 bg-white/85 hover:border-blue-400 hover:bg-white"
                }`}
              >
                <span className="text-[13px] font-bold leading-5 text-stone-950">
                  {example.title}
                </span>
                <span className="text-[11px] leading-4 text-stone-600">
                  {example.summary}
                </span>
              </button>
            );
          })}
        </div>
        <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-blue-200/70 pt-3 text-[11px] leading-5 text-stone-600">
          <li>
            <b className="text-stone-900">1</b> 예시 고르기
          </li>
          <li>
            <b className="text-stone-900">2</b> 내 조건으로 바꾸기
          </li>
          <li>
            <b className="text-stone-900">3</b> 근거 문장·원문 확인하기
          </li>
        </ol>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-3">
          <legend className="flex flex-wrap items-baseline gap-2 text-sm font-bold text-stone-950">
            지금 상황이 어디에 해당하나요?
            <span className="text-xs font-normal text-red-600">필수</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {situations.map((situation) => {
              const active = form.situation === situation.id;
              return (
                <button
                  key={situation.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update("situation", situation.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-stone-300 bg-white text-stone-700 hover:border-blue-400"
                  }`}
                >
                  {situation.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="flex flex-wrap items-baseline gap-2 text-sm font-bold text-stone-950">
            해당하는 것만 적어주세요
            <span className="text-xs font-normal text-stone-500">
              비워도 됩니다
            </span>
            {filledAxisCount ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                {filledAxisCount}개 켬
              </span>
            ) : null}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {axes.map((axis) => {
              const filled = Boolean(form[axis.field].trim());
              const coverage = form.situation
                ? axisCoverage[form.situation][axis.id]
                : undefined;
              const missing = form.situation ? coverage === null : false;
              return (
                <label
                  key={axis.id}
                  className={`flex flex-col gap-1 ${missing ? "opacity-60" : ""}`}
                >
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-[11px] font-bold text-blue-700">
                      {axis.label}
                    </span>
                    {form.situation ? (
                      <span className="text-[10px] font-medium text-stone-500">
                        {missing
                          ? "이 상황에는 이 축의 근거가 없어요"
                          : `이 항목을 보고한 문헌 ${coverage}건`}
                      </span>
                    ) : null}
                  </span>
                  <input
                    value={form[axis.field]}
                    onChange={(event) => update(axis.field, event.target.value)}
                    placeholder={axis.placeholder}
                    maxLength={120}
                    className={`rounded-lg border px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-blue-500 ${
                      filled
                        ? "border-blue-300 bg-blue-50/40"
                        : "border-stone-300 bg-white"
                    }`}
                  />
                </label>
              );
            })}
          </div>
          {/*
            여기를 정확히 적어야 한다. 칸을 채우면 "그 항목을 보고한 문헌"만 남을 뿐,
            적으신 값과 문헌을 대조하지는 않는다. 값까지 걸러낸다고 읽히면 결과를
            실제보다 개인화된 것으로 오해하게 된다.
          */}
          <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] leading-5 text-stone-600">
            칸을 채우면 <b className="text-stone-800">그 항목을 보고한 문헌</b>만
            남습니다. 적으신 값 자체로 문헌을 고르지는 않아요 — 예를 들어 함께 먹는
            약에 무엇을 적든, 병용약을 보고한 문헌이 남습니다. 적어두신 값은 결과
            설명에 그대로 옮겨 보여드립니다.
            {form.situation ? (
              <>
                {" "}
                조건을 켜지 않으면 이 상황의 핵심 근거{" "}
                {coreCoverage[form.situation]}건을 그대로 보여드려요.
              </>
            ) : null}
          </p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "찾는 중" : "관련 문헌 찾기"}
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm);
              setResult(null);
              setError("");
              setActiveExample("");
            }}
            className="rounded-full border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:border-stone-400"
          >
            비우기
          </button>
          {situationLabel ? (
            <span className="text-xs text-stone-500">
              선택: {situationLabel}
              {filledAxisCount ? ` · 조건 ${filledAxisCount}개` : ""}
            </span>
          ) : null}
        </div>
      </form>

      <div ref={resultRef} className="scroll-mt-20">
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        ) : null}

        {pending && !result ? <ResultSkeleton /> : null}

        {!pending && !result && !error ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-stone-700">
              아직 찾은 근거가 없습니다
            </p>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              위의 예시를 누르면 결과가 바로 나옵니다. 상황을 직접 고르고
              조건을 적어도 됩니다.
            </p>
          </div>
        ) : null}

        {result ? (
          <article
            aria-live="polite"
            className={`flex flex-col gap-4 rounded-xl border border-stone-200 bg-white ${
              pending ? "opacity-60" : "motion-enter"
            }`}
          >
            <header className="flex flex-col gap-2 px-5 pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white">
                  {result.situation_label}
                </span>
                <span className="text-[11px] font-semibold text-stone-500">
                  근거 {result.evidence.length.toLocaleString("ko-KR")}건 표시
                  {result.expanded
                    ? ` · 이 상황 전체 ${result.extended_total.toLocaleString("ko-KR")}건 중`
                    : ` · 이 상황 핵심 근거 ${result.core_evidence_count.toLocaleString("ko-KR")}건 중`}
                </span>
              </div>
              <div className="break-keep rounded-2xl bg-[#f2f6ff] px-5 py-5 text-[15px] font-medium leading-7 text-[#333d4b]">
                {(result.narrative?.length
                  ? result.narrative
                  : [result.summary]
                ).map((paragraph, index, all) => {
                  // 첫 문단은 사용자가 말한 것을 되짚는 자리라 문헌을 붙이지 않는다.
                  // 마지막 문단은 화면 안내라 역시 붙이지 않는다.
                  const lead = index === 0;
                  const last = index === all.length - 1;
                  const backed = all.length > 1 ? !lead && !last : true;
                  const body = (
                    <>
                      {backed ? (
                        <EvidenceSentence
                          items={result.evidence}
                          onShowAll={showAllEvidence}
                        >
                          {paragraph}
                        </EvidenceSentence>
                      ) : (
                        paragraph
                      )}
                      {index === Math.min(1, all.length - 1) ? (
                        <CitationMarks items={result.evidence} />
                      ) : null}
                    </>
                  );
                  return (
                    <p
                      key={paragraph.slice(0, 24) + index}
                      className={
                        lead
                          ? "font-semibold text-stone-950"
                          : "mt-5 text-[#333d4b]"
                      }
                    >
                      {body}
                    </p>
                  );
                })}
              </div>
              <AnimatedDetails
                className="rounded-xl border border-stone-200"
                summaryClassName="flex min-h-11 list-none items-center justify-between px-4 py-2.5 text-[13px] font-semibold text-stone-800"
                bodyClassName="border-t border-stone-200 p-4"
                summary={
                  <>
                    <span>이 결과를 무엇으로 판단했나</span>
                    <span className="collapsible-chevron text-stone-500">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="m5 7.5 5 5 5-5" />
                      </svg>
                    </span>
                  </>
                }
              >
                <p className="text-xs leading-6 text-stone-600">
                  <span className="font-semibold text-stone-800">연구 질문</span>
                  <br />
                  {result.research_question}
                </p>
                {result.checks?.length ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-stone-800">
                      문헌마다 확인한 것
                    </p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {result.checks.map((check) => (
                        <li
                          key={check}
                          className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600"
                        >
                          {check}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className="mt-3 text-[11px] leading-5 text-stone-500">
                  이 상황의 핵심 근거는 {result.core_evidence_count}건이고, 확장
                  보기까지 포함하면 {result.extended_total.toLocaleString("ko-KR")}건입니다.
                  조건을 넣으면 그 조건을 실제로 보고한 문헌만 남습니다.
                </p>
              </AnimatedDetails>
              {result.applied_axes.length ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-stone-500">
                    켜진 조건
                  </span>
                  {result.applied_axes.map((axis) => {
                    const meta = axes.find((item) => item.field === axis.field);
                    return (
                      <span
                        key={axis.field}
                        title={`적어주신 값: ${axis.value}`}
                        className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800"
                      >
                        {meta?.noun ?? axis.field} 보고
                        <span className="ml-1 font-normal text-blue-600">
                          {axis.reported.toLocaleString("ko-KR")}건
                        </span>
                        <span className="ml-1 font-normal text-stone-500">
                          · {axis.value}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : null}
              {result.unavailable_axes.length ? (
                <p className="text-xs leading-5 text-stone-500">
                  이 상황의 문헌에는{" "}
                  {result.unavailable_axes.map((item) => item.value).join(", ")}{" "}
                  조건을 나눈 근거가 없어 반영하지 않았습니다.
                </p>
              ) : null}
            </header>

            {result.evidence.length ? (
              <ol
                ref={evidenceListRef}
                className="scroll-mt-20 divide-y divide-stone-200 border-t border-stone-200 px-5"
              >
                {result.evidence.map((item, index) => {
                  const locator = splitLocator(item.locator);
                  const n = index + 1;
                  return (
                    <li
                      key={item.record_id}
                      id={`result-ref-${n}`}
                      className="flex scroll-mt-24 flex-col gap-2 py-4"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 shrink-0 rounded-md bg-stone-950 px-2 py-0.5 text-xs font-bold text-white">
                          {n}
                        </span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-bold leading-6 text-stone-950 underline decoration-stone-300 underline-offset-4 transition hover:decoration-blue-500"
                        >
                          {item.title}
                        </a>
                      </div>
                      <p className="text-xs leading-5 text-stone-500">
                        {item.authors} · {item.venue} · {item.year} ·{" "}
                        {item.publication_types.split("|")[0]}
                        {item.dose ? ` · ${item.dose}` : ""}
                      </p>
                      {item.key_finding_ko ? (
                        <p className="text-sm leading-6 text-stone-800">
                          {item.key_finding_ko}
                        </p>
                      ) : null}
                      {locator.sentence ? (
                        <p className="border-l-2 border-blue-200 pl-3 text-xs leading-5 text-stone-600">
                          <span className="font-semibold text-blue-700">
                            {locator.label || "근거 문장"}
                          </span>{" "}
                          {locator.sentence}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="border-t border-stone-200 px-5 py-6 text-sm leading-6 text-stone-600">
                입력한 조건을 모두 보고한 문헌이 이 상황에는 없습니다. 조건을
                하나씩 지우면 남는 근거를 볼 수 있습니다.
              </p>
            )}

            {result.extended_total > result.evidence.length || result.expanded ? (
              <div className="flex flex-col gap-2 border-t border-stone-200 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {result.expanded && result.expanded_offset > 0 ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        submit(null, {
                          expanded: true,
                          offset: Math.max(
                            0,
                            result.expanded_offset - result.expanded_page_size,
                          ),
                        })
                      }
                      className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-blue-400 disabled:opacity-50"
                    >
                      이전 {result.expanded_page_size}건
                    </button>
                  ) : null}
                  {result.expanded_offset + result.evidence.length <
                  result.extended_total ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        submit(null, {
                          expanded: true,
                          offset: result.expanded
                            ? result.expanded_offset + result.expanded_page_size
                            : 0,
                        })
                      }
                      className="rounded-full border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {result.expanded
                        ? `다음 ${result.expanded_page_size}건`
                        : `이 상황의 근거 ${result.extended_total.toLocaleString("ko-KR")}건 모두 보기`}
                    </button>
                  ) : null}
                  {result.expanded ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => submit(null)}
                      className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-blue-400 disabled:opacity-50"
                    >
                      핵심 근거로 돌아가기
                    </button>
                  ) : null}
                </div>
                <p className="text-xs leading-5 text-stone-500">
                  {result.extended_note}
                </p>
              </div>
            ) : null}

            <footer className="border-t border-stone-200 bg-blue-50/50 px-5 py-3 text-xs leading-5 text-stone-600">
              {result.disclaimer || evidenceOnlyDisclaimer}
            </footer>
          </article>
        ) : null}
      </div>
    </section>
  );
}
