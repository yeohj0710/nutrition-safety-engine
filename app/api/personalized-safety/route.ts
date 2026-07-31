import { NextResponse } from "next/server";
import rules from "@/research/systematic_review_v40/personalized_rules.json";
import extended from "@/research/systematic_review_v40/extended_evidence_v40.json";
import {
  axes,
  axisByField,
  evidenceOnlyDisclaimer,
  situationById,
  situationIds,
  type AxisId,
  type SituationId,
} from "@/src/lib/clinical-situations";
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

/** 받침이 있으면 true. 한글이 아니면 받침 없는 것으로 본다(단위·숫자가 자주 온다). */
function hasFinalConsonant(word: string) {
  const last = word.at(-1) ?? "";
  const code = last.charCodeAt(0);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** 한글 보조사 은/는. */
function topicParticle(word: string) {
  return hasFinalConsonant(word) ? "은" : "는";
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
 * 인용은 문장 경계에서만 줄인다. 문장 중간을 자르면 의미가 뒤집힐 수 있어서
 * 줄인 경우에는 줄였다는 사실을 함께 알린다.
 */
const QUOTE_LIMIT = 200;
function trimToSentences(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= QUOTE_LIMIT) return { text: clean, trimmed: false };
  const sentences = clean.split(/(?<=[.!?。])\s+/);
  let kept = "";
  for (const sentence of sentences) {
    const next = kept ? `${kept} ${sentence}` : sentence;
    if (kept && next.length > QUOTE_LIMIT) break;
    kept = next;
    if (kept.length >= QUOTE_LIMIT) break;
  }
  const out = kept || clean.slice(0, QUOTE_LIMIT);
  return { text: out, trimmed: out.length < clean.length };
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

/** 고른 문헌이 실제로 무엇을 보고했는지. 가장 관련 높은 한 편은 원문 그대로 인용한다. */
function buildEvidenceLine(items: Evidence[]) {
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

  const head = `연결된 문헌은 ${items.length}편입니다.${
    mix ? ` ${mix}이고,` : ""
  }${span}`;

  const top = items[0];
  const finding = String(top?.key_finding_ko ?? "").replace(/\s+/g, " ").trim();
  if (!finding) return head;
  const quote = trimToSentences(finding);
  const kind = studyKind(top);
  return `${head} 그중 가장 관련이 높은 ${top.year ? `${top.year}년 ` : ""}${kind}${topicParticle(
    kind,
  )} “${quote.text}”라고 보고했습니다.${
    quote.trimmed ? " 이어지는 문장은 아래 목록에서 볼 수 있어요." : ""
  }`;
}

/** 이 문헌들이 말하지 않는 것. 세어서 말할 수 있는 것만 적는다. */
function buildLimitLine(items: Evidence[], doseInput: string) {
  const withDose = items.filter((item) =>
    String(item.dose ?? "").trim(),
  ).length;
  const titleOnly = items.filter(
    (item) => String(item.source_scope ?? "") === "title_only",
  ).length;

  const parts = [
    "다만 이 문헌들은 개인별 안전 상한을 정하지 않았습니다.",
  ];
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
const extendedByQuestion = Object.fromEntries(
  Object.entries(
    (extended as { questions: Record<string, Record<string, unknown>[]> }).questions,
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
) as Record<string, Evidence[]>;
const EXTENDED_PAGE = 30;

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

  const base = findRule(situation, "base");
  if (!base)
    return NextResponse.json(
      { error: "이 상황의 근거 규칙을 불러오지 못했습니다." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );

  const inputs = {
    age: normalizeMultiValue(readField(payload.age)),
    medication: normalizeMultiValue(readField(payload.medication)),
    dose: normalizeMultiValue(readField(payload.dose)),
    sex: normalizeMultiValue(readField(payload.sex)),
    condition: normalizeMultiValue(readField(payload.condition)),
  };

  // 사용자가 채운 입력란만 축으로 바꾼다. 규칙 파일에 그 축이 없는 상황도 있으므로
  // (예: HRS2 에는 sex 축이 없다) 없으면 적용하지 않고 그 사실을 그대로 알린다.
  const applied: {
    axis: AxisId;
    field: string;
    value: string;
    reported: number;
  }[] = [];
  const unavailable: { axis: AxisId; field: string; value: string }[] = [];

  for (const axis of axes) {
    const value = inputs[axis.field];
    if (isBlank(value)) continue;
    const rule = findRule(situation, axis.id);
    if (!rule) {
      unavailable.push({ axis: axis.id, field: axis.field, value });
      continue;
    }
    applied.push({
      axis: axis.id,
      field: axis.field,
      value,
      reported: rule.all_evidence.length,
    });
  }

  // 적용된 축을 모두 보고한 문헌만 남긴다. 축을 하나도 적용하지 않았으면 이 상황의
  // 핵심 근거를 그대로 보여준다.
  let pool = base.all_evidence;
  for (const item of applied) {
    const rule = findRule(situation, item.axis);
    if (!rule) continue;
    const ids = new Set(rule.all_evidence.map((entry) => entry.record_id));
    pool = pool.filter((entry) => ids.has(entry.record_id));
  }

  // 축을 하나도 적용하지 않았을 때도 `all_evidence` 에서 고른다. 규칙 파일의
  // `evidence` 는 build_site_v4.py 가 만든 상위 3건 미리보기(`matched[:3]`)이므로,
  // 그것을 쓰면 조건을 아무것도 안 넣은 화면이 조건을 넣은 화면보다 좁아진다
  // (핵심근거 15건인데 3건만 나오고, 축 두 개를 넣으면 5건이 나왔다).
  // 두 경로 모두 all_evidence 를 쓰고 표시 개수는 SELECTED_LIMIT 하나로 정한다.
  const ranked = rankEvidence(applied.length ? pool : base.all_evidence);

  // 확장 보기: 이 상황의 근거 전체를 순서대로 넘긴다. 축 부분집합이 핵심근거 위에서만
  // 계산돼 있어 조건 필터를 걸 수 없으므로, 조건을 적용하지 않는다는 사실을 함께 보낸다.
  const extendedAll = extendedByQuestion[situation] ?? [];
  const expanded = payload.expanded === true;
  const rawOffset = Number(payload.offset);
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0
      ? Math.min(Math.floor(rawOffset), extendedAll.length)
      : 0;

  const selected = expanded
    ? extendedAll.slice(offset, offset + EXTENDED_PAGE)
    : ranked.slice(0, SELECTED_LIMIT);

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

  const expandedSummary = [
    `${meta?.short ?? "이 상황"}의 근거 ${extendedAll.length.toLocaleString("ko-KR")}건 가운데`,
    `${offset + 1}~${offset + selected.length}번째를 보여드립니다.`,
    applied.length
      ? "확장 보기에서는 입력하신 조건을 적용하지 않습니다."
      : "",
    "근거 문장은 영어 원문입니다.",
  ]
    .filter(Boolean)
    .join(" ");

  // 상담하듯 읽히는 네 문단. 도구가 무엇을 했는지가 아니라 문헌이 무엇을 보고했는지를
  // 말한다. 각 문단은 이번 응답이 실제로 고른 문헌에서만 만든다.
  const profileLine = buildProfileLine(
    meta?.spoken ?? "이 상황을 고르셨고",
    applied,
  );
  const narrative = expanded
    ? [expandedSummary]
    : selected.length
      ? [
          profileLine,
          buildEvidenceLine(selected),
          buildLimitLine(selected, inputs.dose),
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
      unavailable_axes: unavailable,
      axis_coverage: axisCoverage,
      core_evidence_count: base.all_evidence.length,
      evidence: selected,
      evidence_total_after_filter: ranked.length,
      expanded,
      expanded_offset: offset,
      expanded_page_size: EXTENDED_PAGE,
      extended_total: extendedAll.length,
      extended_note:
        "확장 보기는 핵심근거 15건 상한 밖의 근거까지 포함합니다. 조건 필터가 적용되지 않고 근거 문장은 영어 원문입니다.",
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
