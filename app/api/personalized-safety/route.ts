import { NextResponse } from "next/server";
import rules from "@/research/systematic_review_v40/personalized_rules.json";
import evidenceManifest from "@/research/systematic_review_v40/manifest.json";
import {
  axes,
  axisByField,
  axisById,
  axisIds,
  evidenceOnlyDisclaimer,
  situationById,
  situationIds,
  type AxisId,
  type SituationId,
} from "@/src/lib/clinical-situations";
import {
  deriveEvidenceSource,
  flattenTranslatedFindings,
} from "@/src/lib/evidence-sentences";
import { joinMultiValue, splitMultiValue } from "@/src/lib/multi-value-input";

// 이 라우트는 외부 모델을 호출하지 않는다. 같은 입력에 같은 근거 목록이 나와야
// 논문이 주장하는 "결정론적 탐색 도구"가 성립하고, 예전 구현이 쓰던 요약 API 키는
// 운영 서비스와 공유되어 한 번 소진되면 그쪽까지 멈춘다.

/** 한글 목적격 조사. 마지막 글자에 받침이 있으면 "을", 없으면 "를". */
function objectParticle(word: string) {
  const last = word.at(-1) ?? "";
  const code = last.charCodeAt(0);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return "를";
  return (code - 0xac00) % 28 === 0 ? "를" : "을";
}

// ─────────────────────────────────────────────────────────────────────────────
// 요약은 이번 응답이 실제로 고른 문헌에서만 만든다. 상수 문장을 쓰면 본문과 근거가
// 서로 다른 것을 가리키게 된다(10529da 에서 한 번 고쳤던 문제다).
// 문헌이 없으면 없다고 적고, 뒷받침되지 않는 문장으로 채우지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

/** 초록만 보고 만든 목록이라 연구 유형은 publication_types 로만 말한다. */
function studyKind(item: Evidence) {
  const types = String(item.publication_types ?? "");
  if (/meta-analysis/i.test(types)) return "메타분석";
  if (/systematic review/i.test(types)) return "체계적 문헌고찰";
  if (/randomized controlled trial/i.test(types)) return "무작위 대조시험";
  if (/case reports/i.test(types)) return "증례 보고";
  if (/observational study|cohort/i.test(types)) return "관찰연구";
  if (/clinical trial/i.test(types)) return "임상시험";
  if (/review/i.test(types)) return "문헌고찰";
  return "연구";
}

/**
 * 사용자가 적은 것을 말로 되짚는다.
 * 축 조합이 어떻게 오든 문장이 깨지지 않도록 "이름 값" 명사구로 만들어 잇고,
 * 문장을 끝내는 동사는 하나만 둔다.
 */
const profileLabels: Record<string, string> = {
  age: "나이",
  medication: "함께 드시는 약",
  dose: "하루 섭취량",
  sex: "성별",
  condition: "기저질환·증상",
};

function buildProfileLine(
  spoken: string,
  applied: { field: string; value: string }[],
) {
  const said = applied
    .map((item) => {
      const label = profileLabels[item.field];
      return label ? `${label} ${item.value}` : item.value;
    })
    .filter(Boolean);
  if (!said.length) return `${spoken}, 따로 적어주신 조건은 없으셨어요.`;
  // 값 끝에 mg·IU 같은 로마자가 자주 와서 조사를 붙이면 어색해진다. 조사를 쓰지 않는다.
  return `${spoken}, ${said.join(" · ")} 이렇게 적어주셨어요.`;
}

/** 고른 문헌 묶음의 구성만 설명한다. 개별 결과는 화면에서 문헌별로 표시한다. */
function buildEvidenceOverview(items: Evidence[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const kind = studyKind(item);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const mix = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, n]) => `${kind} ${n}편`)
    .join(", ");
  const years = items.map((item) => item.year).filter(Boolean) as number[];
  const lo = years.length ? Math.min(...years) : 0;
  const hi = years.length ? Math.max(...years) : 0;
  const span = !years.length
    ? ""
    : lo === hi
      ? ` 모두 ${lo}년 문헌입니다.`
      : ` ${lo}년부터 ${hi}년 사이에 나왔습니다.`;

  return `연결된 문헌은 ${items.length}편입니다.${
    mix ? ` 연구유형은 ${mix}입니다.` : ""
  }${span}`;
}

/** 이 문헌들이 말하지 않는 것. 세어서 말할 수 있는 것만 적는다. */
function buildLimitLine(
  items: Evidence[],
  doseInput: string,
  appliedNouns: string[],
) {
  const withDose = items.filter((item) =>
    String(item.dose ?? "").trim(),
  ).length;
  const titleOnly = items.filter(
    (item) => String(item.source_scope ?? "") === "title_only",
  ).length;

  const parts = [
    "다만 이 문헌들은 개인별 안전 상한을 정하지 않았습니다.",
  ];
  // 축은 "그 항목을 보고했는가"로만 걸린다. 적어주신 값과 문헌을 대조하지 않으므로
  // 결과가 그 값을 직접 다룬 것처럼 읽히지 않게 여기서 분명히 해 둔다.
  if (appliedNouns.length)
    parts.push(
      `${appliedNouns.join("·")}${objectParticle(appliedNouns.join("·"))} 보고한 문헌만 남겼을 뿐, 적어주신 값을 직접 다룬 문헌이라는 뜻은 아닙니다.`,
    );
  if (doseInput)
    parts.push(
      withDose === 0
        ? "이 가운데 복용량을 초록에 적은 문헌은 없습니다."
        : withDose === items.length
          ? `${items.length}편 모두 복용량을 초록에 적었지만, 그 값이 말씀하신 양과 같다는 뜻은 아닙니다.`
          : `${items.length}편 가운데 복용량을 초록에 적은 것은 ${withDose}편입니다.`,
    );
  parts.push(
    titleOnly
      ? `초록을 확인한 문헌이 ${items.length - titleOnly}편, 제목만 있는 문헌이 ${titleOnly}편이고 원문은 확보하지 않았습니다.`
      : "제목과 초록만 확인했고 원문은 확보하지 않았습니다.",
  );
  return parts.join(" ");
}

/** 지금 무엇을 볼지. 화면에 실제로 있는 것만 가리킨다. */
function buildNextLine(items: Evidence[], appliedCount: number) {
  const base =
    "아래 목록에서 문헌마다 연구 대상과 관찰된 결과, 그리고 그 문장이 초록의 몇 번째인지까지 확인하실 수 있어요.";
  if (appliedCount && items.length <= 2)
    return `${base} 남은 문헌이 적으면 조건을 하나씩 지워 더 넓은 근거를 보실 수 있습니다.`;
  return base;
}

type Evidence = {
  record_id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  doi: string;
  url: string;
  locator: string;
  dose: string;
  outcome: string;
  key_finding: string;
  key_finding_ko: string;
  publication_types: string;
  population: string;
  priority_score: number;
  source_scope: string;
  effect_status: string;
};

type PresentedEvidence = Evidence & {
  source_locator: string;
  source_sentence: string;
  translation_authorship: "ai_generated" | null;
  sentence_role: "result_or_conclusion" | "background_or_methods" | "unclassified";
};

type Rule = {
  rule_id: string;
  question_id: string;
  personalization_axis: string;
  condition: string;
  checks: string[];
  output: string;
  evidence: Evidence[];
  all_evidence: Evidence[];
  output_scope: string;
  clinical_recommendation: boolean;
  decision_authority: string;
};

const allRules = rules as unknown as Rule[];

/**
 * 확장 근거 목록. 핵심근거 15건 상한 밖의 근거까지 담고 있다.
 * 축 부분집합이 없으므로 조건 필터가 적용되지 않고, 근거 문장은 영어 원문이다.
 * 봉인된 `personalized_rules.json` 을 재생성하지 않으려고 별도 파일로 둔 것이라
 * 두 목록의 성격이 다르다는 점을 응답에서 밝힌다.
 */
// 확장 항목에는 한국어 번역(key_finding_ko)과 효과 판정(effect_status)이 없다.
// 그 둘은 핵심근거 75건에만 있으므로 빈 값으로 채워 형태만 맞춘다. 화면은 번역이
// 비어 있으면 그 줄을 그리지 않으므로 영어 근거 문장만 보인다.
let extendedEvidencePromise: Promise<Record<string, Evidence[]>> | null = null;

/** 3.4 MB 확장 목록은 사용자가 확장 보기를 열 때만 읽는다. */
function loadExtendedEvidence() {
  if (!extendedEvidencePromise) {
    extendedEvidencePromise = import(
      "@/research/systematic_review_v40/extended_evidence_v40.json"
    ).then((module) =>
      Object.fromEntries(
        Object.entries(
          (module.default as {
            questions: Record<string, Record<string, unknown>[]>;
          }).questions,
        ).map(([question, items]) => [
          question,
          items.map(
            (item) =>
              ({
                key_finding_ko: "",
                effect_status: "",
                ...item,
              }) as unknown as Evidence,
          ),
        ]),
      ),
    );
  }
  return extendedEvidencePromise;
}

/**
 * 확장 근거의 축 색인. 규칙 파일의 축 규칙은 질문당 핵심근거 15건 위에서만 계산돼
 * 있어서 확장 보기에 조건을 걸 수 없었다. `tools/v40/build_extended_axis_index.py`
 * 가 v3.0 `extract_observed_axes` 와 같은 판정식을 확장 근거 1,899행에 적용해 만든
 * 색인이다. 핵심근거 360건 대조에서 규칙 파일과 전건 일치한다.
 */
let extendedAxisPromise: Promise<Record<string, Record<string, string[]>>> | null =
  null;

function loadExtendedAxisIndex() {
  if (!extendedAxisPromise) {
    extendedAxisPromise = import(
      "@/research/systematic_review_v40/extended_axis_index_v40.json"
    ).then(
      (module) =>
        (module.default as {
          questions: Record<string, Record<string, string[]>>;
        }).questions,
    );
  }
  return extendedAxisPromise;
}
const EXTENDED_PAGE = 30;

function sentenceRole(sentence: string): PresentedEvidence["sentence_role"] {
  if (/^(?:RESULTS?|CONCLUSIONS?|FINDINGS?|SYNTHESIS OF RESULTS):/i.test(sentence))
    return "result_or_conclusion";
  if (/^(?:BACKGROUND|INTRODUCTION|METHODS?|OBJECTIVES?|BACKGROUND\/OBJECTIVES):/i.test(sentence))
    return "background_or_methods";
  return "unclassified";
}

/** 봉인 데이터는 그대로 두고 표시 계층에서 위치와 실제 문장을 분리한다. */
function presentEvidence(item: Evidence): PresentedEvidence {
  const { sourceLocator, sourceSentence } = deriveEvidenceSource(
    String(item.key_finding ?? ""),
    String(item.locator ?? ""),
  );
  return {
    ...item,
    source_locator: sourceLocator,
    source_sentence: sourceSentence,
    translation_authorship: item.key_finding_ko ? "ai_generated" : null,
    sentence_role: sentenceRole(sourceSentence),
  };
}

function normalizedTitle(title: string) {
  return title.toLocaleLowerCase("en-US").replace(/[^a-z0-9가-힣]+/gu, " ").trim();
}

function evidenceSummary(items: PresentedEvidence[]) {
  const sourceScope = { abstract_only: 0, title_only: 0 };
  for (const item of items) {
    if (item.source_scope === "title_only") sourceScope.title_only += 1;
    else sourceScope.abstract_only += 1;
  }
  return {
    displayed_records: items.length,
    unique_titles: new Set(items.map((item) => normalizedTitle(item.title))).size,
    source_scope: sourceScope,
    ai_extracted_sentences: items.filter(
      (item) =>
        item.source_scope !== "title_only" && Boolean(item.source_sentence),
    ).length,
    title_derived_records: items.filter(
      (item) => item.source_scope === "title_only",
    ).length,
    ai_translated_sentences: flattenTranslatedFindings(
      items.filter((item) => item.translation_authorship === "ai_generated"),
    ).length,
  };
}

function findRule(situation: SituationId, axis: AxisId | "base") {
  return allRules.find(
    (rule) =>
      rule.question_id === situation && rule.personalization_axis === axis,
  );
}

const FIELD_MAX = 120;

function readField(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > FIELD_MAX ? "" : trimmed;
}

/**
 * 한 칸에 조건을 여러 개 적을 수 있다(예: "와파린, 아스피린").
 * 축 적용 여부는 값이 아니라 입력 유무로 정해지므로 판정에는 영향이 없고,
 * 화면에 되돌려 줄 때 구분자를 하나로 통일하고 중복만 제거한다.
 */
function normalizeMultiValue(value: string) {
  return joinMultiValue(splitMultiValue(value));
}

/** 입력란이 실질적으로 비어 있는지. "없음", "모름"은 축을 적용하지 않는다. */
function isBlank(value: string) {
  return !value || /^(없음|없어요|모름|모르겠어요|해당없음|-)$/.test(value);
}

function rankEvidence(items: Evidence[]) {
  return [...items].sort(
    (a, b) =>
      Number(b.priority_score ?? 0) - Number(a.priority_score ?? 0) ||
      a.record_id.localeCompare(b.record_id),
  );
}

// 이 상황의 핵심 근거는 질문당 15건이다(core_manifest.core_limit_per_question).
// 5건으로 잘라 보여주면 남은 10건이 있는 줄도 모르게 되므로 핵심 근거는 전부 보여준다.
// 그보다 넓은 근거는 확장 보기(extended_evidence_v40.json)로 넘긴다.
const SELECTED_LIMIT = 15;

function readAxes(value: unknown) {
  if (value === undefined) return { ok: true as const, axes: [] as AxisId[] };
  if (!Array.isArray(value)) return { ok: false as const, axes: [] as AxisId[] };
  const values = Array.from(new Set(value));
  if (
    values.some(
      (item) => typeof item !== "string" || !axisIds.includes(item as AxisId),
    )
  )
    return { ok: false as const, axes: [] as AxisId[] };
  return { ok: true as const, axes: values as AxisId[] };
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload || typeof payload !== "object")
    return NextResponse.json(
      { error: "요청 형식을 읽지 못했습니다. 다시 시도하세요." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );

  const situation = readField(payload.situation) as SituationId;
  if (!situationIds.includes(situation))
    return NextResponse.json(
      { error: "지원하는 다섯 상황 중 하나를 선택하세요." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );

  const explicitAxes = readAxes(payload.axes);
  if (!explicitAxes.ok)
    return NextResponse.json(
      { error: "지원하는 표현 필터만 선택하세요." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );

  const base = findRule(situation, "base");
  if (!base)
    return NextResponse.json(
      { error: "이 상황의 근거 규칙을 불러오지 못했습니다." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );

  const axesProvided = Object.prototype.hasOwnProperty.call(payload, "axes");
  const submittedInputs = {
    age: normalizeMultiValue(readField(payload.age)),
    medication: normalizeMultiValue(readField(payload.medication)),
    dose: normalizeMultiValue(readField(payload.dose)),
    sex: normalizeMultiValue(readField(payload.sex)),
    condition: normalizeMultiValue(readField(payload.condition)),
  };
  const inputs = axesProvided
    ? { age: "", medication: "", dose: "", sex: "", condition: "" }
    : submittedInputs;
  const legacyRequestedAxes = axes
    .filter((axis) => !isBlank(inputs[axis.field]))
    .map((axis) => axis.id);
  const requestedAxes = axesProvided
    ? explicitAxes.axes
    : legacyRequestedAxes;

  // axes 배열이 있으면 그 배열만 사용한다. 이전 UI의 값 입력 요청은 axes 배열이
  // 없을 때만 축으로 바꾼다. 규칙 파일에 축이 없으면 적용하지 않고 그대로 알린다.
  const applied: {
    axis: AxisId;
    field: string;
    value: string;
    reported: number;
  }[] = [];
  const unavailable: { axis: AxisId; field: string; value: string }[] = [];

  for (const axis of axes) {
    const value = inputs[axis.field];
    if (!requestedAxes.includes(axis.id)) continue;
    const rule = findRule(situation, axis.id);
    if (!rule) {
      unavailable.push({
        axis: axis.id,
        field: axis.field,
        value: axesProvided ? "" : value,
      });
      continue;
    }
    applied.push({
      axis: axis.id,
      field: axis.field,
      value: axesProvided ? "" : value,
      reported: rule.all_evidence.length,
    });
  }

  // 적용된 축을 모두 보고한 문헌만 남긴다. 축을 하나도 적용하지 않았으면 이 상황의
  // 핵심 근거를 그대로 보여준다.
  let pool = base.all_evidence;
  const filterTrace: { axis: AxisId | "base"; label: string; count: number }[] = [
    { axis: "base", label: "핵심 근거", count: pool.length },
  ];
  for (const item of applied) {
    const rule = findRule(situation, item.axis);
    if (!rule) continue;
    const ids = new Set(rule.all_evidence.map((entry) => entry.record_id));
    pool = pool.filter((entry) => ids.has(entry.record_id));
    filterTrace.push({
      axis: item.axis,
      label: axisById.get(item.axis)?.label ?? item.axis,
      count: pool.length,
    });
  }

  // 축을 하나도 적용하지 않았을 때도 `all_evidence` 에서 고른다. 규칙 파일의
  // `evidence` 는 build_site_v4.py 가 만든 상위 3건 미리보기(`matched[:3]`)이므로,
  // 그것을 쓰면 조건을 아무것도 안 넣은 화면이 조건을 넣은 화면보다 좁아진다
  // (핵심근거 15건인데 3건만 나오고, 축 두 개를 넣으면 5건이 나왔다).
  // 두 경로 모두 all_evidence 를 쓰고 표시 개수는 SELECTED_LIMIT 하나로 정한다.
  const ranked = rankEvidence(applied.length ? pool : base.all_evidence);

  // 확장 보기: 이 상황의 근거 전체에 같은 조건을 건다. 축 색인이 확장 근거에도
  // 생겼으므로(extended_axis_index_v40.json) 핵심근거 15건 밖에서도 조건이 걸린다.
  const expanded = payload.expanded === true;
  const extendedByQuestion = expanded ? await loadExtendedEvidence() : null;
  // 축 색인은 140 KB 라 기본 조회에서도 읽는다. 조건을 건 확장 근거가 몇 건인지를
  // 확장 보기를 열기 전에 알려주려면 이 수가 먼저 있어야 한다.
  const extendedAxisIndex = await loadExtendedAxisIndex();
  const perQuestionAxes = extendedAxisIndex[situation] ?? {};
  const questionPoolTotal = Number(
    (evidenceManifest.by_question as Record<string, number>)[situation] ?? 0,
  );

  // 조건을 건 확장 근거 수. 확장 보기 여부와 무관하게 항상 센다.
  let extendedMatchIds: Set<string> | null = null;
  const intersect = (left: Set<string>, right: Set<string>) =>
    new Set<string>([...left].filter((id) => right.has(id)));
  const extendedTrace: { axis: AxisId | "base"; label: string; count: number }[] = [
    { axis: "base", label: "이 상황의 근거", count: questionPoolTotal },
  ];
  for (const item of applied) {
    const ids = new Set<string>(perQuestionAxes[item.axis] ?? []);
    extendedMatchIds = extendedMatchIds
      ? intersect(extendedMatchIds, ids)
      : ids;
    extendedTrace.push({
      axis: item.axis,
      label: axisById.get(item.axis)?.label ?? item.axis,
      count: extendedMatchIds.size,
    });
  }
  const extendedMatchTotal = extendedMatchIds
    ? extendedMatchIds.size
    : questionPoolTotal;

  const extendedBase = extendedByQuestion?.[situation] ?? [];
  const extendedAll = extendedMatchIds
    ? extendedBase.filter((entry) => extendedMatchIds.has(entry.record_id))
    : extendedBase;

  const extendedTotal = expanded ? extendedAll.length : extendedMatchTotal;
  const rawOffset = Number(payload.offset);
  const finalPageOffset = extendedTotal
    ? Math.floor((extendedTotal - 1) / EXTENDED_PAGE) * EXTENDED_PAGE
    : 0;
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0
      ? Math.min(Math.floor(rawOffset), finalPageOffset)
      : 0;

  const selectedRaw = expanded
    ? extendedAll.slice(offset, offset + EXTENDED_PAGE)
    : ranked.slice(0, SELECTED_LIMIT);
  const selected = selectedRaw.map(presentEvidence);

  const meta = situationById.get(situation);
  const axisCoverage = Object.fromEntries(
    axes.map((axis) => {
      const rule = findRule(situation, axis.id);
      return [axis.id, rule ? rule.all_evidence.length : null];
    }),
  ) as Record<AxisId, number | null>;

  // 결과가 0건일 때 어느 조건이 걸렸는지 말하려고 축 명사만 모아 둔다.
  const narrowedNouns = applied
    .map((item) => axisByField.get(item.field as never)?.noun)
    .filter(Boolean) as string[];

  const appliedNounsForExpanded = applied
    .map((item) => axisById.get(item.axis)?.noun)
    .filter(Boolean) as string[];

  const expandedSummary = (
    selected.length
      ? [
          applied.length
            ? `${meta?.short ?? "이 상황"}의 근거 ${questionPoolTotal.toLocaleString("ko-KR")}건 가운데 ${appliedNounsForExpanded.join("·")}${objectParticle(appliedNounsForExpanded.join("·"))} 보고한 ${extendedTotal.toLocaleString("ko-KR")}건이 남았고,`
            : `${meta?.short ?? "이 상황"}의 근거 ${extendedTotal.toLocaleString("ko-KR")}건 가운데`,
          `${offset + 1}~${offset + selected.length}번째를 보여드립니다.`,
          applied.length
            ? "핵심 근거 15건 밖까지 같은 조건으로 걸렀습니다. 적어주신 값 자체로 문헌을 고르지는 않습니다."
            : "",
          "근거 문장은 영어 원문입니다.",
        ]
      : [
          `${meta?.short ?? "이 상황"}의 근거 ${questionPoolTotal.toLocaleString("ko-KR")}건 가운데`,
          appliedNounsForExpanded.length
            ? `${appliedNounsForExpanded.join("·")}을 모두 보고한 문헌은 없습니다.`
            : "보여드릴 근거가 없습니다.",
          "조건을 하나씩 지우면 어느 조건에서 문헌이 사라지는지 확인하실 수 있어요.",
        ]
  )
    .filter(Boolean)
    .join(" ");

  // 상담하듯 읽히는 네 문단. 도구가 무엇을 했는지가 아니라 문헌이 무엇을 보고했는지를
  // 말한다. 각 문단은 이번 응답이 실제로 고른 문헌에서만 만든다.
  const requestedProfile = requestedAxes.map((axisId) => {
    const axis = axisById.get(axisId);
    return {
      field: axis?.field ?? axisId,
      value: axis ? inputs[axis.field] : "",
    };
  });
  const profileLine = axesProvided && requestedAxes.length
    ? applied.length
      ? `${meta?.short ?? "이 상황"}에서 ${applied
          .map((item) => axisById.get(item.axis)?.noun ?? item.axis)
          .join("·")} 필터를 선택했습니다.`
      : `${meta?.short ?? "이 상황"}에서 적용 가능한 표현 필터가 선택되지 않았습니다.`
    : axesProvided
      ? `${meta?.short ?? "이 상황"}에서 표현 필터 없이 핵심 근거를 확인했습니다.`
      : buildProfileLine(meta?.spoken ?? "이 상황을 고르셨고", requestedProfile);
  const narrative = expanded
    ? [expandedSummary]
    : selected.length
      ? [
          profileLine,
          buildEvidenceOverview(selected),
          buildLimitLine(selectedRaw, inputs.dose, narrowedNouns),
          buildNextLine(selected, applied.length),
        ]
      : [
          profileLine,
          `그런데 ${meta?.short ?? "이 상황"}에서 선별된 핵심 근거 ${base.all_evidence.length}건 가운데 말씀하신 조건을 모두 보고한 문헌은 없습니다.`,
          narrowedNouns.length > 1
            ? `${narrowedNouns.join("·")}을 한 편에서 모두 보고해야 남는데, 조건이 겹칠수록 남는 문헌이 빠르게 줄어듭니다.`
            : narrowedNouns.length === 1
              ? `${narrowedNouns[0]}${objectParticle(narrowedNouns[0])} 보고한 문헌이 이 상황에는 없었습니다.`
              : "",
          "조건을 하나씩 지우면 어느 조건에서 문헌이 사라지는지 확인하실 수 있어요.",
        ].filter(Boolean);

  const summary = narrative.join("\n\n");

  return NextResponse.json(
    {
      situation,
      situation_label: meta?.label ?? situation,
      research_question: meta?.question ?? "",
      inputs,
      applied_axes: applied,
      ignored_axes: [],
      unavailable_axes: unavailable,
      axis_coverage: axisCoverage,
      core_evidence_count: base.all_evidence.length,
      evidence: selected,
      evidence_total_after_filter: expanded ? extendedTotal : ranked.length,
      evidence_summary: evidenceSummary(selected),
      matching_basis: expanded
        ? applied.length
          ? "metadata_axis_presence_extended"
          : "expanded_question_corpus"
        : applied.length
          ? "metadata_axis_presence"
          : "question_core_evidence",
      filter_mode: applied.length ? "metadata_axis_presence" : "core",
      filter_trace: expanded ? extendedTrace : filterTrace,
      query_snapshot: {
        situation,
        requested_axes: requestedAxes,
        active_axes: applied.map((item) => item.axis),
      },
      expanded,
      expanded_offset: offset,
      expanded_page_size: EXTENDED_PAGE,
      extended_total: extendedTotal,
      extended_pool_total: questionPoolTotal,
      extended_match_total: extendedMatchTotal,
      extended_note: applied.length
        ? "확장 보기는 핵심근거 15건 상한 밖까지 포함하며, 선택한 항목을 보고한 문헌만 남깁니다. 적어주신 값 자체로 문헌을 고르지는 않습니다. 근거 문장은 영어 원문입니다."
        : "확장 보기는 핵심근거 15건 상한 밖에 있는 이 상황의 전체 후보 기록을 포함합니다. 근거 문장은 영어 원문입니다.",
      checks: base.checks,
      summary,
      narrative,
      output_scope: base.output_scope,
      clinical_recommendation: base.clinical_recommendation,
      decision_authority: base.decision_authority,
      disclaimer: evidenceOnlyDisclaimer,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
