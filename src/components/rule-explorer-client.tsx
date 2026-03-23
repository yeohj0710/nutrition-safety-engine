"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { RuleCard } from "@/src/components/rule-card";
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
  definitely_matched: "바로 확인할 항목",
  possibly_relevant: "참고 항목",
  needs_more_info: "정보 보완 필요",
} as const;

const sectionDescriptions = {
  definitely_matched: "입력한 조건과 직접 맞닿아 있는 규칙입니다.",
  possibly_relevant: "일반 경고나 참고 성격이 강한 항목입니다.",
  needs_more_info: "용량이나 상태 정보가 더 있으면 더 정확해집니다.",
} as const;
const sectionPreviewCounts = {
  definitely_matched: 6,
  possibly_relevant: 5,
  needs_more_info: 4,
} as const;
const sectionLoadMoreStep = {
  definitely_matched: 6,
  possibly_relevant: 5,
  needs_more_info: 8,
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

const fieldLabelClass =
  "mb-3 block text-[15px] font-semibold tracking-tight text-stone-900";
const fieldControlClass =
  "w-full rounded-[1.35rem] border border-stone-200/90 bg-white/95 px-4 py-3.5 text-[15px] text-stone-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(28,25,23,0.04)] outline-none transition duration-200 placeholder:text-stone-400 hover:border-stone-300 hover:bg-white focus:border-stone-400 focus:bg-stone-50/80 focus:shadow-[0_0_0_4px_rgba(214,228,211,0.45)]";
const fieldGroupClass = "text-sm text-stone-700";
const selectControlClass = `${fieldControlClass} appearance-none pr-12`;
const toggleChipBaseClass =
  "group inline-flex items-center gap-3 rounded-full border px-4 py-2.5 text-sm font-medium transition duration-200 hover:-translate-y-0.5";
const primaryButtonClass =
  "rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(28,25,23,0.14)] transition duration-200 hover:-translate-y-0.5 hover:bg-stone-800 hover:shadow-[0_16px_32px_rgba(28,25,23,0.2)] active:translate-y-0";
const secondaryButtonClass =
  "rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 shadow-[0_4px_12px_rgba(28,25,23,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-stone-400 hover:bg-stone-50 hover:shadow-[0_12px_24px_rgba(28,25,23,0.1)] active:translate-y-0";
const ghostButtonClass =
  "rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-[0_4px_12px_rgba(28,25,23,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-stone-400 hover:bg-stone-50 hover:shadow-[0_12px_24px_rgba(28,25,23,0.08)] active:translate-y-0";

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <label className={fieldGroupClass}>
      <span className={fieldLabelClass}>{label}</span>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={isOpen}
          onClick={() => {
            if (!disabled) setIsOpen((open) => !open);
          }}
          className={`${selectControlClass} text-left disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 disabled:hover:border-stone-200 ${isOpen ? "border-stone-400 bg-stone-50/80 shadow-[0_0_0_4px_rgba(214,228,211,0.45)]" : ""}`}
        >
          {selectedOption?.label ?? ""}
        </button>
        <span
          className={`pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone-400 transition duration-200 ${isOpen ? "rotate-180 text-stone-700" : ""}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </span>

        <div
          className={`absolute left-0 right-0 top-[calc(100%+0.55rem)] z-20 origin-top overflow-hidden rounded-[1.25rem] border border-stone-200 bg-white/98 p-1.5 shadow-[0_18px_50px_rgba(28,25,23,0.16)] backdrop-blur transition duration-200 ${
            isOpen
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
          }`}
        >
          <div className="max-h-64 overflow-y-auto py-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={`${label}-${option.value}`}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-[0.95rem] px-3.5 py-3 text-left text-[15px] transition duration-150 ${
                    isSelected
                      ? "bg-stone-950 text-white"
                      : "text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span>{option.label}</span>
                  <span
                    className={`text-xs ${
                      isSelected ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    선택됨
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </label>
  );
}

function ToggleChip({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`${toggleChipBaseClass} ${
        checked
          ? "border-stone-900 bg-stone-950 text-white shadow-[0_10px_24px_rgba(28,25,23,0.16)]"
          : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50"
      }`}
    >
      <span
        className={`relative h-5 w-9 rounded-full transition duration-200 ${
          checked ? "bg-white/30" : "bg-stone-200"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition duration-200 ${
            checked ? "left-[1.05rem]" : "left-0.5 bg-white"
          }`}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      {label}
    </label>
  );
}

function splitMultiValue(value: string) {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function filterMatches(
  matches: RuleMatch[],
  filters: {
    severity: string;
    pregnancyOnly: boolean;
    medicationOnly: boolean;
    diseaseOnly: boolean;
  },
) {
  return matches.filter((match) => {
    if (filters.severity && match.resolvedSeverity !== filters.severity) {
      return false;
    }
    if (
      filters.pregnancyOnly &&
      !match.rule.pregnancyFlag &&
      !match.rule.lactationFlag
    ) {
      return false;
    }
    if (filters.medicationOnly && match.rule.interactionDrugs.length === 0) {
      return false;
    }
    if (filters.diseaseOnly && match.rule.interactionDiseases.length === 0) {
      return false;
    }
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

    return right.rule.priority - left.rule.priority;
  });

  return sorted;
}

function getVisibleSections(
  response: EngineResponse | null,
  filters: {
    severity: string;
    pregnancyOnly: boolean;
    medicationOnly: boolean;
    diseaseOnly: boolean;
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

export function RuleExplorerClient({
  metadata,
}: {
  metadata: ExplorerMetadata;
}) {
  type SectionKey = keyof typeof sectionLabels;
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
  const [pregnancyOnly, setPregnancyOnly] = useState(false);
  const [medicationOnly, setMedicationOnly] = useState(false);
  const [diseaseOnly, setDiseaseOnly] = useState(false);
  const [sort, setSort] =
    useState<NonNullable<EngineQuery["sort"]>>("severity_desc");
  const [response, setResponse] = useState<EngineResponse | null>(null);
  const [hasQueried, setHasQueried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [sectionVisibleCounts, setSectionVisibleCounts] = useState<
    Record<SectionKey, number>
  >(() => ({ ...sectionPreviewCounts }));
  const [isPending, startTransition] = useTransition();

  const isMale = sex === "male";
  const visible = getVisibleSections(response, {
    severity: severityFilter,
    pregnancyOnly,
    medicationOnly,
    diseaseOnly,
    sort,
  });
  const visibleCount =
    (visible?.definitely_matched.length ?? 0) +
    (visible?.possibly_relevant.length ?? 0) +
    (visible?.needs_more_info.length ?? 0);

  function resetSectionPreviewCounts() {
    setSectionVisibleCounts({ ...sectionPreviewCounts });
  }

  function updateSeverityFilter(value: string) {
    setSeverityFilter(value);
    resetSectionPreviewCounts();
  }

  function updateMedicationOnly(value: boolean) {
    setMedicationOnly(value);
    resetSectionPreviewCounts();
  }

  function updateDiseaseOnly(value: boolean) {
    setDiseaseOnly(value);
    resetSectionPreviewCounts();
  }

  function updatePregnancyOnly(value: boolean) {
    setPregnancyOnly(value);
    resetSectionPreviewCounts();
  }

  function updateSort(value: NonNullable<EngineQuery["sort"]>) {
    setSort(value);
    resetSectionPreviewCounts();
  }

  async function submitQuery() {
    setHasQueried(true);
    setError(null);

    const result = await fetch("/api/rules/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      } satisfies EngineQuery),
    });

    if (!result.ok) {
      const payload = (await result.json()) as { error?: string };
      throw new Error(payload.error ?? "규칙을 불러오지 못했습니다.");
    }

    setResponse((await result.json()) as EngineResponse);
    resetSectionPreviewCounts();
  }

  function resetResultFilters() {
    setSeverityFilter("");
    setPregnancyOnly(false);
    setMedicationOnly(false);
    setDiseaseOnly(false);
    setSort("severity_desc");
    resetSectionPreviewCounts();
  }

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
    resetResultFilters();
    setResponse(null);
    setHasQueried(false);
    setError(null);
    resetSectionPreviewCounts();
  }

  const sectionOrder: Array<keyof NonNullable<typeof visible>> = [
    "definitely_matched",
    "possibly_relevant",
    "needs_more_info",
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-stone-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
          Profile
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 md:text-3xl">
          영양 안전 규칙 탐색기
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
          핵심 입력만 먼저 보이게 줄였습니다. 개인 조건이 없을 때의 일반 경고는
          과하게 앞세우지 않고 참고 항목으로 내려서 보여줍니다.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          출처 {metadata.meta.sourceCount}건 · 근거 {metadata.meta.evidenceChunkCount}
          건 · 규칙 {metadata.meta.safetyRuleCount}건
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <label className={fieldGroupClass}>
            <span className={fieldLabelClass}>선택 성분</span>
            <textarea value={selectedCompounds} onChange={(event) => setSelectedCompounds(event.target.value)} rows={2} placeholder="예: 비타민 D, 마그네슘" className={`${fieldControlClass} min-h-[7rem] resize-y`} />
          </label>
          <label className={fieldGroupClass}>
            <span className={fieldLabelClass}>복용 약물</span>
            <textarea value={medications} onChange={(event) => setMedications(event.target.value)} rows={2} placeholder="예: warfarin, levothyroxine" className={`${fieldControlClass} min-h-[7rem] resize-y`} />
          </label>
          <label className={fieldGroupClass}>
            <span className={fieldLabelClass}>질환 / 상태</span>
            <textarea value={conditions} onChange={(event) => setConditions(event.target.value)} rows={2} placeholder="예: diabetes, chronic liver disease" className={`${fieldControlClass} min-h-[7rem] resize-y`} />
          </label>
        </div>

        <section className="mt-5 overflow-hidden rounded-[1.6rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(248,247,244,0.92),rgba(244,241,234,0.85))] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen((value) => !value)}
            aria-expanded={isAdvancedOpen}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition duration-200 hover:bg-white/50"
          >
            <div>
              <p className="text-[15px] font-semibold text-stone-900">추가 조건</p>
              <p className="mt-1 text-sm text-stone-600">
                임신, 수유, 흡연, 알레르기 같은 보조 조건을 더 입력할 수 있습니다.
              </p>
            </div>
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 shadow-sm transition duration-300 ${
                isAdvancedOpen ? "rotate-180 bg-stone-950 text-white" : ""
              }`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 7.5 5 5 5-5" />
              </svg>
            </span>
          </button>

          <div
            className={`grid transition-all duration-300 ease-out ${
              isAdvancedOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="border-t border-stone-200/80 px-5 pb-5 pt-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className={fieldGroupClass}>
                    <span className={fieldLabelClass}>나이</span>
                    <input value={age} onChange={(event) => setAge(event.target.value)} type="number" inputMode="numeric" className={fieldControlClass} />
                  </label>

                  <SelectField
                    label="성별"
                    value={sex}
                    onChange={(nextSex) => {
                      setSex(nextSex);
                      if (nextSex === "male") {
                        setPregnancyStatus("");
                        setLactationStatus("");
                      }
                    }}
                    options={[
                      { value: "", label: "미입력" },
                      { value: "male", label: "남성" },
                      { value: "female", label: "여성" },
                    ]}
                  />

                  <SelectField
                    label="흡연 상태"
                    value={smokerStatus}
                    onChange={setSmokerStatus}
                    options={[
                      { value: "", label: "미입력" },
                      { value: "current", label: "현재 흡연" },
                      { value: "former", label: "과거 흡연" },
                      { value: "never", label: "비흡연" },
                    ]}
                  />

                  <SelectField
                    label="관할권"
                    value={jurisdiction}
                    onChange={setJurisdiction}
                    options={[
                      { value: "KR", label: "KR" },
                      ...metadata.jurisdictions
                        .filter((item) => item !== "KR")
                        .map((item) => ({ value: item, label: item })),
                    ]}
                  />

                  <SelectField
                    label="임신 상태"
                    value={pregnancyStatus}
                    onChange={setPregnancyStatus}
                    disabled={isMale}
                    options={[
                      {
                        value: "",
                        label: isMale ? "남성 선택 시 비활성" : "미입력",
                      },
                      { value: "pregnant", label: "임신 중" },
                      { value: "trying_to_conceive", label: "임신 준비 중" },
                      { value: "unknown_possible", label: "가능성 있음" },
                    ]}
                  />

                  <SelectField
                    label="수유 상태"
                    value={lactationStatus}
                    onChange={setLactationStatus}
                    disabled={isMale}
                    options={[
                      {
                        value: "",
                        label: isMale ? "남성 선택 시 비활성" : "미입력",
                      },
                      { value: "lactating", label: "수유 중" },
                    ]}
                  />

                  <label className={`${fieldGroupClass} xl:col-span-2`}>
                    <span className={fieldLabelClass}>알레르기</span>
                    <input value={allergies} onChange={(event) => setAllergies(event.target.value)} placeholder="예: shellfish" className={fieldControlClass} />
                  </label>

                  <label className={`${fieldGroupClass} md:col-span-2 xl:col-span-4`}>
                    <span className={fieldLabelClass}>메모</span>
                    <textarea value={memo} onChange={(event) => setMemo(event.target.value)} rows={2} placeholder="추가로 참고할 키워드가 있으면 적어둘 수 있습니다." className={`${fieldControlClass} min-h-[6.75rem] resize-y`} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 flex flex-col gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-600">약물/질환을 먼저 보고, 임신/수유는 추가 조건에서 보조적으로 확인할 수 있게 순서를 조정했습니다.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => startTransition(() => void submitQuery().catch((caught) => setError(caught instanceof Error ? caught.message : "규칙을 불러오지 못했습니다.")))} className={primaryButtonClass}>규칙 조회</button>
            <button type="button" onClick={resetForm} className={secondaryButtonClass}>초기화</button>
          </div>
        </div>
      </section>

      {response ? (
        <section className="rounded-[1.5rem] border border-stone-200 bg-white/85 p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-stone-900">결과 필터</h2>
              <p className="mt-1 text-xs text-stone-600">자주 쓰는 필터만 남겼습니다.</p>
            </div>
            <p className="text-xs text-stone-500">바로 확인 {visible?.definitely_matched.length ?? 0} · 참고 {visible?.possibly_relevant.length ?? 0} · 보완 필요 {visible?.needs_more_info.length ?? 0}</p>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-[10rem]">
              <SelectField
                label="위험도"
                value={severityFilter}
                onChange={updateSeverityFilter}
                options={[
                  { value: "", label: "전체" },
                  { value: "contraindicated", label: "금지" },
                  { value: "avoid", label: "중단/회피" },
                  { value: "warn", label: "강한 주의" },
                  { value: "monitor", label: "일반 주의" },
                ]}
              />
            </div>
            <div className="min-w-[12rem]">
              <SelectField
                label="정렬"
                value={sort}
                onChange={(value) =>
                  updateSort(value as NonNullable<EngineQuery["sort"]>)
                }
                options={metadata.sortOptions}
              />
            </div>
            <ToggleChip
              checked={medicationOnly}
              onChange={updateMedicationOnly}
              label="약물 관련만"
            />
            <ToggleChip
              checked={diseaseOnly}
              onChange={updateDiseaseOnly}
              label="질환 관련만"
            />
            <ToggleChip
              checked={pregnancyOnly}
              onChange={updatePregnancyOnly}
              label="임신/수유만"
            />
            <button type="button" onClick={resetResultFilters} className={ghostButtonClass}>필터 초기화</button>
          </div>
        </section>
      ) : null}

      {isPending ? <div aria-live="polite" className="rounded-[1.5rem] border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">규칙을 불러오는 중입니다...</div> : null}
      {error ? <div aria-live="polite" className="rounded-[1.5rem] border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      {visible ? (
        visibleCount > 0 ? (
          sectionOrder.map((sectionKey) => {
            const sectionItems = visible[sectionKey];
            if (sectionItems.length === 0) return null;
            const previewCount = sectionVisibleCounts[sectionKey];
            const visibleItems = sectionItems.slice(0, previewCount);
            const hiddenCount = Math.max(sectionItems.length - previewCount, 0);
            const initialPreviewCount = sectionPreviewCounts[sectionKey];
            const canCollapse = previewCount > initialPreviewCount;

            return (
              <section key={sectionKey} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-stone-950">{sectionLabels[sectionKey]}</h2>
                    <p className="mt-1 text-sm text-stone-600">{sectionDescriptions[sectionKey]}</p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">{sectionItems.length}건</span>
                </div>

                {sectionItems.length > initialPreviewCount ? (
                  <div className="flex flex-col gap-2 rounded-[1.2rem] border border-stone-200 bg-white/70 px-4 py-3 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      {sectionKey === "needs_more_info"
                        ? `먼저 상위 ${visibleItems.length}건만 보여줍니다. 꼭 필요한 보완 항목부터 확인하세요.`
                        : `먼저 상위 ${visibleItems.length}건만 보여줍니다.`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {hiddenCount > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSectionVisibleCounts((current) => ({
                              ...current,
                              [sectionKey]: Math.min(
                                current[sectionKey] + sectionLoadMoreStep[sectionKey],
                                sectionItems.length,
                              ),
                            }))
                          }
                          className={ghostButtonClass}
                        >
                          {sectionKey === "needs_more_info"
                            ? `${Math.min(sectionLoadMoreStep[sectionKey], hiddenCount)}건 더 보기`
                            : `${hiddenCount}건 더 보기`}
                        </button>
                      ) : null}
                      {canCollapse ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSectionVisibleCounts((current) => ({
                              ...current,
                              [sectionKey]: initialPreviewCount,
                            }))
                          }
                          className={ghostButtonClass}
                        >
                          다시 접기
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  {visibleItems.map((match) => (
                    <RuleCard key={`${sectionKey}-${match.ruleId}`} match={match} />
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <section className="rounded-[1.5rem] border border-dashed border-stone-300 bg-white/70 p-6">
            <h3 className="text-base font-semibold text-stone-950">현재 필터 조건에 맞는 결과가 없습니다.</h3>
            <p className="mt-2 text-sm leading-6 text-stone-700">필터를 조금만 풀어보면 다시 결과를 볼 수 있습니다.</p>
          </section>
        )
      ) : !isPending ? (
        <section className="rounded-[1.5rem] border border-dashed border-stone-300 bg-white/70 p-6">
          <h3 className="text-base font-semibold text-stone-950">{hasQueried ? "조회 결과가 없습니다." : "조회 전 안내"}</h3>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {hasQueried
              ? "조건을 조금 바꾸거나, 약물/질환 정보를 더 넣어 다시 확인해 보세요."
              : "성분만 먼저 넣고 조회해도 되지만, 개인 조건이 없으면 일반 경고는 참고 수준으로 보여줍니다."}
          </p>
        </section>
      ) : null}
    </div>
  );
}
