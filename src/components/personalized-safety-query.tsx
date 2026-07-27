"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  AnimatedDetails,
  type AnimatedDetailsHandle,
} from "@/src/components/animated-details";
import {
  personalizedSafetyExamples,
  personalizedSafetyIngredientOrder,
  type PersonalizedSafetyExample,
} from "@/src/lib/personalized-safety-examples";
import { hasMultiValue, toggleMultiValue } from "@/src/lib/multi-value-input";
import { toHaeyoStyle, withObjectParticle } from "@/src/lib/korean-ui-copy";

type Result = {
  question_id: string;
  ingredient: string;
  title: string;
  summary: string;
  ai_summary: string;
  narrative_assessment: {
    ai_used: boolean;
    conclusion: string;
    context: string;
    explanation: string;
    next: string;
  };
  input_interpretation: {
    ai_used: boolean;
    changed: boolean;
  };
  assessment: {
    context: string;
    verdict: string;
    dose: string;
    interaction: string;
    watch: string;
    references: Array<{
      label: string;
      title: string;
      url: string;
      summary_ko?: string;
      source_excerpts?: Array<{
        locator: string;
        quote: string;
      }>;
    }>;
  };
  profile: string[];
  checks: string[];
  why: string;
  next_steps: string[];
  evidence_selection: {
    selected: number;
    total_candidates: number;
    ingredient_matches: number;
    direct_medication_matches: number;
    medication_name: string;
    method: string;
  };
  evidence: Array<{
    title: string;
    url: string;
    ingredient_match?: boolean;
    doi: string;
    dose: string;
    outcome: string;
    key_finding: string;
    key_finding_ko: string;
    selection_reason: string;
  }>;
  all_evidence: Array<{
    title: string;
    url: string;
    ingredient_match?: boolean;
    year?: number;
    key_finding: string;
    key_finding_ko: string;
    selection_reason: string;
  }>;
};
type QueryInput = {
  ingredient: string;
  dose: string;
  medication: string;
  condition: string;
  labs: string;
};
const exclusiveMedicationChoices = ["복용 약 없음", "잘 모르겠어요"];
const exclusiveConditionChoices = ["특별한 증상 없음"];
function medicationChoiceValue(label: string) {
  return label === "없어요" ? "복용 약 없음" : label;
}
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
  evidenceCount,
  onShowAllEvidence,
}: {
  children: string;
  references: Result["assessment"]["references"];
  evidenceCount: number;
  onShowAllEvidence: () => void;
}) {
  // CSS group-hover만으로는 문장에서 툴팁까지 마우스를 옮기는 사이(특히 문장이
  // 여러 줄로 감길 때 툴팁과 커서 사이 빈 구간) hover가 끊겨 툴팁이 닫힌다.
  // 상태 + 닫힘 유예시간으로 이동 중에도 열림을 유지한다.
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
        href={references[0]?.url}
        target="_blank"
        rel="noreferrer"
        className="ml-1 align-super text-[10px] font-bold text-blue-600 hover:underline"
      >
        근거
      </a>
      <span
        className={`absolute -left-12 bottom-[calc(100%+0.75rem)] z-50 block max-h-[70vh] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-xl border border-blue-100 bg-white p-3 text-left shadow-[0_12px_36px_rgba(15,23,42,0.16)] transition-opacity duration-150 after:absolute after:left-0 after:top-full after:h-3 after:w-full after:content-[''] sm:left-0 ${
          open
            ? "pointer-events-auto visible opacity-100"
            : "pointer-events-none invisible opacity-0"
        }`}
      >
        <span className="block text-[11px] font-bold text-blue-600">
          이 문장의 근거 {references.length}건
        </span>
        <span className="mb-2 mt-0.5 block text-[10px] leading-4 text-stone-500">
          현재 문장을 뒷받침하는 자료만 보여요.
        </span>
        {references.map((reference) => (
          <a
            key={`${reference.label}-${reference.url}`}
            href={reference.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block rounded-lg bg-blue-50/60 px-2.5 py-2 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <span className="block text-[11px] font-bold leading-4 text-blue-700">
              {reference.label}
            </span>
            {reference.summary_ko && (
              <span className="mt-0.5 block text-[11px] font-medium leading-[1.55] text-stone-700">
                {toHaeyoStyle(reference.summary_ko)}
              </span>
            )}
            {reference.source_excerpts?.map((excerpt) => (
              <span
                key={`${excerpt.locator}-${excerpt.quote}`}
                className="mt-2 block border-l-2 border-blue-200 pl-2"
              >
                <span className="block text-[10px] font-semibold leading-4 text-stone-500">
                  원문 · {excerpt.locator}
                </span>
                <span
                  lang="en"
                  className="mt-0.5 block text-[10px] leading-4 text-stone-600"
                >
                  &ldquo;{excerpt.quote}&rdquo;
                </span>
              </span>
            ))}
            <span
              lang="en"
              title={reference.title}
              className="mt-1 block break-words text-[10px] leading-4 text-stone-500"
            >
              {reference.title}
            </span>
          </a>
        ))}
        <button
          type="button"
          onClick={onShowAllEvidence}
          className="mt-2 flex w-full items-center justify-between rounded-lg border border-blue-100 bg-white px-2.5 py-2 text-[11px] font-bold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span>결과에 사용한 문헌 {evidenceCount}건 모두 보기</span>
          <span aria-hidden="true">↓</span>
        </button>
      </span>
    </span>
  );
}
export function PersonalizedSafetyQuery() {
  const formRef = useRef<HTMLFormElement>(null);
  const examplesRef = useRef<AnimatedDetailsHandle>(null);
  const evidenceRef = useRef<AnimatedDetailsHandle>(null);
  const evidenceSectionRef = useRef<HTMLDivElement>(null);
  const resultRegionRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<QueryInput>({
    ingredient: "",
    dose: "",
    medication: "",
    condition: "",
    labs: "",
  });
  const ingredientOptions = [...personalizedSafetyIngredientOrder];
  const medicationOptions: Record<string, string[]> = {
    "비타민 K": [
      "와파린",
      "항생제",
      "담즙산결합수지",
      "올리스타트",
      "없어요",
      "잘 모르겠어요",
    ],
    "오메가-3": [
      "아픽사반",
      "와파린",
      "리바록사반",
      "아스피린",
      "클로피도그렐",
      "진통소염제",
      "없어요",
      "잘 모르겠어요",
    ],
    칼슘: [
      "갑상선약",
      "퀴놀론계 항생제",
      "돌루테그라비르",
      "리튬",
      "없어요",
      "잘 모르겠어요",
    ],
    "비타민 D": [
      "티아지드 이뇨제",
      "올리스타트",
      "스테로이드",
      "스타틴",
      "없어요",
      "잘 모르겠어요",
    ],
    "비타민 C": ["철분제", "항암제", "없어요", "잘 모르겠어요"],
  };
  const conditionOptions: Record<string, string[]> = {
    "비타민 K": [
      "INR이 자주 바뀜",
      "멍이 잘 듦",
      "코피가 남",
      "잇몸 출혈",
      "검은변 또는 혈변",
      "특별한 증상 없음",
    ],
    "오메가-3": [
      "멍이 잘 듦",
      "코피가 남",
      "잇몸 출혈",
      "검은변 또는 혈변",
      "배가 아픔",
      "특별한 증상 없음",
    ],
    칼슘: [
      "신장결석 병력",
      "소변 칼슘이 높다고 들음",
      "변비",
      "메스꺼움",
      "갈증이 심하고 소변이 잦음",
      "특별한 증상 없음",
    ],
    "비타민 D": [
      "신장결석 병력",
      "칼슘 수치가 높다고 들음",
      "소변 칼슘이 높다고 들음",
      "메스꺼움",
      "갈증이 심하고 소변이 잦음",
      "특별한 증상 없음",
    ],
    "비타민 C": [
      "신장결석 병력",
      "소변 옥살산이 높다고 들음",
      "신장기능 저하",
      "배가 아픔",
      "설사",
      "메스꺼움",
      "철 과다증",
      "특별한 증상 없음",
    ],
  };
  const examplesByIngredient = personalizedSafetyIngredientOrder.map(
    (ingredient) => ({
      ingredient,
      examples: personalizedSafetyExamples.filter(
        (example) => example.input.ingredient === ingredient,
      ),
    }),
  );
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
  function showAllEvidence() {
    evidenceRef.current?.open();
    requestAnimationFrame(() => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      evidenceSectionRef.current?.scrollIntoView({
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
          toHaeyoStyle(
            String(
              body.error ??
                "안전성 결과를 불러오지 못했어요. 내용을 확인한 뒤 다시 시도해 주세요.",
            ),
          ),
        );
        return;
      }
      setResult(body);
      scrollToResultRegion();
    } catch {
      setError("안전성 결과를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }
  function fillExample(example: PersonalizedSafetyExample) {
    setDraft(example.input);
    examplesRef.current?.close();
    void runQuery(example.input);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runQuery(draft);
  }
  return (
    <section className="mx-auto px-4 py-5 sm:px-5 sm:py-6" id="query">
      <h2 className="text-xl font-semibold tracking-[-0.025em]">
        복용 조건에 따른 보충제 안전성 확인
      </h2>
      <div className="mt-4 border-l-2 border-blue-500 pl-3.5">
        <p className="text-xs font-bold text-blue-600">
          자유 입력을 구조화하는 AI
        </p>
        <p className="mt-1 break-keep text-sm leading-6 text-stone-600">
          정해진 형식이나 순서 없이 적어도 돼요. AI 해석 엔진이 약 이름·복용량,
          병력·증상, 검사 수치를 자동으로 구조화하고, 검증된 기준과 근거 문헌에
          연결해 안전성 결과를 정리해요.
        </p>
      </div>
      <AnimatedDetails
        ref={examplesRef}
        className="mt-5 overflow-hidden rounded-xl bg-stone-50"
        summaryClassName="flex min-h-12 list-none items-center justify-between gap-4 rounded-xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
        bodyClassName="border-t border-stone-200 px-4 pb-2"
        summary={
          <>
            <span className="text-sm font-bold text-stone-900">
              입력 예시 {personalizedSafetyExamples.length}개
            </span>
            <span className="collapsible-chevron flex h-7 w-7 items-center justify-center text-stone-500">
              <Chevron />
            </span>
          </>
        }
      >
        <div>
          {examplesByIngredient.map((group) => (
            <section
              key={group.ingredient}
              className="grid gap-2 border-b border-stone-200 py-4 last:border-b-0 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-3"
            >
              <h3 className="px-1 pt-2 text-sm font-bold text-stone-900">
                {group.ingredient}
              </h3>
              <div className="grid min-w-0 sm:grid-cols-3">
                {group.examples.map((example) => (
                  <button
                    type="button"
                    key={example.id}
                    onClick={() => fillExample(example)}
                    disabled={loading}
                    className="min-w-0 touch-manipulation rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-blue-50 active:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60 sm:rounded-none sm:border-l sm:border-stone-200 sm:first:border-l-0"
                  >
                    <span className="block text-sm font-bold text-stone-950">
                      {example.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-stone-600">
                      {example.description}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </AnimatedDetails>
      <form
        ref={formRef}
        onSubmit={submit}
        className="mt-7 border-t border-stone-200 pt-7"
      >
        <fieldset>
          <legend className="text-lg font-bold text-stone-950">
            1. 보충제
          </legend>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ingredientOptions.map((ingredient) => (
              <button
                key={ingredient}
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    ingredient,
                    medication: "",
                    condition: "",
                    labs: "",
                  })
                }
                className={`min-h-12 rounded-xl border px-3 text-sm font-bold transition ${draft.ingredient === ingredient ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100" : "border-stone-200 bg-white text-stone-700 hover:border-blue-300"}`}
              >
                {ingredient}
              </button>
            ))}
          </div>
        </fieldset>

        {draft.ingredient && (
          <div className="mt-7 grid gap-7">
            <fieldset>
              <legend className="text-lg font-bold text-stone-950">
                2. 제품 라벨의 하루 섭취량
              </legend>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                라벨 문구를 그대로 적으세요. 숫자와 단위를 정리해 비교해요.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  aria-label="제품 라벨의 하루 섭취량"
                  name="daily-dose"
                  autoComplete="off"
                  value={draft.dose}
                  onChange={(e) => setDraft({ ...draft, dose: e.target.value })}
                  maxLength={80}
                  placeholder={
                    draft.ingredient === "비타민 D"
                      ? "예: 4,000 IU 또는 100 μg"
                      : draft.ingredient === "오메가-3"
                        ? "예: EPA 600 mg + DHA 400 mg"
                        : "예: 600 mg"
                  }
                  className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 px-4"
                />
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, dose: "잘 모르겠어요" })}
                  className={`rounded-xl border px-4 text-sm font-semibold transition ${draft.dose === "잘 모르겠어요" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-stone-200 hover:border-blue-300"}`}
                >
                  모르겠어요
                </button>
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-lg font-bold text-stone-950">
                3. 함께 먹는 약
              </legend>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                목록을 고르거나 약 봉투에 적힌 이름을 편한 표현으로 적으세요.
                여러 개를 고를 수 있어요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(medicationOptions[draft.ingredient] ?? []).map((item) => {
                  const value = medicationChoiceValue(item);
                  const selected = hasMultiValue(draft.medication, value);
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          medication: toggleMultiValue(
                            draft.medication,
                            value,
                            exclusiveMedicationChoices,
                          ),
                        })
                      }
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${selected ? "border-blue-600 bg-blue-50 text-blue-700" : "border-stone-200 bg-white hover:border-blue-300"}`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
              <input
                aria-label="함께 먹는 약 이름"
                name="medication-names"
                autoComplete="off"
                value={draft.medication}
                onChange={(e) =>
                  setDraft({ ...draft, medication: e.target.value })
                }
                maxLength={120}
                placeholder="목록에 없으면 약 이름을 쉼표로 구분해 적으세요"
                className="mt-3 min-h-12 w-full rounded-xl border border-stone-300 px-4"
              />
            </fieldset>

            <fieldset>
              <legend className="text-lg font-bold text-stone-950">
                4. 병력 또는 현재 증상
              </legend>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                목록을 고르거나 증상을 평소 표현대로 적으세요. 여러 개를 고를 수
                있어요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(conditionOptions[draft.ingredient] ?? []).map((item) => {
                  const selected = hasMultiValue(draft.condition, item);
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          condition: toggleMultiValue(
                            draft.condition,
                            item,
                            exclusiveConditionChoices,
                          ),
                        })
                      }
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${selected ? "border-blue-600 bg-blue-50 text-blue-700" : "border-stone-200 bg-white hover:border-blue-300"}`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
              <input
                aria-label="병력 또는 현재 증상"
                name="conditions"
                autoComplete="off"
                value={draft.condition}
                onChange={(e) =>
                  setDraft({ ...draft, condition: e.target.value })
                }
                maxLength={200}
                placeholder="목록에 없으면 병력과 증상을 쉼표로 구분해 적으세요"
                className="mt-3 min-h-12 w-full rounded-xl border border-stone-300 px-4"
              />
            </fieldset>

            <fieldset>
              <legend className="flex items-center gap-2 text-lg font-bold text-stone-950">
                5. 최근 검사 결과
                <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-semibold text-stone-500">
                  선택
                </span>
              </legend>
              <p className="mt-1 break-keep text-sm leading-6 text-stone-500">
                검사표 문구를 그대로 옮겨 적으세요. 단위가 빠지거나 표현이
                달라도 AI가 검사 이름과 수치를 구분해요.
              </p>
              <textarea
                aria-label="최근 검사 결과"
                name="lab-results"
                autoComplete="off"
                value={draft.labs}
                onChange={(e) => setDraft({ ...draft, labs: e.target.value })}
                maxLength={200}
                rows={2}
                placeholder="예: 비타민 D 48, 소변 칼슘은 280 정도…"
                className="mt-3 min-h-20 w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 leading-6"
              />
            </fieldset>
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !draft.ingredient}
          className="mt-7 min-h-12 w-full rounded-xl bg-stone-950 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              문헌 확인 중
            </span>
          ) : draft.ingredient ? (
            "안전성 결과 보기"
          ) : (
            "먼저 보충제를 고르세요"
          )}
        </button>
      </form>
      <div
        ref={resultRegionRef}
        className="scroll-mt-6"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading && (
          <section
            role="status"
            className="motion-enter mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm"
          >
            <div className="flex items-center gap-4 px-5 py-5">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
                <span className="absolute h-5 w-5 animate-ping rounded-full bg-blue-200/70" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-blue-600" />
              </span>
              <div>
                <p className="font-bold text-stone-950">
                  입력 내용을 해석하고 있어요
                </p>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  약 이름·증상·검사 결과를 정리한 뒤 관련 문헌과 비교해요.
                </p>
              </div>
            </div>
          </section>
        )}
        {error && (
          <p className="motion-enter mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {result && (
          <article className="motion-enter relative mt-6 overflow-visible rounded-2xl border border-stone-200 bg-white shadow-sm">
            <header className="px-5 pb-2 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold text-blue-600">
                  안전성 검토 결과
                </p>
                {(result.narrative_assessment.ai_used ||
                  result.input_interpretation.ai_used) && (
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                    AI 해석 적용
                  </span>
                )}
              </div>
              <h3 className="mt-2 break-keep text-xl font-bold leading-7 text-stone-950">
                {result.title}
              </h3>
            </header>
            <div className="p-5 pt-3">
              <section className="break-keep rounded-2xl bg-[#f2f6ff] px-5 py-5 text-[15px] font-medium leading-7 text-[#333d4b]">
                <p className="font-semibold text-stone-950">
                  <EvidenceSentence
                    references={result.assessment.references}
                    evidenceCount={result.evidence_selection.selected}
                    onShowAllEvidence={showAllEvidence}
                  >
                    {toHaeyoStyle(result.narrative_assessment.conclusion)}
                  </EvidenceSentence>
                </p>
                <p className="mt-5">
                  {toHaeyoStyle(result.narrative_assessment.context)}
                </p>
                <p className="mt-5">
                  <EvidenceSentence
                    references={result.assessment.references}
                    evidenceCount={result.evidence_selection.selected}
                    onShowAllEvidence={showAllEvidence}
                  >
                    {toHaeyoStyle(result.narrative_assessment.explanation)}
                  </EvidenceSentence>
                </p>
                <p className="mt-5">
                  <EvidenceSentence
                    references={result.assessment.references.slice(1)}
                    evidenceCount={result.evidence_selection.selected}
                    onShowAllEvidence={showAllEvidence}
                  >
                    {toHaeyoStyle(result.narrative_assessment.next)}
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
              <AnimatedDetails
                className="mt-5 rounded-xl border border-stone-200"
                summaryClassName="flex min-h-12 list-none items-center justify-between px-4 py-3 font-semibold"
                bodyClassName="grid gap-5 border-t border-stone-200 p-4 md:grid-cols-2"
                summary={
                  <>
                    <span>판단 기준과 추가 확인 사항</span>
                    <span className="collapsible-chevron text-stone-500">
                      <Chevron />
                    </span>
                  </>
                }
              >
                <div>
                  <p className="mb-2 text-sm font-bold text-stone-900">
                    판단 기준
                  </p>
                  <ol className="grid gap-2">
                    {result.checks.map((x, i) => (
                      <li key={x} className="flex gap-3 text-sm leading-6">
                        <b className="text-blue-700">{i + 1}</b>
                        <span>{toHaeyoStyle(x)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold text-stone-900">
                    추가 확인 사항
                  </p>
                  <ul className="grid gap-2 text-sm leading-6">
                    {result.next_steps.map((x) => (
                      <li key={x} className="flex gap-2">
                        <span className="text-emerald-600">✓</span>
                        <span>{toHaeyoStyle(x)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimatedDetails>
              <div ref={evidenceSectionRef} className="mt-3 scroll-mt-6">
                <AnimatedDetails
                  ref={evidenceRef}
                  className="rounded-xl border border-stone-200"
                  summaryClassName="flex min-h-12 list-none items-center justify-between px-4 py-3 font-semibold"
                  summary={
                    <>
                      <span>결과에 사용한 문헌</span>
                      <span className="flex items-center gap-2 text-sm text-stone-500">
                        {result.evidence_selection.selected}건 · 후보{" "}
                        {result.evidence_selection.total_candidates}건 중 성분 직접{" "}
                        {result.evidence_selection.ingredient_matches}건{" "}
                        <span className="collapsible-chevron">
                          <Chevron />
                        </span>
                      </span>
                    </>
                  }
                >
                <div className="border-t border-stone-200 bg-blue-50/50 px-4 py-3 text-xs leading-5 text-stone-600">
                  <p>{toHaeyoStyle(result.evidence_selection.method)}</p>
                  {result.evidence_selection.medication_name && (
                    <p className="mt-1">
                      {withObjectParticle(
                        result.evidence_selection.medication_name,
                      )}{" "}
                      직접 언급한 문헌은{" "}
                      {result.evidence_selection.direct_medication_matches}
                      건이에요.
                    </p>
                  )}
                  <p className="mt-1 text-stone-500">
                    각 한글 문장은 바로 아래 영문 초록 문장의 자동 번역이에요.
                  </p>
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
                      <p className="mt-2 text-sm font-medium leading-6 text-stone-800">
                        {toHaeyoStyle(x.key_finding_ko)}
                      </p>
                      <p
                        lang="en"
                        className="mt-1 text-xs leading-5 text-stone-500"
                      >
                        {x.key_finding}
                      </p>
                      {x.dose && (
                        <p className="mt-2 text-xs text-stone-600">
                          논문에 보고된 용량: {x.dose}
                        </p>
                      )}
                      <p className="mt-2 text-xs leading-5 text-stone-600">
                        {toHaeyoStyle(x.selection_reason)}
                      </p>
                    </div>
                  ))}
                </div>
                <AnimatedDetails
                  className="border-t border-stone-200 bg-stone-50/70"
                  summaryClassName="flex min-h-12 list-none items-center justify-between px-4 py-3 text-sm font-semibold text-stone-700"
                  bodyClassName="max-h-96 overflow-y-auto border-t border-stone-200 px-4"
                  summary={
                    <>
                      <span>
                        검색된 후보 문헌{" "}
                        {result.evidence_selection.total_candidates}건
                      </span>
                      <span className="collapsible-chevron text-stone-500">
                        <Chevron />
                      </span>
                    </>
                  }
                >
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
                      <p className="mt-1 text-xs font-medium leading-5 text-stone-700">
                        {toHaeyoStyle(item.key_finding_ko)}
                      </p>
                      <p
                        lang="en"
                        className="mt-1 text-xs leading-5 text-stone-500"
                      >
                        {item.key_finding}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {item.year ? `${item.year} · ` : ""}
                        {!item.ingredient_match
                          ? "같은 임상 상황의 후보 문헌 · "
                          : ""}
                        {toHaeyoStyle(item.selection_reason)}
                      </p>
                    </div>
                  ))}
                </AnimatedDetails>
                  </AnimatedDetails>
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
