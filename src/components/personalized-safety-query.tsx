"use client";
import { FormEvent, useRef, useState } from "react";

type Result = {
  question_id: string;
  ingredient: string;
  title: string;
  summary: string;
  ai_summary: string;
  assessment: {
    context: string;
    verdict: string;
    dose: string;
    interaction: string;
    watch: string;
    references: Array<{ label: string; title: string; url: string }>;
  };
  profile: string[];
  checks: string[];
  why: string;
  next_steps: string[];
  evidence_selection: {
    selected: number;
    total_candidates: number;
    direct_medication_matches: number;
    method: string;
  };
  evidence: Array<{
    title: string;
    url: string;
    doi: string;
    dose: string;
    outcome: string;
    selection_reason: string;
  }>;
  all_evidence: Array<{
    title: string;
    url: string;
    year?: number;
    selection_reason: string;
  }>;
  interpretation: string;
};
type QueryInput = {
  ingredient: string;
  dose: string;
  medication: string;
  condition: string;
  labs: string;
};
function Chevron() {
  return (
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
  );
}
function EvidenceSentence({
  children,
  references,
}: {
  children: string;
  references: Result["assessment"]["references"];
}) {
  return (
    <span className="group relative inline rounded-md px-0.5 transition-colors hover:bg-blue-100">
      {children}
      <a
        href={references[0]?.url}
        target="_blank"
        rel="noreferrer"
        className="ml-1 align-super text-[10px] font-bold text-blue-600 hover:underline"
      >
        근거
      </a>
      <span className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-72 rounded-xl bg-stone-950 p-3 text-left text-xs font-medium leading-5 text-white shadow-xl group-hover:block">
        <span className="mb-2 block text-[11px] font-bold text-blue-200">
          이 문장의 근거
        </span>
        {references.map((reference) => (
          <span
            key={`${reference.label}-${reference.url}`}
            className="mt-1 block rounded-lg px-2 py-1.5"
          >
            <b>{reference.label}</b> · {reference.title}
          </span>
        ))}
      </span>
    </span>
  );
}
export function PersonalizedSafetyQuery() {
  const formRef = useRef<HTMLFormElement>(null);
  const examplesRef = useRef<HTMLDetailsElement>(null);
  const resultRegionRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const examples = [
    {
      title: "와파린 + 비타민 K",
      description: "INR 변동과 섭취량 변화 확인",
      ingredient: "비타민 K",
      dose: "100 mcg/day",
      medication: "와파린",
      condition: "항응고 치료 중",
      labs: "INR 3.1",
    },
    {
      title: "항응고제 + 오메가-3",
      description: "고용량·출혈 병력 확인",
      ingredient: "오메가-3",
      dose: "EPA+DHA 2000 mg/day",
      medication: "아픽사반",
      condition: "코피가 자주 남",
      labs: "",
    },
    {
      title: "결석 병력 + 칼슘",
      description: "식이량과 보충제 용량 구분",
      ingredient: "칼슘",
      dose: "600 mg/day",
      medication: "",
      condition: "칼슘옥살산 신장결석 병력",
      labs: "24시간 요중 칼슘 280 mg/day",
    },
    {
      title: "결석 병력 + 비타민 D",
      description: "혈청·요중 칼슘 확인",
      ingredient: "비타민 D",
      dose: "4000 IU/day",
      medication: "",
      condition: "신장결석 및 고칼슘뇨",
      labs: "25(OH)D 48 ng/mL",
    },
    {
      title: "고옥살산뇨 + 비타민 C",
      description: "고용량 노출과 옥살산 확인",
      ingredient: "비타민 C",
      dose: "1000 mg/day",
      medication: "",
      condition: "고옥살산뇨 및 결석 병력",
      labs: "요중 옥살산 상승",
    },
  ];
  function scrollToResultRegion() {
    requestAnimationFrame(() => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      resultRegionRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "start",
      });
    });
  }
  async function runQuery(data: QueryInput) {
    setLoading(true);
    setError("");
    setResult(null);
    scrollToResultRegion();
    try {
      const res = await fetch("/api/personalized-safety", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(
          body.error ??
            "결과를 불러오지 못했습니다. 적어주신 내용을 확인하고 다시 시도해 주세요.",
        );
        return;
      }
      setResult(body);
      scrollToResultRegion();
    } catch {
      setError("연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }
  function fillExample(x: (typeof examples)[number]) {
    const f = formRef.current;
    if (!f) return;
    for (const [k, v] of Object.entries(x)) {
      const el = f.elements.namedItem(k);
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement)
        el.value = v;
    }
    examplesRef.current?.removeAttribute("open");
    void runQuery({
      ingredient: x.ingredient,
      dose: x.dose,
      medication: x.medication,
      condition: x.condition,
      labs: x.labs,
    });
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(
      [...new FormData(e.currentTarget)].map(([key, value]) => [
        key,
        String(value),
      ]),
    ) as QueryInput;
    await runQuery(values);
  }
  return (
    <section className="mx-auto px-4 py-5 sm:px-5 sm:py-6" id="query">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold text-muted">
          개인 특성 기반 안전성 조회
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
          복용 조건을 입력하세요
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          성분, 용량, 약물, 질환과 검사값을 함께 조회합니다.
        </p>
        <p className="mt-2 text-xs leading-5 text-stone-500">
          적어주신 내용은 결과를 정리하는 데만 사용됩니다.
          이름·연락처·주민등록번호 등 개인을 식별할 수 있는 정보는 입력하지
          마세요.
        </p>
      </div>
      <details
        ref={examplesRef}
        className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50/70"
      >
        <summary className="flex min-h-12 list-none items-center justify-between gap-4 px-4 py-3 text-left hover:bg-white/60">
          <div>
            <span className="text-sm font-bold text-stone-900">
              예시로 빠르게 확인하기
            </span>
            <span className="ml-2 text-xs text-stone-500">
              예시를 고르면 결과가 바로 나옵니다
            </span>
          </div>
          <span className="collapsible-chevron flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600">
            <Chevron />
          </span>
        </summary>
        <div className="collapsible-panel">
          <div className="collapsible-panel-inner">
            <div className="collapsible-panel-body border-t border-stone-200 p-3">
              <p className="mb-3 text-xs text-stone-500">
                비슷한 예시를 선택하면 내용이 자동으로 채워지고 결과가 바로
                표시됩니다.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {examples.map((x) => (
                  <button
                    type="button"
                    key={x.title}
                    onClick={() => fillExample(x)}
                    disabled={loading}
                    className="rounded-xl border border-stone-200 bg-white p-3 text-left transition hover:border-blue-300 hover:shadow-sm disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="block text-sm font-bold text-stone-950">
                      {x.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-stone-600">
                      {x.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </details>
      <form
        ref={formRef}
        onSubmit={submit}
        className="mt-6 grid gap-5 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:grid-cols-2 sm:p-8"
      >
        <label className="grid gap-2 text-sm font-semibold">
          보충제
          <select
            required
            name="ingredient"
            autoComplete="off"
            className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-950"
          >
            <option value="">선택</option>
            <option>비타민 K</option>
            <option>오메가-3</option>
            <option>칼슘</option>
            <option>비타민 D</option>
            <option>비타민 C</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          일일 복용량
          <input
            name="dose"
            maxLength={80}
            autoComplete="off"
            placeholder="예: 1000 mg/day…"
            className="rounded-xl border border-stone-300 px-4 py-3"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          병용 약물
          <input
            name="medication"
            maxLength={120}
            autoComplete="off"
            placeholder="예: 와파린…"
            className="rounded-xl border border-stone-300 px-4 py-3"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          질환·병력·증상
          <input
            name="condition"
            maxLength={200}
            autoComplete="off"
            placeholder="예: 신장결석, 고칼슘뇨, 배가 아파요…"
            className="rounded-xl border border-stone-300 px-4 py-3"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
          관련 검사값
          <input
            name="labs"
            maxLength={200}
            autoComplete="off"
            placeholder="예: INR 3.1, 혈청 칼슘 10.4 mg/dL…"
            className="rounded-xl border border-stone-300 px-4 py-3"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="min-h-12 rounded-xl bg-stone-950 px-5 font-semibold text-white sm:col-span-2 disabled:cursor-wait disabled:bg-stone-700"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              결과를 정리하고 있어요
            </span>
          ) : (
            "내 조건으로 확인하기"
          )}
        </button>
      </form>
      <aside className="mt-6 grid gap-4 rounded-2xl bg-blue-50 p-5 text-sm text-blue-950 sm:grid-cols-3">
        <div>
          <strong className="block">1. 예시 고르기</strong>
          <span className="mt-1 block leading-6">
            비슷한 예시를 고르면 결과가 바로 나옵니다.
          </span>
        </div>
        <div>
          <strong className="block">2. 내 정보 반영하기</strong>
          <span className="mt-1 block leading-6">
            필요하면 용량·약물·검사값을 바꿔 다시 확인하세요.
          </span>
        </div>
        <div>
          <strong className="block">3. 근거 확인하기</strong>
          <span className="mt-1 block leading-6">
            확인사항과 관련 논문을 함께 볼 수 있습니다.
          </span>
        </div>
      </aside>
      <div
        ref={resultRegionRef}
        className="scroll-mt-6"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading && (
          <section
            role="status"
            className="mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm"
          >
            <div className="flex items-center gap-4 px-5 py-5">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
                <span className="absolute h-5 w-5 animate-ping rounded-full bg-blue-200/70" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-blue-600" />
              </span>
              <div>
                <p className="font-bold text-stone-950">
                  입력한 내용에 맞는 근거를 정리하고 있습니다
                </p>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  잠시만 기다리면 핵심 의견과 확인할 내용을 바로 보여드립니다.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 border-t border-stone-100 bg-stone-50/80 px-5 py-4">
              {["입력 내용 확인", "근거 문헌 연결", "결과 정리"].map(
                (label, index) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 text-xs font-semibold text-stone-600"
                  >
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500"
                      style={{ animationDelay: `${index * 180}ms` }}
                    />
                    <span>{label}</span>
                  </div>
                ),
              )}
            </div>
          </section>
        )}
        {error && (
          <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {result && (
          <article className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <header className="px-5 pb-2 pt-6">
              <p className="text-xs font-bold text-blue-600">
                한눈에 보는 결과
              </p>
              <h3 className="mt-2 break-keep text-xl font-bold leading-7 text-stone-950">
                {result.title}
              </h3>
            </header>
            <div className="p-5 pt-3">
              <section className="break-keep rounded-2xl bg-[#f2f6ff] px-5 py-5 text-[15px] font-medium leading-7 text-[#333d4b]">
                <p>{result.assessment.context}</p>
                <p className="mt-5 font-semibold text-stone-950">
                  <EvidenceSentence references={result.assessment.references}>
                    {result.assessment.verdict}
                  </EvidenceSentence>
                </p>
                <p className="mt-5">
                  <EvidenceSentence
                    references={result.assessment.references.slice(0, 1)}
                  >
                    {result.assessment.dose}
                  </EvidenceSentence>{" "}
                  <EvidenceSentence
                    references={result.assessment.references.slice(0, 2)}
                  >
                    {result.assessment.interaction}
                  </EvidenceSentence>
                </p>
                <p className="mt-5">
                  <EvidenceSentence
                    references={result.assessment.references.slice(1)}
                  >
                    {result.assessment.watch}
                  </EvidenceSentence>
                </p>
              </section>
              <div className="mt-4 flex flex-wrap gap-2">
                {result.profile.map((x) => (
                  <span
                    key={x}
                    className="rounded-full bg-[#f5f6f8] px-3 py-1.5 text-xs font-semibold text-[#4e5968]"
                  >
                    {x}
                  </span>
                ))}
              </div>
              <details className="mt-5 rounded-xl border border-stone-200">
                <summary className="flex min-h-12 list-none items-center justify-between px-4 py-3 font-semibold">
                  <span>확인할 내용과 다음 단계</span>
                  <span className="collapsible-chevron text-stone-500">
                    <Chevron />
                  </span>
                </summary>
                <div className="grid gap-5 border-t border-stone-200 p-4 md:grid-cols-2">
                  <ol className="grid gap-2">
                    {result.checks.map((x, i) => (
                      <li key={x} className="flex gap-3 text-sm leading-6">
                        <b className="text-blue-700">{i + 1}</b>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ol>
                  <ul className="grid gap-2 text-sm leading-6">
                    {result.next_steps.map((x) => (
                      <li key={x} className="flex gap-2">
                        <span className="text-emerald-600">✓</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
              <details className="mt-3 rounded-xl border border-stone-200">
                <summary className="flex min-h-12 list-none items-center justify-between px-4 py-3 font-semibold">
                  <span>핵심 근거와 전체 후보 보기</span>
                  <span className="flex items-center gap-2 text-sm text-stone-500">
                    핵심 {result.evidence_selection.selected}건 · 전체{" "}
                    {result.evidence_selection.total_candidates}건{" "}
                    <span className="collapsible-chevron">
                      <Chevron />
                    </span>
                  </span>
                </summary>
                <div className="border-t border-stone-200 bg-blue-50/50 px-4 py-3 text-xs leading-5 text-stone-600">
                  선정 방식: {result.evidence_selection.method} · 입력 약물 직접 일치 {result.evidence_selection.direct_medication_matches}건
                </div>
                <div className="divide-y divide-stone-200 border-t border-stone-200 px-4">
                  {result.evidence.map((x, i) => (
                    <div key={i} className="py-4">
                      <a
                        href={x.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-blue-700 underline underline-offset-4"
                      >
                        {x.title}
                      </a>
                      {x.dose && (
                        <p className="mt-2 text-xs text-stone-600">
                          문헌 보고 용량: {x.dose}
                        </p>
                      )}
                      <p className="mt-2 text-xs font-medium text-blue-700">
                        선정 이유: {x.selection_reason}
                      </p>
                    </div>
                  ))}
                </div>
                <details className="border-t border-stone-200 bg-stone-50/70">
                  <summary className="flex min-h-12 list-none items-center justify-between px-4 py-3 text-sm font-semibold text-stone-700">
                    <span>
                      전체 관련 후보{" "}
                      {result.evidence_selection.total_candidates}건
                    </span>
                    <span className="collapsible-chevron text-stone-500">
                      <Chevron />
                    </span>
                  </summary>
                  <div className="max-h-96 overflow-y-auto border-t border-stone-200 px-4">
                    {result.all_evidence.map((item, index) => (
                      <div
                        key={`${item.url}-${index}`}
                        className="border-b border-stone-200 py-3 last:border-0"
                      >
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold leading-6 text-blue-700 hover:underline"
                        >
                          {item.title}
                        </a>
                        <p className="mt-1 text-xs text-stone-500">
                          {item.year ? `${item.year} · ` : ""}
                          {item.selection_reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </details>
              <p className="mt-4 text-xs leading-5 text-stone-500">
                {result.interpretation}
              </p>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
