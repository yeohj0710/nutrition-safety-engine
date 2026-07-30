import { NextResponse } from "next/server";
import rules from "@/research/systematic_review_v40/personalized_rules.json";
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

const SELECTED_LIMIT = 5;

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
  const selected = ranked.slice(0, SELECTED_LIMIT);

  const meta = situationById.get(situation);
  const axisCoverage = Object.fromEntries(
    axes.map((axis) => {
      const rule = findRule(situation, axis.id);
      return [axis.id, rule ? rule.all_evidence.length : null];
    }),
  ) as Record<AxisId, number | null>;

  const narrowed = applied
    .map((item) => axisByField.get(item.field as never)?.applied)
    .filter(Boolean) as string[];

  const summary = selected.length
    ? [
        `${meta?.short ?? "이 상황"}에서 선별된 핵심 근거 ${base.all_evidence.length}건 가운데 ${selected.length}건을 보여드립니다.`,
        narrowed.length ? narrowed.join(" ") : "",
        `각 문헌의 근거 문장 위치를 함께 표시했습니다.`,
      ]
        .filter(Boolean)
        .join(" ")
    : [
        `${meta?.short ?? "이 상황"}에서 선별된 핵심 근거 ${base.all_evidence.length}건 가운데`,
        `입력하신 조건을 모두 보고한 문헌은 없습니다.`,
        `조건을 줄이면 더 넓은 범위의 근거를 볼 수 있습니다.`,
      ].join(" ");

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
      checks: base.checks,
      summary,
      output_scope: base.output_scope,
      clinical_recommendation: base.clinical_recommendation,
      decision_authority: base.decision_authority,
      disclaimer: evidenceOnlyDisclaimer,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
