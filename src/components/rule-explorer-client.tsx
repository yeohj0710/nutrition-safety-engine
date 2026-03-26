"use client";

import { useEffect, useState, useTransition } from "react";

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
  ingredients: Array<{
    id: string;
    label: string;
    aliases: string[];
    category: string | null;
  }>;
  medicationOptions: Array<{
    label: string;
    canonicalValue?: string;
    aliases: string[];
  }>;
  conditionOptions: Array<{
    label: string;
    aliases: string[];
  }>;
  jurisdictions: string[];
  sortOptions: Array<{ value: string; label: string }>;
};

type ExplorerValueOption = {
  label: string;
  canonicalValue?: string;
  aliases?: string[];
};

function getExplorerSearchTerms(option: ExplorerValueOption) {
  return [option.label, option.canonicalValue ?? option.label, ...(option.aliases ?? [])];
}

const sectionLabels = {
  definitely_matched: "먼저 살펴볼 내용",
  possibly_relevant: "함께 참고할 내용",
  needs_more_info: "몇 가지 더 확인해 주세요",
} as const;

const sectionDescriptions = {
  definitely_matched: "입력하신 조건과 직접 관련 있는 안내를 먼저 모아 보여드려요.",
  possibly_relevant: "당장 단정하긴 어렵지만 함께 알아두시면 좋은 내용이에요.",
  needs_more_info: "용량이나 상태 정보를 조금 더 알면 더 정확하게 안내해 드릴 수 있어요.",
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
  "mb-2 block text-sm font-semibold tracking-[-0.01em] text-stone-950";
const fieldControlClass =
  "w-full rounded-[1rem] border border-stone-200 bg-white px-4 py-3 text-[15px] leading-6 text-stone-900 outline-none transition duration-150 placeholder:text-stone-400 focus:border-stone-400 focus:shadow-[0_0_0_3px_rgba(226,232,240,0.9)]";
const fieldGroupClass = "text-sm text-stone-700";
const selectControlClass = `${fieldControlClass} appearance-none pr-12`;
const toggleChipBaseClass =
  "group inline-flex min-h-10 items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium transition duration-150";
const primaryButtonClass =
  "whitespace-nowrap rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition duration-150 hover:bg-stone-800";
const secondaryButtonClass =
  "whitespace-nowrap rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition duration-150 hover:border-stone-300 hover:bg-stone-50";
const ghostButtonClass =
  "rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition duration-150 hover:border-stone-300 hover:bg-stone-50";
const subtleActionButtonClass =
  "rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition duration-150 hover:border-stone-300 hover:text-stone-900";
const explorerStorageKey = "nutrition-safety-explorer-state-v1";

type PersistedExplorerState = {
  version: 1;
  form: {
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
    memo: string;
  };
  filters: {
    severityFilter: string;
    pregnancyOnly: boolean;
    medicationOnly: boolean;
    diseaseOnly: boolean;
    sort: NonNullable<EngineQuery["sort"]>;
  };
  ui: {
    isAdvancedOpen: boolean;
    sectionVisibleCounts: Record<
      keyof typeof sectionPreviewCounts,
      number
    >;
  };
  query: {
    hasQueried: boolean;
    response: EngineResponse | null;
  };
};

function normalizeExplorerInput(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\-\/()]+/g, " ")
    .replace(/[^a-z0-9가-힣\s]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeExplorerLookupKey(value: string) {
  return normalizeExplorerInput(value).replace(/\s+/g, "");
}

function normalizeExplorerTokens(value: string) {
  return normalizeExplorerInput(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function matchesExplorerSearchTerm(query: string, candidate: string) {
  const queryKey = normalizeExplorerLookupKey(query);
  const candidateKey = normalizeExplorerLookupKey(candidate);

  if (!queryKey || !candidateKey) {
    return { exact: false, startsWith: false, includes: false };
  }

  if (candidateKey === queryKey) {
    return { exact: true, startsWith: true, includes: true };
  }

  if (candidateKey.startsWith(queryKey)) {
    return { exact: false, startsWith: true, includes: true };
  }

  const queryTokens = normalizeExplorerTokens(query);
  const candidateTokens = normalizeExplorerTokens(candidate);
  const tokenPrefixMatch =
    queryTokens.length > 0 &&
    candidateTokens.length > 0 &&
    queryTokens.every((queryToken) =>
      candidateTokens.some((candidateToken) =>
        candidateToken.startsWith(queryToken),
      ),
    );

  if (tokenPrefixMatch) {
    return { exact: false, startsWith: true, includes: true };
  }

  return {
    exact: false,
    startsWith: false,
    includes: candidateKey.includes(queryKey),
  };
}

function resolveExplorerOption(
  value: string,
  options: ExplorerValueOption[],
) {
  const queryKey = normalizeExplorerLookupKey(value);
  if (!queryKey) return null;

  const exactMatch =
    options.find((option) =>
      getExplorerSearchTerms(option).some(
        (candidate) => matchesExplorerSearchTerm(value, candidate).exact,
      ),
    ) ?? null;

  if (exactMatch) {
    return exactMatch;
  }

  const prefixMatches = options.filter((option) =>
    getExplorerSearchTerms(option).some((candidate) =>
      matchesExplorerSearchTerm(value, candidate).startsWith,
    ),
  );

  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

function buildCanonicalEntries(
  value: string,
  options: ExplorerValueOption[],
) {
  const seen = new Set<string>();
  const entries: string[] = [];

  for (const token of splitMultiValue(value)) {
    const resolved = resolveExplorerOption(token, options);
    const canonical = resolved?.canonicalValue ?? resolved?.label ?? token.trim();
    const key = normalizeExplorerLookupKey(canonical);

    if (!key || seen.has(key)) continue;
    seen.add(key);
    entries.push(canonical);
  }

  return entries;
}

function analyzeExplorerField(
  value: string,
  options: ExplorerValueOption[],
) {
  const recognized: string[] = [];
  const unresolved: string[] = [];
  const seenRecognized = new Set<string>();
  const seenUnresolved = new Set<string>();

  for (const token of splitMultiValue(value)) {
    const resolved = resolveExplorerOption(token, options);

    if (resolved) {
      const key = normalizeExplorerLookupKey(resolved.label);
      if (!seenRecognized.has(key)) {
        seenRecognized.add(key);
        recognized.push(resolved.label);
      }
      continue;
    }

    const trimmed = token.trim();
    const key = normalizeExplorerLookupKey(trimmed);
    if (key && !seenUnresolved.has(key)) {
      seenUnresolved.add(key);
      unresolved.push(trimmed);
    }
  }

  const currentToken = /[,\n;]\s*$/.test(value)
    ? ""
    : value.split(/[\n,;]+/).at(-1)?.trim() ?? "";
  const currentTokenKey = normalizeExplorerLookupKey(currentToken);

  const suggestions =
    currentTokenKey.length > 0
      ? options
          .map((option) => {
            const searchMatches = getExplorerSearchTerms(option).map((candidate) =>
              matchesExplorerSearchTerm(currentToken, candidate),
            );
            const startsWith = searchMatches.some((candidate) => candidate.startsWith);
            const includes = startsWith
              ? true
              : searchMatches.some((candidate) => candidate.includes);

            return {
              option,
              startsWith,
              includes,
            };
          })
          .filter((entry) => entry.includes)
          .filter(
            (entry) =>
              !recognized.some(
                (candidate) =>
                  normalizeExplorerLookupKey(candidate) ===
                  normalizeExplorerLookupKey(entry.option.label),
              ),
          )
          .sort((left, right) => {
            if (left.startsWith !== right.startsWith) {
              return left.startsWith ? -1 : 1;
            }

            return left.option.label.localeCompare(right.option.label, "ko");
          })
          .map((entry) => entry.option)
          .slice(0, 5)
      : [];

  return {
    recognized,
    unresolved,
    suggestions,
  };
}

function applySuggestionToField(currentValue: string, suggestion: string) {
  const lastDelimiterIndex = Math.max(
    currentValue.lastIndexOf(","),
    currentValue.lastIndexOf("\n"),
    currentValue.lastIndexOf(";"),
  );

  const prefix =
    lastDelimiterIndex >= 0
      ? currentValue.slice(0, lastDelimiterIndex + 1).trimEnd()
      : "";

  if (!prefix) {
    return `${suggestion}, `;
  }

  return `${prefix} ${suggestion}, `;
}

function FieldRecognitionAssist({
  recognized,
  unresolved,
  suggestions,
  onSelectSuggestion,
}: {
  recognized: string[];
  unresolved: string[];
  suggestions: ExplorerValueOption[];
  onSelectSuggestion: (label: string) => void;
}) {
  if (
    recognized.length === 0 &&
    unresolved.length === 0 &&
    suggestions.length === 0
  ) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2.5">
      {recognized.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-stone-500">
            자동 인식됨
          </span>
          {recognized.map((item) => (
            <span
              key={`recognized-${item}`}
              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {unresolved.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-stone-500">
            확인 필요
          </span>
          {unresolved.map((item) => (
            <span
              key={`unresolved-${item}`}
              className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-stone-500">
            추천 선택
          </span>
          {suggestions.map((option) => (
            <button
              key={`suggestion-${option.label}`}
              type="button"
              onClick={() => onSelectSuggestion(option.label)}
              className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 transition duration-200 hover:-translate-y-0.5 hover:border-stone-400 hover:bg-stone-50"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

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
  return (
    <label className={fieldGroupClass}>
      <span className={fieldLabelClass}>{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={`${selectControlClass} disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 disabled:hover:border-stone-200`}
        >
          {options.map((option) => (
            <option key={`${label}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone-400"
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
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isMale = sex === "male";
  const visible = getVisibleSections(response, {
    severity: severityFilter,
    pregnancyOnly,
    medicationOnly,
    diseaseOnly,
    sort,
  });
  const compoundFieldAnalysis = analyzeExplorerField(
    selectedCompounds,
    metadata.ingredients,
  );
  const medicationFieldAnalysis = analyzeExplorerField(
    medications,
    metadata.medicationOptions,
  );
  const conditionFieldAnalysis = analyzeExplorerField(
    conditions,
    metadata.conditionOptions,
  );
  const visibleCount =
    (visible?.definitely_matched.length ?? 0) +
    (visible?.possibly_relevant.length ?? 0) +
    (visible?.needs_more_info.length ?? 0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(explorerStorageKey);
      if (!raw) {
        setHasRestoredState(true);
        return;
      }

      const snapshot = JSON.parse(raw) as PersistedExplorerState;
      if (snapshot.version !== 1) {
        setHasRestoredState(true);
        return;
      }

      setAge(snapshot.form.age ?? "");
      setSex(snapshot.form.sex ?? "");
      setPregnancyStatus(snapshot.form.pregnancyStatus ?? "");
      setLactationStatus(snapshot.form.lactationStatus ?? "");
      setSmokerStatus(snapshot.form.smokerStatus ?? "");
      setMedications(snapshot.form.medications ?? "");
      setConditions(snapshot.form.conditions ?? "");
      setAllergies(snapshot.form.allergies ?? "");
      setSelectedCompounds(snapshot.form.selectedCompounds ?? "");
      setJurisdiction(snapshot.form.jurisdiction ?? "KR");
      setMemo(snapshot.form.memo ?? "");

      setSeverityFilter(snapshot.filters.severityFilter ?? "");
      setPregnancyOnly(snapshot.filters.pregnancyOnly ?? false);
      setMedicationOnly(snapshot.filters.medicationOnly ?? false);
      setDiseaseOnly(snapshot.filters.diseaseOnly ?? false);
      setSort(snapshot.filters.sort ?? "severity_desc");

      setIsAdvancedOpen(snapshot.ui.isAdvancedOpen ?? false);
      setSectionVisibleCounts(
        snapshot.ui.sectionVisibleCounts ?? { ...sectionPreviewCounts },
      );

      setHasQueried(snapshot.query.hasQueried ?? false);
      setResponse(snapshot.query.response ?? null);
      setError(null);
    } catch {
      window.localStorage.removeItem(explorerStorageKey);
    } finally {
      setHasRestoredState(true);
    }
  }, []);

  useEffect(() => {
    if (!hasRestoredState) {
      return;
    }

    const snapshot: PersistedExplorerState = {
      version: 1,
      form: {
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
        memo,
      },
      filters: {
        severityFilter,
        pregnancyOnly,
        medicationOnly,
        diseaseOnly,
        sort,
      },
      ui: {
        isAdvancedOpen,
        sectionVisibleCounts,
      },
      query: {
        hasQueried,
        response,
      },
    };

    window.localStorage.setItem(explorerStorageKey, JSON.stringify(snapshot));
  }, [
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
    memo,
    severityFilter,
    pregnancyOnly,
    medicationOnly,
    diseaseOnly,
    sort,
    isAdvancedOpen,
    sectionVisibleCounts,
    hasQueried,
    response,
    hasRestoredState,
  ]);

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
          medications: buildCanonicalEntries(
            medications,
            metadata.medicationOptions,
          ),
          conditions: buildCanonicalEntries(
            conditions,
            metadata.conditionOptions,
          ),
          allergies: splitMultiValue(allergies),
          selectedCompounds: buildCanonicalEntries(
            selectedCompounds,
            metadata.ingredients,
          ),
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
    window.localStorage.removeItem(explorerStorageKey);
  }

  function resetInputsOnly() {
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
    setIsAdvancedOpen(false);
    setError(null);
  }

  function applyStarterProfile(profile: {
    selectedCompounds: string;
    medications?: string;
    conditions?: string;
    age?: string;
    sex?: string;
    pregnancyStatus?: string;
    lactationStatus?: string;
    smokerStatus?: string;
  }) {
    setSelectedCompounds(profile.selectedCompounds);
    setMedications(profile.medications ?? "");
    setConditions(profile.conditions ?? "");
    setAge(profile.age ?? "");
    setSex(profile.sex ?? "");
    setPregnancyStatus(profile.pregnancyStatus ?? "");
    setLactationStatus(profile.lactationStatus ?? "");
    setSmokerStatus(profile.smokerStatus ?? "");
    setAllergies("");
    setMemo("");
    setError(null);
    setResponse(null);
    setHasQueried(false);
    setIsAdvancedOpen(
      Boolean(
        profile.age ||
          profile.sex ||
          profile.pregnancyStatus ||
          profile.lactationStatus ||
          profile.smokerStatus,
      ),
    );
    resetSectionPreviewCounts();
  }

  const sectionOrder: Array<keyof NonNullable<typeof visible>> = [
    "definitely_matched",
    "possibly_relevant",
    "needs_more_info",
  ];

  const quickIngredientSuggestions = metadata.ingredients.slice(0, 4);
  const quickMedicationSuggestions = metadata.medicationOptions.slice(0, 3);
  const highlightedCounts = [
    {
      label: "출처",
      value: metadata.meta.sourceCount,
      tone: "from-emerald-100/90 to-white",
    },
    {
      label: "근거 청크",
      value: metadata.meta.evidenceChunkCount,
      tone: "from-amber-100/80 to-white",
    },
    {
      label: "규칙",
      value: metadata.meta.safetyRuleCount,
      tone: "from-stone-200/80 to-white",
    },
  ] as const;
  const resultOverview = [
    {
      key: "definitely_matched",
      label: sectionLabels.definitely_matched,
      description: sectionDescriptions.definitely_matched,
      count: visible?.definitely_matched.length ?? 0,
      tone: "border-stone-200 bg-white",
    },
    {
      key: "possibly_relevant",
      label: sectionLabels.possibly_relevant,
      description: sectionDescriptions.possibly_relevant,
      count: visible?.possibly_relevant.length ?? 0,
      tone: "border-stone-200 bg-white",
    },
    {
      key: "needs_more_info",
      label: sectionLabels.needs_more_info,
      description: sectionDescriptions.needs_more_info,
      count: visible?.needs_more_info.length ?? 0,
      tone: "border-amber-200 bg-amber-50/60",
    },
  ] as const;
  const sectionPresentation = {
    definitely_matched: {
      kicker: "먼저 보기",
      title: "가장 먼저 확인할 내용",
      summary:
        "현재 입력과 직접 연결된 판단입니다. 이 섹션만 먼저 읽어도 핵심을 빠르게 파악할 수 있습니다.",
      railTone: "surface-card bg-white",
      chipTone: "bg-stone-100 text-foreground border border-stone-200",
    },
    possibly_relevant: {
      kicker: "참고",
      title: "같이 보면 좋은 내용",
      summary:
        "지금 바로 위험 판정은 아니지만, 맥락을 이해하는 데 도움이 되는 정보입니다.",
      railTone: "surface-card bg-white",
      chipTone: "bg-white text-muted border border-stone-200",
    },
    needs_more_info: {
      kicker: "추가 입력",
      title: "조금 더 입력하면 정확해집니다",
      summary:
        "용량, 상태, 기간 같은 정보가 부족해 판단을 보수적으로 잡은 항목입니다.",
      railTone: "surface-card bg-amber-50/45",
      chipTone: "border border-amber-200 bg-amber-50 text-amber-900",
    },
  } as const;
  const hasAnyPrimaryInput = Boolean(
    selectedCompounds.trim() || medications.trim() || conditions.trim(),
  );
  const starterProfiles: Array<{
    label: string;
    description: string;
    selectedCompounds: string;
    medications?: string;
    conditions?: string;
    age?: string;
    sex?: string;
    pregnancyStatus?: string;
    lactationStatus?: string;
    smokerStatus?: string;
  }> = [
    {
      label: "임신 중 비타민 A",
      description: "임신 관련 위험도를 빠르게 보는 예시",
      selectedCompounds: "비타민 A",
      age: "32",
      sex: "female",
      pregnancyStatus: "pregnant",
    },
    {
      label: "와파린 + 비타민 K",
      description: "약물 상호작용 확인용 조합",
      selectedCompounds: "비타민 K",
      medications: "warfarin",
      age: "68",
      sex: "male",
    },
    {
      label: "퀴놀론 + 마그네슘",
      description: "복용 간격 규칙을 보는 예시",
      selectedCompounds: "magnesium",
      medications: "quinolone antibiotic",
      age: "47",
      sex: "male",
    },
  ] as const;

  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_19rem]">
        <div className="surface-card overflow-hidden rounded-[1.5rem]">
          <div className="border-b border-border-subtle px-6 py-5 md:px-7">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">입력</p>
                <h2 className="mt-2 text-[clamp(1.5rem,2.8vw,2rem)] font-semibold tracking-[-0.03em] text-foreground">
                  필요한 정보만 입력하세요
                </h2>
                <p className="measure-copy mt-2 text-sm leading-6 text-muted">
                  성분만으로도 시작할 수 있고, 약물이나 상태를 추가하면 결과가 더 정확해집니다.
                </p>
              </div>

              <button
                type="button"
                onClick={resetInputsOnly}
                className={subtleActionButtonClass}
              >
                입력만 초기화
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {highlightedCounts.map((item) => (
                <div key={item.label} className="rounded-[1rem] border border-stone-200 bg-white px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold leading-none text-foreground tabular-nums">
                    {item.value.toLocaleString("ko-KR")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 py-6 md:px-7">
            <div className="grid gap-4 xl:grid-cols-3">
              <label className={`${fieldGroupClass} rounded-[1rem] border border-stone-200 bg-white p-4`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className={fieldLabelClass}>1. 선택 성분</span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600">
                    필수
                  </span>
                </div>
                <textarea value={selectedCompounds} onChange={(event) => setSelectedCompounds(event.target.value)} rows={3} placeholder="예: 비타민 D, vitamin d, vit d, 비타민D" className={`${fieldControlClass} min-h-[8rem] resize-y`} />
                <p className="mt-3 text-xs leading-5 text-muted">
                  한글, 영문, 축약 표현을 최대한 같은 성분으로 맞춰 인식합니다.
                </p>
                <FieldRecognitionAssist
                  recognized={compoundFieldAnalysis.recognized}
                  unresolved={compoundFieldAnalysis.unresolved}
                  suggestions={compoundFieldAnalysis.suggestions}
                  onSelectSuggestion={(suggestion) =>
                    setSelectedCompounds((current) =>
                      applySuggestionToField(current, suggestion),
                    )
                  }
                />
              </label>

              <label className={`${fieldGroupClass} rounded-[1rem] border border-stone-200 bg-white p-4`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className={fieldLabelClass}>2. 복용 약물</span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600">
                    정확도 상승
                  </span>
                </div>
                <textarea value={medications} onChange={(event) => setMedications(event.target.value)} rows={3} placeholder="예: 와파린, warfarin, 레보티록신, 피임약" className={`${fieldControlClass} min-h-[8rem] resize-y`} />
                <p className="mt-3 text-xs leading-5 text-muted">
                  같은 약물은 한글과 영문 별칭을 이어 하나의 입력으로 처리합니다.
                </p>
                <FieldRecognitionAssist
                  recognized={medicationFieldAnalysis.recognized}
                  unresolved={medicationFieldAnalysis.unresolved}
                  suggestions={medicationFieldAnalysis.suggestions}
                  onSelectSuggestion={(suggestion) =>
                    setMedications((current) =>
                      applySuggestionToField(current, suggestion),
                    )
                  }
                />
              </label>

              <label className={`${fieldGroupClass} rounded-[1rem] border border-stone-200 bg-white p-4`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className={fieldLabelClass}>3. 질환 · 상태</span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600">
                    선택
                  </span>
                </div>
                <textarea value={conditions} onChange={(event) => setConditions(event.target.value)} rows={3} placeholder="예: 당뇨병, diabetes, 간질환, chronic liver disease" className={`${fieldControlClass} min-h-[8rem] resize-y`} />
                <p className="mt-3 text-xs leading-5 text-muted">
                  질환과 상태도 같은 맥락으로 이어 판단할 수 있도록 정리합니다.
                </p>
                <FieldRecognitionAssist
                  recognized={conditionFieldAnalysis.recognized}
                  unresolved={conditionFieldAnalysis.unresolved}
                  suggestions={conditionFieldAnalysis.suggestions}
                  onSelectSuggestion={(suggestion) =>
                    setConditions((current) =>
                      applySuggestionToField(current, suggestion),
                    )
                  }
                />
              </label>
            </div>

            <section className="mt-5 overflow-hidden rounded-[1rem] border border-stone-200 bg-stone-50/70">
              <button
                type="button"
                onClick={() => setIsAdvancedOpen((value) => !value)}
                aria-expanded={isAdvancedOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition duration-200 hover:bg-white/40"
              >
                <div>
                  <p className="text-[15px] font-semibold text-stone-900">
                    추가 정보 입력
                  </p>
                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    꼭 필요할 때만 더 열어 입력할 수 있습니다.
                  </p>
                </div>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white shadow-sm transition duration-300 ${
                    isAdvancedOpen ? "border-stone-300 bg-stone-50" : ""
                  }`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className={`h-4 w-4 text-stone-700 transition duration-300 ${
                      isAdvancedOpen ? "rotate-180" : ""
                    }`}
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
                  isAdvancedOpen
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
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
                        <textarea value={memo} onChange={(event) => setMemo(event.target.value)} rows={2} placeholder="추가로 참고할 복용 방식, 생활 습관, 키워드를 적어둘 수 있습니다." className={`${fieldControlClass} min-h-[6.75rem] resize-y`} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-5 flex flex-col gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-muted">
                {hasAnyPrimaryInput
                  ? "직접 관련된 규칙을 먼저 정리하고, 일반 참고 항목은 뒤에서 보조적으로 이어 보여드립니다."
                  : "성분 하나만 먼저 넣고 시작해도 됩니다. 필요한 순간에만 추가 조건을 더해 보세요."}
              </p>
              <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                <button type="button" onClick={() => startTransition(() => void submitQuery().catch((caught) => setError(caught instanceof Error ? caught.message : "규칙을 불러오지 못했습니다.")))} className={primaryButtonClass}>규칙 조회</button>
                <button type="button" onClick={resetForm} className={secondaryButtonClass}>전체 초기화</button>
              </div>
            </div>
          </div>
        </div>

        <aside className="surface-card rounded-[1.5rem] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">가이드</p>
          <h3 className="mt-2 text-lg font-semibold leading-tight text-foreground">
            먼저 이것만 기억하면 됩니다
          </h3>
          <div className="mt-5 space-y-3">
            <div className="rounded-[1rem] bg-white px-4 py-4">
              <p className="text-sm font-semibold text-foreground">성분 하나부터 시작</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                개인 조건이 비어 있으면 일반 참고 안내 중심으로 먼저 보여드립니다.
              </p>
            </div>
            <div className="rounded-[1rem] bg-white px-4 py-4">
              <p className="text-sm font-semibold text-foreground">약물·질환 추가</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                직접 관련된 규칙을 앞쪽에 끌어올리려면 함께 입력해 주세요.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              빠른 입력
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickIngredientSuggestions.map((item) => (
                <button
                  key={`quick-ingredient-${item.id}`}
                  type="button"
                  onClick={() =>
                    setSelectedCompounds((current) =>
                      applySuggestionToField(current, item.label),
                    )
                  }
                  className="rounded-full border border-border-subtle bg-white px-3 py-1.5 text-xs font-medium text-foreground transition duration-200 hover:-translate-y-0.5 hover:border-stone-300"
                >
                  {item.label}
                </button>
              ))}
              {quickMedicationSuggestions.map((item) => (
                <button
                  key={`quick-medication-${item.label}`}
                  type="button"
                  onClick={() =>
                    setMedications((current) =>
                      applySuggestionToField(current, item.label),
                    )
                  }
                  className="rounded-full border border-border-subtle bg-accent-soft/70 px-3 py-1.5 text-xs font-medium text-accent-strong transition duration-200 hover:-translate-y-0.5 hover:border-accent/40"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[1rem] border border-stone-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold text-foreground">
              마지막 조회는 브라우저에 잠시 저장됩니다
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              입력값과 마지막 결과만 이어서 볼 수 있게 저장하며, 새로고침 후에도
              흐름이 끊기지 않도록 돕습니다.
            </p>
          </div>
        </aside>
      </section>

      {response ? (
        <section className="surface-card rounded-[1.5rem] p-5 md:p-6">
          <div className="flex flex-col gap-3 border-b border-border-subtle pb-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">결과</p>
              <h2 className="mt-2 text-[clamp(1.35rem,2.2vw,1.75rem)] font-semibold tracking-[-0.03em] text-foreground">
                중요한 내용부터 바로 확인하세요
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                먼저 봐야 할 내용과 추가 확인이 필요한 내용을 분리해 보여드립니다.
              </p>
            </div>
            <p className="text-sm font-medium text-muted">
              총 <span className="font-semibold text-foreground tabular-nums">{visibleCount}</span>건
            </p>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <div className="grid gap-3 lg:grid-cols-3">
              {resultOverview.map((item) => (
                <div key={item.key} className={`rounded-[1rem] border px-4 py-4 ${item.tone}`}>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
                    {item.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold leading-none text-foreground tabular-nums">
                    {item.count}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-[1rem] border border-stone-200 bg-white p-4">
              <p className="text-sm font-semibold text-foreground">결과 보기 설정</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                위험도와 정렬, 관련 조건 필터를 조합해 원하는 범위만 남겨보세요.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

                <SelectField
                  label="정렬"
                  value={sort}
                  onChange={(value) =>
                    updateSort(value as NonNullable<EngineQuery["sort"]>)
                  }
                  options={metadata.sortOptions}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
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
              </div>

              <div className="mt-4">
                <button type="button" onClick={resetResultFilters} className={ghostButtonClass}>필터 초기화</button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isPending ? (
        <div aria-live="polite" className="surface-card rounded-[1.8rem] px-5 py-6">
          <p className="text-sm font-semibold text-foreground">
            입력하신 조건에 맞는 안내를 정리하고 있어요.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            직접 관련된 항목을 먼저 분류하고, 함께 참고할 근거를 이어 묶고 있습니다.
          </p>
        </div>
      ) : null}
      {error ? (
        <div aria-live="polite" className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {visible ? (
        visibleCount > 0 ? (
          sectionOrder.map((sectionKey, index) => {
            const sectionItems = visible[sectionKey];
            if (sectionItems.length === 0) return null;
            const previewCount = sectionVisibleCounts[sectionKey];
            const visibleItems = sectionItems.slice(0, previewCount);
            const hiddenCount = Math.max(sectionItems.length - previewCount, 0);
            const initialPreviewCount = sectionPreviewCounts[sectionKey];
            const canCollapse = previewCount > initialPreviewCount;
            const presentation = sectionPresentation[sectionKey];
            const revealCountLabel =
              sectionKey === "needs_more_info"
                ? `${Math.min(sectionLoadMoreStep[sectionKey], hiddenCount)}건 더 보기`
                : `${hiddenCount}건 더 보기`;

            return (
              <section
                key={sectionKey}
                className="surface-card rounded-[1.5rem] p-5 motion-safe:animate-[rise-in_620ms_var(--ease-emphasized)_both]"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      {presentation.kicker}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-foreground">
                      {presentation.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {presentation.summary}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${presentation.chipTone}`}>
                      {sectionItems.length}건
                    </span>
                    <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-muted">
                      {sectionLabels[sectionKey]}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {visibleItems.map((match, matchIndex) => (
                    <div
                      key={`${sectionKey}-${match.ruleId}`}
                      className="motion-safe:animate-[rise-in_540ms_var(--ease-emphasized)_both]"
                      style={{ animationDelay: `${index * 90 + matchIndex * 45}ms` }}
                    >
                      <RuleCard match={match} />
                    </div>
                  ))}

                  {sectionItems.length > initialPreviewCount ? (
                    <div className="rounded-[1rem] border border-stone-200 bg-white px-4 py-4 md:px-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <p className="text-sm leading-6 text-muted">
                          {hiddenCount > 0
                            ? `아직 ${hiddenCount}건이 더 남아 있습니다. 필요한 범위까지만 펼쳐서 검토해 보세요.`
                            : "지금은 모든 항목을 펼쳐둔 상태입니다. 다시 접어서 핵심 순서만 볼 수도 있습니다."}
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
                              {revealCountLabel}
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
                              className={secondaryButtonClass}
                            >
                              다시 핵심만 보기
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })
        ) : (
          <section className="surface-card rounded-[1.5rem] px-6 py-6 md:px-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">필터 결과 없음</p>
            <h3 className="mt-3 text-[clamp(1.35rem,2.2vw,1.75rem)] font-semibold tracking-[-0.03em] text-foreground">
              지금 적용된 필터 안에서는 보이는 항목이 없어요.
            </h3>
            <p className="measure-copy mt-3 text-sm leading-6 text-muted">
              위험도나 관련 조건 필터가 좁게 걸려 있을 가능성이 큽니다. 필터를 조금만
              느슨하게 바꾸면 같은 결과 안에서도 다른 판단 근거를 바로 확인할 수 있어요.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={resetResultFilters} className={primaryButtonClass}>
                필터 전체 초기화
              </button>
            </div>
          </section>
        )
      ) : !isPending ? (
        <section className="surface-card rounded-[1.5rem] px-6 py-6 md:px-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {hasQueried ? "결과 없음" : "입력 전"}
          </p>
          <h3 className="mt-3 text-[clamp(1.35rem,2.2vw,1.75rem)] font-semibold tracking-[-0.03em] text-foreground">
            {hasQueried ? "현재 조건으로는 연결된 결과를 찾지 못했어요." : "첫 입력은 아주 간단해도 괜찮아요."}
          </h3>
          <p className="measure-copy mt-3 text-sm leading-6 text-muted">
            {hasQueried
              ? "성분 표기나 약물 이름을 조금 다르게 적어 보거나, 질환과 임신·수유 상태 같은 조건을 추가하면 더 정확하게 다시 좁혀볼 수 있습니다."
              : "성분만 먼저 넣고 시작해도 됩니다. 개인 조건이 아직 없으면 일반적인 참고 안내를 중심으로 차분하게 보여드립니다."}
          </p>
          {!hasQueried ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {starterProfiles.map((profile) => (
                <button
                  key={`empty-starter-${profile.label}`}
                  type="button"
                  onClick={() => applyStarterProfile(profile)}
                  className={ghostButtonClass}
                >
                  {profile.label}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
