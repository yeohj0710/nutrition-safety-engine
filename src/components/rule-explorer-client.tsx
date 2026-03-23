"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";

import { RuleCard } from "@/src/components/rule-card";
import type { AiExplainResponse } from "@/src/lib/ai/schema";
import type {
  EngineQuery,
  EngineResponse,
  RuleMatch,
} from "@/src/types/knowledge";

type ExplorerMetadata = {
  meta: {
    sourceCount: number;
    evidenceChunkCount: number;
    safetyRuleCount: number;
  };
  jurisdictions: string[];
  sortOptions: Array<{ value: string; label: string }>;
};

const sectionLabels = {
  definitely_matched: "확정 매칭",
  possibly_relevant: "참고 가능",
  needs_more_info: "추가 정보 필요",
} as const;

const confidenceRank = { high: 4, medium: 3, low: 2, unknown: 1 } as const;
const categoryRank: Record<string, number> = {
  interaction: 1,
  timing_separation: 2,
  disease_caution: 3,
  adverse_effect_signal: 4,
  population_caution: 5,
  monitoring: 6,
  dose_limit: 7,
  quality_signal: 8,
  pregnancy_lactation: 9,
};

function splitMultiValue(value: string) {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function groupBySeverity(matches: RuleMatch[]) {
  return {
    "금지/중단": matches.filter((match) =>
      ["contraindicated", "avoid"].includes(match.resolvedSeverity),
    ),
    "강한 주의": matches.filter((match) => match.resolvedSeverity === "warn"),
    "일반 주의": matches.filter(
      (match) => match.resolvedSeverity === "monitor",
    ),
  };
}

function filterMatches(
  matches: RuleMatch[],
  filters: {
    severity: string;
    nutrient: string;
    pregnancyOnly: boolean;
    medicationOnly: boolean;
    diseaseOnly: boolean;
    jurisdiction: string;
  },
) {
  return matches.filter((match) => {
    if (filters.severity && match.resolvedSeverity !== filters.severity)
      return false;
    if (
      filters.nutrient &&
      !match.rule.nutrientOrIngredient
        .toLowerCase()
        .includes(filters.nutrient.toLowerCase())
    )
      return false;
    if (
      filters.pregnancyOnly &&
      !match.rule.pregnancyFlag &&
      !match.rule.lactationFlag
    )
      return false;
    if (filters.medicationOnly && match.rule.interactionDrugs.length === 0)
      return false;
    if (filters.diseaseOnly && match.rule.interactionDiseases.length === 0)
      return false;
    if (
      filters.jurisdiction &&
      match.rule.jurisdiction !== filters.jurisdiction
    )
      return false;
    return true;
  });
}

function sortMatches(
  matches: RuleMatch[],
  sort: NonNullable<EngineQuery["sort"]>,
) {
  const sorted = [...matches];

  sorted.sort((left, right) => {
    if (sort === "confidence_desc") {
      const difference =
        confidenceRank[right.rule.confidence] -
        confidenceRank[left.rule.confidence];
      if (difference !== 0) return difference;
    }
    if (sort === "nutrient_name") {
      const difference = left.rule.nutrientOrIngredient.localeCompare(
        right.rule.nutrientOrIngredient,
        "ko",
      );
      if (difference !== 0) return difference;
    }
    if (sort === "recently_reviewed") {
      const difference =
        new Date(right.rule.lastReviewedAt ?? 0).getTime() -
        new Date(left.rule.lastReviewedAt ?? 0).getTime();
      if (difference !== 0) return difference;
    }
    if (sort === "severity_desc") {
      const severityRank = {
        contraindicated: 4,
        avoid: 3,
        warn: 2,
        monitor: 1,
      } as const;
      const difference =
        severityRank[right.resolvedSeverity] -
        severityRank[left.resolvedSeverity];
      if (difference !== 0) return difference;
    }

    const categoryDifference =
      (categoryRank[left.rule.ruleCategory] ?? 99) -
      (categoryRank[right.rule.ruleCategory] ?? 99);
    if (categoryDifference !== 0) return categoryDifference;

    const confidenceDifference =
      confidenceRank[right.rule.confidence] -
      confidenceRank[left.rule.confidence];
    if (confidenceDifference !== 0) return confidenceDifference;

    return right.rule.priority - left.rule.priority;
  });

  return sorted;
}

function buildProfileSummary(values: {
  age: string;
  sex: string;
  pregnancyStatus: string;
  lactationStatus: string;
  smokerStatus: string;
  medications: string;
  conditions: string;
  allergies: string;
  selectedCompounds: string;
  jurisdiction: string;
}) {
  return [
    values.age ? `나이 ${values.age}` : null,
    values.sex ? `성별 ${values.sex}` : null,
    values.pregnancyStatus ? `임신 ${values.pregnancyStatus}` : null,
    values.lactationStatus ? `수유 ${values.lactationStatus}` : null,
    values.smokerStatus ? `흡연 ${values.smokerStatus}` : null,
    values.medications ? `약물 ${values.medications}` : null,
    values.conditions ? `질환 ${values.conditions}` : null,
    values.allergies ? `알레르기 ${values.allergies}` : null,
    values.selectedCompounds ? `성분 ${values.selectedCompounds}` : null,
    `관할권 ${values.jurisdiction}`,
  ]
    .filter(Boolean)
    .join(" / ");
}

function getVisibleSections(
  response: EngineResponse | null,
  filters: {
    severity: string;
    nutrient: string;
    pregnancyOnly: boolean;
    medicationOnly: boolean;
    diseaseOnly: boolean;
    jurisdiction: string;
    sort: NonNullable<EngineQuery["sort"]>;
  },
) {
  if (!response) return null;
  return {
    definitely_matched: sortMatches(
      filterMatches(response.definitely_matched, filters),
      filters.sort,
    ),
    possibly_relevant: sortMatches(
      filterMatches(response.possibly_relevant, filters),
      filters.sort,
    ),
    needs_more_info: sortMatches(
      filterMatches(response.needs_more_info, filters),
      filters.sort,
    ),
  };
}

function buildVisiblePayload(
  visible: NonNullable<ReturnType<typeof getVisibleSections>>,
  response: EngineResponse,
  filters: {
    severity: string;
    nutrient: string;
    pregnancyOnly: boolean;
    medicationOnly: boolean;
    diseaseOnly: boolean;
    jurisdiction: string;
    sort: NonNullable<EngineQuery["sort"]>;
  },
) {
  return {
    generatedAt: response.generatedAt,
    query: response.query,
    activeFilters: filters,
    visibleCounts: {
      definitely_matched: visible.definitely_matched.length,
      possibly_relevant: visible.possibly_relevant.length,
      needs_more_info: visible.needs_more_info.length,
    },
    visible,
  };
}

export function RuleExplorerClient({
  metadata,
}: {
  metadata: ExplorerMetadata;
}) {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [pregnancyStatus, setPregnancyStatus] = useState("");
  const [lactationStatus, setLactationStatus] = useState("");
  const [smokerStatus, setSmokerStatus] = useState("");
  const [medications, setMedications] = useState("");
  const [conditions, setConditions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [selectedCompounds, setSelectedCompounds] = useState("");
  const [jurisdiction, setJurisdiction] = useState("KR");
  const [memo, setMemo] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [nutrientFilter, setNutrientFilter] = useState("");
  const [pregnancyOnly, setPregnancyOnly] = useState(false);
  const [medicationOnly, setMedicationOnly] = useState(false);
  const [diseaseOnly, setDiseaseOnly] = useState(false);
  const [jurisdictionFilter, setJurisdictionFilter] = useState("");
  const [sort, setSort] =
    useState<NonNullable<EngineQuery["sort"]>>("severity_desc");
  const [response, setResponse] = useState<EngineResponse | null>(null);
  const [hasQueried, setHasQueried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiResponse, setAiResponse] = useState<AiExplainResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isMale = sex === "male";
  const hasResponse = Boolean(response);
  const filters = {
    severity: severityFilter,
    nutrient: nutrientFilter,
    pregnancyOnly,
    medicationOnly,
    diseaseOnly,
    jurisdiction: jurisdictionFilter,
    sort,
  };
  const visible = getVisibleSections(response, filters);

  async function submitQuery(query?: EngineQuery) {
    const payload: EngineQuery = query ?? {
      profile: {
        age: age ? Number(age) : undefined,
        sex: sex || undefined,
        pregnancyStatus: isMale ? undefined : pregnancyStatus || undefined,
        lactationStatus: isMale ? undefined : lactationStatus || undefined,
        smokerStatus: smokerStatus || undefined,
        medications: splitMultiValue(medications),
        conditions: splitMultiValue(conditions),
        allergies: splitMultiValue(allergies),
        selectedCompounds: splitMultiValue(selectedCompounds),
        jurisdiction,
        memo,
      },
      sort,
    };

    setHasQueried(true);
    setError(null);

    const result = await fetch("/api/rules/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!result.ok) {
      const errorPayload = (await result.json()) as { error?: string };
      throw new Error(errorPayload.error ?? "규칙을 불러오지 못했습니다.");
    }

    const data = (await result.json()) as EngineResponse;
    setResponse(data);
    setAiResponse(null);
    setAiNotice(null);
    setClipboardNotice(null);
  }

  async function submitAiExplanation(engineResponse: EngineResponse) {
    setAiLoading(true);
    setAiNotice(null);

    const result = await fetch("/api/ai-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engineResponse,
        profileSummary: buildProfileSummary({
          age,
          sex,
          pregnancyStatus,
          lactationStatus,
          smokerStatus,
          medications,
          conditions,
          allergies,
          selectedCompounds,
          jurisdiction,
        }),
        selectedFilters: {
          severity: severityFilter || undefined,
          nutrientOrIngredient: nutrientFilter || undefined,
          pregnancyOrLactationOnly: pregnancyOnly || undefined,
          medicationInteractionOnly: medicationOnly || undefined,
          diseaseInteractionOnly: diseaseOnly || undefined,
          jurisdiction: jurisdictionFilter || undefined,
        },
      }),
    });

    if (!result.ok) {
      const payload = (await result.json()) as { error?: string };
      throw new Error(payload.error ?? "AI 설명을 생성하지 못했습니다.");
    }

    const payload = (await result.json()) as AiExplainResponse;
    setAiResponse(payload);
    if (!payload.ok) setAiNotice(payload.notice);
  }

  const runAiExplanation = useEffectEvent((engineResponse: EngineResponse) => {
    if (!aiEnabled) {
      setAiResponse(null);
      setAiNotice(null);
      return;
    }

    void submitAiExplanation(engineResponse)
      .catch((caught) => {
        setAiResponse(null);
        setAiNotice(
          caught instanceof Error
            ? caught.message
            : "AI 설명을 생성하지 못했습니다.",
        );
      })
      .finally(() => setAiLoading(false));
  });

  useEffect(() => {
    if (response) runAiExplanation(response);
  }, [
    aiEnabled,
    response,
    severityFilter,
    nutrientFilter,
    pregnancyOnly,
    medicationOnly,
    diseaseOnly,
    jurisdictionFilter,
  ]);

  function resetForm() {
    setAge("");
    setSex("");
    setPregnancyStatus("");
    setLactationStatus("");
    setSmokerStatus("");
    setMedications("");
    setConditions("");
    setAllergies("");
    setSelectedCompounds("");
    setJurisdiction("KR");
    setMemo("");
    setSeverityFilter("");
    setNutrientFilter("");
    setPregnancyOnly(false);
    setMedicationOnly(false);
    setDiseaseOnly(false);
    setJurisdictionFilter("");
    setSort("severity_desc");
    setAiEnabled(false);
    setAiResponse(null);
    setAiNotice(null);
    setClipboardNotice(null);
    setError(null);
    setResponse(null);
    setHasQueried(false);
  }

  function downloadJson() {
    if (!visible || !response) return;
    const payload = buildVisiblePayload(visible, response, filters);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nutrition-safety-results.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyJson() {
    if (!visible || !response) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          buildVisiblePayload(visible, response, filters),
          null,
          2,
        ),
      );
      setClipboardNotice("현재 필터 기준 JSON을 클립보드에 복사했습니다.");
    } catch {
      setClipboardNotice("클립보드 복사에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-stone-500">
              Profile
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
              영양 안전 규칙 탐색기
            </h1>
            <p className="text-sm leading-6 text-stone-700">
              성분, 약물, 질환 조건을 위에서 넓게 입력하고 바로 결과를 비교할 수
              있도록 정리했습니다. 초기 상태에서는 자동으로 금기/주의 결과를
              띄우지 않습니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Sources
              </p>
              <p className="mt-2 text-xl font-semibold text-stone-950">
                {metadata.meta.sourceCount}
              </p>
            </div>
            <div className="rounded-2xl bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Evidence
              </p>
              <p className="mt-2 text-xl font-semibold text-stone-950">
                {metadata.meta.evidenceChunkCount}
              </p>
            </div>
            <div className="rounded-2xl bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Rules
              </p>
              <p className="mt-2 text-xl font-semibold text-stone-950">
                {metadata.meta.safetyRuleCount}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          <label className="space-y-1 text-sm text-stone-700 lg:col-span-5">
            <span className="font-medium text-stone-900">선택 성분</span>
            <textarea
              value={selectedCompounds}
              onChange={(event) => setSelectedCompounds(event.target.value)}
              rows={3}
              placeholder="예: 비타민 D, 마그네슘"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-400"
            />
            <p className="text-xs text-stone-500">
              쉼표 또는 줄바꿈으로 여러 성분을 넣을 수 있습니다.
            </p>
          </label>

          <label className="space-y-1 text-sm text-stone-700 lg:col-span-3">
            <span className="font-medium text-stone-900">복용 약물</span>
            <textarea
              value={medications}
              onChange={(event) => setMedications(event.target.value)}
              rows={3}
              placeholder="예: warfarin, levothyroxine"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-400"
            />
          </label>

          <label className="space-y-1 text-sm text-stone-700 lg:col-span-4">
            <span className="font-medium text-stone-900">질환 / 상태</span>
            <textarea
              value={conditions}
              onChange={(event) => setConditions(event.target.value)}
              rows={3}
              placeholder="예: diabetes, chronic liver disease"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-400"
            />
          </label>

          <label className="space-y-1 text-sm text-stone-700 lg:col-span-2">
            <span>나이</span>
            <input
              value={age}
              onChange={(event) => setAge(event.target.value)}
              type="number"
              inputMode="numeric"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-400"
            />
          </label>

          <label className="space-y-1 text-sm text-stone-700 lg:col-span-2">
            <span>성별</span>
            <select
              value={sex}
              onChange={(event) => {
                const nextSex = event.target.value;
                setSex(nextSex);
                if (nextSex === "male") {
                  setPregnancyStatus("");
                  setLactationStatus("");
                }
              }}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-400"
            >
              <option value="">미입력</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </label>

          <label className="space-y-1 text-sm text-stone-700 lg:col-span-2">
            <span>흡연 상태</span>
            <select
              value={smokerStatus}
              onChange={(event) => setSmokerStatus(event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-400"
            >
              <option value="">미입력</option>
              <option value="current">현재 흡연</option>
              <option value="former">과거 흡연</option>
              <option value="never">비흡연</option>
            </select>
          </label>

          <label className="space-y-1 text-sm text-stone-700 lg:col-span-2">
            <span>관할권</span>
            <select
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-400"
            >
              <option value="KR">KR</option>
              {metadata.jurisdictions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-stone-700 lg:col-span-2">
            <span>임신 상태</span>
            <select
              value={pregnancyStatus}
              onChange={(event) => setPregnancyStatus(event.target.value)}
              disabled={isMale}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-400 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
            >
              <option value="">
                {isMale ? "남성 선택 시 비활성화" : "미입력"}
              </option>
              <option value="pregnant">임신 중</option>
              <option value="trying_to_conceive">임신 준비 중</option>
              <option value="unknown_possible">가능성 있음</option>
            </select>
          </label>

          <label className="space-y-1 text-sm text-stone-700 lg:col-span-2">
            <span>수유 상태</span>
            <select
              value={lactationStatus}
              onChange={(event) => setLactationStatus(event.target.value)}
              disabled={isMale}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-400 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
            >
              <option value="">
                {isMale ? "남성 선택 시 비활성화" : "미입력"}
              </option>
              <option value="lactating">수유 중</option>
            </select>
          </label>

          <label className="space-y-1 text-sm text-stone-700 lg:col-span-4">
            <span>알레르기</span>
            <textarea
              value={allergies}
              onChange={(event) => setAllergies(event.target.value)}
              rows={3}
              placeholder="예: shellfish"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-400"
            />
          </label>

          <label className="space-y-1 text-sm text-stone-700 lg:col-span-8">
            <span>메모</span>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              rows={3}
              placeholder="자유 메모. 안전하게 매칭 가능한 키워드만 참고합니다."
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-400"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-600">
            약물/질환 조건을 먼저 보고, 임신/수유는 보조적으로 확인할 수 있게
            순서를 조정했습니다.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                startTransition(
                  () =>
                    void submitQuery().catch((caught) => {
                      setError(
                        caught instanceof Error
                          ? caught.message
                          : "규칙을 불러오지 못했습니다.",
                      );
                    }),
                )
              }
              className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              규칙 조회
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-400"
            >
              초기화
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-stone-200 bg-white/80 p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-[11rem] flex-1">
            <label className="space-y-1 text-sm text-stone-700">
              <span>위험도</span>
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-stone-400"
              >
                <option value="">전체</option>
                <option value="contraindicated">금지</option>
                <option value="avoid">중단/회피</option>
                <option value="warn">강한 주의</option>
                <option value="monitor">일반 주의</option>
              </select>
            </label>
          </div>

          <div className="min-w-[14rem] flex-[1.3]">
            <label className="space-y-1 text-sm text-stone-700">
              <span>성분명 검색</span>
              <input
                value={nutrientFilter}
                onChange={(event) => setNutrientFilter(event.target.value)}
                placeholder="가르시니아, 비타민 D"
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-stone-400"
              />
            </label>
          </div>

          <div className="min-w-[11rem] flex-1">
            <label className="space-y-1 text-sm text-stone-700">
              <span>관할권</span>
              <select
                value={jurisdictionFilter}
                onChange={(event) => setJurisdictionFilter(event.target.value)}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-stone-400"
              >
                <option value="">전체</option>
                {metadata.jurisdictions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="min-w-[13rem] flex-1">
            <label className="space-y-1 text-sm text-stone-700">
              <span>정렬</span>
              <select
                value={sort}
                onChange={(event) =>
                  setSort(
                    event.target.value as NonNullable<EngineQuery["sort"]>,
                  )
                }
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-stone-400"
              >
                {metadata.sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-full border border-stone-200 px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={medicationOnly}
              onChange={(event) => setMedicationOnly(event.target.checked)}
            />
            약물 상호작용만
          </label>

          <label className="flex items-center gap-3 rounded-full border border-stone-200 px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={diseaseOnly}
              onChange={(event) => setDiseaseOnly(event.target.checked)}
            />
            질환 상호작용만
          </label>

          <label className="flex items-center gap-3 rounded-full border border-stone-200 px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={pregnancyOnly}
              onChange={(event) => setPregnancyOnly(event.target.checked)}
            />
            임신/수유만
          </label>
        </div>
      </section>

      <section className="rounded-[2rem] border border-stone-200 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-stone-500">
              Knowledge
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-950">
              정규화된 로컬 규칙 인덱스
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              출처 {metadata.meta.sourceCount}건 · 근거 청크{" "}
              {metadata.meta.evidenceChunkCount}건 · 규칙{" "}
              {metadata.meta.safetyRuleCount}건
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label
              className={`flex items-center gap-3 rounded-full border px-4 py-3 text-sm ${hasResponse ? "border-stone-200 bg-white text-stone-700" : "border-stone-200 bg-stone-100 text-stone-400"}`}
            >
              <input
                type="checkbox"
                checked={aiEnabled}
                disabled={!hasResponse}
                onChange={(event) => {
                  setAiEnabled(event.target.checked);
                  if (!event.target.checked) {
                    setAiResponse(null);
                    setAiNotice(null);
                  }
                }}
              />
              AI로 쉽게 설명하기
            </label>
            <button
              type="button"
              disabled={!hasResponse || isPending}
              onClick={copyJson}
              className="rounded-full border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 transition enabled:hover:border-stone-400 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
            >
              결과 JSON 복사
            </button>
            <button
              type="button"
              disabled={!hasResponse || isPending}
              onClick={downloadJson}
              className="rounded-full border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 transition enabled:hover:border-stone-400 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
            >
              결과 JSON 다운로드
            </button>
          </div>
        </div>
        {clipboardNotice ? (
          <p aria-live="polite" className="mt-4 text-sm text-stone-700">
            {clipboardNotice}
          </p>
        ) : null}
      </section>

      {isPending ? (
        <div
          aria-live="polite"
          className="rounded-[2rem] border border-stone-200 bg-white p-10 text-center text-stone-600"
        >
          규칙을 불러오는 중입니다...
        </div>
      ) : null}
      {error ? (
        <div
          aria-live="polite"
          className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {aiEnabled && response ? (
        <section className="rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">
              AI 정리
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-950">
              사용자 친화 요약
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              이 구역은 결정된 규칙 결과를 읽기 쉽게 정리하는 보조 설명입니다.
              실제 해석은 아래의 결정적 규칙 카드와 근거 링크를 기준으로
              확인하세요.
            </p>
          </div>

          {aiLoading ? (
            <div className="mt-5 rounded-2xl bg-emerald-50 px-5 py-6 text-sm text-emerald-800">
              AI가 deterministic 결과를 바탕으로 요약을 작성하는 중입니다...
            </div>
          ) : null}
          {aiNotice ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              {aiNotice}
            </div>
          ) : null}

          {aiResponse?.ok ? (
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl bg-emerald-50 px-5 py-4">
                <h3 className="text-lg font-semibold text-emerald-950">
                  {aiResponse.explanation.summaryTitle}
                </h3>
                <p className="mt-2 text-sm leading-6 text-emerald-950/90">
                  {aiResponse.explanation.summaryParagraph}
                </p>
              </div>

              {aiResponse.explanation.topAlerts.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">
                    상위 경고
                  </h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {aiResponse.explanation.topAlerts.map((alert) => (
                      <div
                        key={`${alert.title}-${alert.reason}`}
                        className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                          {alert.severity}
                        </p>
                        <p className="mt-2 font-semibold text-stone-950">
                          {alert.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-stone-700">
                          {alert.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-stone-200 p-4">
                  <h3 className="font-semibold text-stone-950">
                    추가로 있으면 좋은 정보
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
                    {aiResponse.explanation.missingInformation.length > 0 ? (
                      aiResponse.explanation.missingInformation.map((item) => (
                        <li key={item}>• {item}</li>
                      ))
                    ) : (
                      <li>
                        현재 요약에서 추가로 필요한 핵심 정보는 식별되지
                        않았습니다.
                      </li>
                    )}
                  </ul>
                </section>
                <section className="rounded-2xl border border-stone-200 p-4">
                  <h3 className="font-semibold text-stone-950">
                    다음 단계 제안
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
                    {aiResponse.explanation.userFriendlyNextSteps.map(
                      (item) => (
                        <li key={item}>• {item}</li>
                      ),
                    )}
                  </ul>
                </section>
              </div>

              <p className="text-sm leading-6 text-stone-600">
                {aiResponse.explanation.disclaimer}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-stone-200 bg-white/80 p-6 shadow-sm">
        <p className="text-sm uppercase tracking-[0.2em] text-stone-500">
          근거 규칙 원문
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-950">
          결정적 규칙 엔진 결과
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          아래 카드는 authoritative layer입니다. 실제 매칭, 위험도, 수치 기준은
          결정적 엔진이 계산한 이 결과와 연결된 원문 링크를 기준으로 확인합니다.
        </p>
      </section>

      {visible
        ? (Object.keys(visible) as Array<keyof typeof visible>).map(
            (sectionKey) => {
              const sectionItems = visible[sectionKey];
              const groups = groupBySeverity(sectionItems);

              return (
                <section key={sectionKey} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-stone-950">
                      {sectionLabels[sectionKey]}
                    </h2>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
                      {sectionItems.length}건
                    </span>
                  </div>

                  {sectionItems.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-stone-300 bg-white/70 p-8 text-center text-sm text-stone-600">
                      현재 필터 조건에 맞는 결과가 없습니다.
                    </div>
                  ) : (
                    Object.entries(groups)
                      .filter(([, matches]) => matches.length > 0)
                      .map(([label, matches]) => (
                        <div key={label} className="space-y-3">
                          <h3 className="text-lg font-semibold text-stone-900">
                            {label}
                          </h3>
                          <div className="space-y-3">
                            {matches.map((match) => (
                              <RuleCard
                                key={`${sectionKey}-${match.ruleId}`}
                                match={match}
                              />
                            ))}
                          </div>
                        </div>
                      ))
                  )}
                </section>
              );
            },
          )
        : !isPending && (
            <section className="rounded-[2rem] border border-dashed border-stone-300 bg-white/70 p-8">
              <h3 className="text-lg font-semibold text-stone-950">
                {hasQueried ? "조회 결과가 없습니다." : "조회 전 안내"}
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-700">
                {hasQueried
                  ? "조건을 바꾸거나 필터를 완화해서 다시 확인해 보세요."
                  : "성분 또는 약물/질환 조건을 입력한 뒤 조회하세요. 초기 상태에서는 자동으로 금기나 주의 결과를 띄우지 않도록 바꿨습니다."}
              </p>
              {!hasQueried ? (
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  성분을 먼저 넣으면 결과가 훨씬 좁고 읽기 쉽게 정리됩니다.
                </p>
              ) : null}
            </section>
          )}
    </div>
  );
}
