"use client";

import { FormEvent, useState } from "react";
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
  disclaimer: string;
  error?: string;
};

const emptyForm = {
  situation: "" as SituationId | "",
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

export function PersonalizedSafetyQuery() {
  const [form, setForm] = useState(emptyForm);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const update = (key: keyof typeof emptyForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.situation) {
      setError("먼저 지금 상황을 하나 고르세요.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/personalized-safety", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body: ApiResult = await response.json();
      if (!response.ok) {
        setError(body.error ?? "결과를 불러오지 못했습니다.");
        setResult(null);
        return;
      }
      setResult(body);
    } catch {
      setError("네트워크 문제로 결과를 불러오지 못했습니다.");
      setResult(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-3">
          <legend className="block text-sm font-bold text-stone-950">
            지금 상황이 어디에 해당하나요?
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
                      ? "border-blue-600 bg-blue-600 text-white"
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
          <legend className="block text-sm font-bold text-stone-950">
            해당하는 것만 적어주세요 <span className="font-normal text-stone-500">(비워도 됩니다)</span>
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {axes.map((axis) => (
              <label key={axis.id} className="flex flex-col gap-1">
                <span className="block text-[11px] font-bold text-blue-700">
                  {axis.label}
                </span>
                <input
                  value={form[axis.field]}
                  onChange={(event) => update(axis.field, event.target.value)}
                  placeholder={axis.placeholder}
                  maxLength={120}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-blue-500"
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "찾는 중" : "관련 문헌 찾기"}
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm);
              setResult(null);
              setError("");
            }}
            className="rounded-full border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-600"
          >
            비우기
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <span className="block text-[10px] font-semibold leading-4 text-stone-500">
          이렇게 물어볼 수 있어요
        </span>
        <div className="flex flex-wrap gap-2">
          {publicInputExamples.map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => {
                setForm(example.input);
                setResult(null);
                setError("");
              }}
              className="rounded-lg border border-stone-200 bg-stone-50/70 px-3 py-2 text-left text-xs leading-5 text-stone-700 hover:border-blue-400"
            >
              {example.title}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      {result ? (
        <article className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white">
          <header className="flex flex-col gap-2 px-5 pt-5">
            <span className="block text-[11px] font-bold text-blue-600">
              {result.situation_label}
            </span>
            <p className="text-sm leading-6 text-stone-800">{result.summary}</p>
            {result.unavailable_axes.length ? (
              <p className="text-xs leading-5 text-stone-500">
                이 상황의 문헌에는{" "}
                {result.unavailable_axes
                  .map((item) => item.value)
                  .join(", ")}{" "}
                조건을 나눈 근거가 없어 반영하지 않았습니다.
              </p>
            ) : null}
          </header>

          {result.evidence.length ? (
            <ol className="divide-y divide-stone-200 border-t border-stone-200 px-5">
              {result.evidence.map((item) => {
                const locator = splitLocator(item.locator);
                return (
                  <li key={item.record_id} className="flex flex-col gap-2 py-4">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-bold leading-6 text-stone-950 underline decoration-stone-300 underline-offset-4"
                    >
                      {item.title}
                    </a>
                    <p className="text-xs leading-5 text-stone-500">
                      {item.authors} · {item.venue} · {item.year} ·{" "}
                      {item.publication_types.split("|")[0]}
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
          ) : null}

          <footer className="border-t border-stone-200 bg-blue-50/50 px-5 py-3 text-xs leading-5 text-stone-600">
            {result.disclaimer || evidenceOnlyDisclaimer}
          </footer>
        </article>
      ) : null}
    </section>
  );
}
