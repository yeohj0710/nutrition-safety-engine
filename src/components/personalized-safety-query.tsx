"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import {
  axes,
  evidenceOnlyDisclaimer,
  situations,
  type SituationId,
} from "@/src/lib/clinical-situations";
import { publicInputExamples } from "@/src/lib/personalized-safety-examples";

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
                {filledAxisCount}개 입력됨
              </span>
            ) : null}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {axes.map((axis) => {
              const filled = Boolean(form[axis.field].trim());
              return (
                <label key={axis.id} className="flex flex-col gap-1">
                  <span className="block text-[11px] font-bold text-blue-700">
                    {axis.label}
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
          <p className="text-[11px] leading-5 text-stone-500">
            조건을 넣을수록 그 조건을 모두 보고한 문헌만 남아 결과가 줄어듭니다.
            줄어드는 모습 자체가 이 도구가 보여주려는 것입니다.
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
              {(result.narrative?.length
                ? result.narrative
                : [result.summary]
              ).map((paragraph, index, all) => {
                // 첫 문단은 사용자가 말한 내용을 되짚는 자리라 크게, 나머지는 본문 크기로.
                // 인용 번호는 문헌을 실제로 가리키는 문단 끝에만 붙인다.
                const lead = index === 0;
                const citesHere = all.length > 1 ? index === 1 : index === 0;
                return (
                  <p
                    key={paragraph.slice(0, 24) + index}
                    className={
                      lead
                        ? "break-keep text-base font-semibold leading-7 text-stone-950 md:text-lg md:leading-8"
                        : "break-keep text-sm leading-7 text-stone-700 md:text-[0.95rem] md:leading-8"
                    }
                  >
                    {paragraph}
                    {citesHere ? <CitationMarks items={result.evidence} /> : null}
                  </p>
                );
              })}
              {result.applied_axes.length ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-stone-500">
                    반영한 조건
                  </span>
                  {result.applied_axes.map((axis) => (
                    <span
                      key={axis.field}
                      className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800"
                    >
                      {axis.value}
                      <span className="ml-1 font-normal text-blue-600">
                        {axis.reported.toLocaleString("ko-KR")}건
                      </span>
                    </span>
                  ))}
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
              <ol className="divide-y divide-stone-200 border-t border-stone-200 px-5">
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
