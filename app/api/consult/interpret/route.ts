import { NextResponse } from "next/server";
import { callLuna, hasConsultKey } from "@/src/lib/ai-consult";
import { axisCoverage } from "@/src/lib/axis-coverage";
import {
  axes,
  situationIds,
  situations,
  type AxisId,
  type SituationId,
} from "@/src/lib/clinical-situations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 사람이 문장으로 쓴 상황을 다섯 입력칸으로 옮긴다. 여기서 나온 값은 그대로
// 화면에 보이고 사용자가 고칠 수 있으며, 근거 조회는 이 값을 받은 뒤에도
// 지금까지와 똑같은 결정론 경로(app/api/personalized-safety)로 돌아간다.
//
// ★ 축 필터는 값을 대조하지 않는다. "와파린"을 넣든 다른 약 이름을 넣든 결과는
//   같고, 규칙 파일에는 값별 색인이 아예 없다. 그래서 이 라우트는 값을 "무엇을
//   찾을지"가 아니라 "어떤 종류의 표현을 조건으로 걸지"를 정하는 데만 쓴다.
//   화면 문구도 그 사실대로 쓴다.

const FIELDS = ["age", "medication", "dose", "sex", "condition"] as const;
type Field = (typeof FIELDS)[number];

const fieldToAxis = new Map<Field, AxisId>(
  axes.map((axis) => [axis.field as Field, axis.id]),
);

const SITUATION_LINES = situations
  .map((item) => `- ${item.id}: ${item.label} (${item.short})`)
  .join("\n");

const DEVELOPER = `너는 보충제 안전성 문헌 조회 화면의 입력 정리기다.
사용자가 한국어 문장으로 쓴 상황을 아래 다섯 칸으로 옮기는 일만 한다.

상황(situation) 후보:
${SITUATION_LINES}
- none: 위 다섯에 해당하지 않거나 판단할 수 없을 때

칸 다섯 개는 사용자가 쓴 표현을 그대로 짧게 옮긴다. 없으면 빈 문자열로 둔다.
- age: 나이나 연령대 (예: "68세", "고령")
- medication: 함께 먹는 약 (예: "와파린")
- dose: 하루 먹는 양 (예: "2000 mg")
- sex: 성별 (예: "여성")
- condition: 앓고 있는 병이나 증상 (예: "고혈압")

지켜야 할 것:
- 사용자가 쓰지 않은 정보를 채우지 마라. 추측한 값은 빈 문자열로 둔다.
- situation 으로 이미 표현된 내용을 다른 칸에 다시 넣지 마라. 예를 들어 임신을
  골랐으면 condition 에 "임신 8개월"을 또 쓰지 않는다. condition 은 그 상황과
  별개인 기저질환·증상일 때만 채운다.
- 조회하려는 의도("연구가 있는지 보고 싶어요")는 조건이 아니다. 어느 칸에도
  넣지 말고 unmatched 에도 적지 마라.
- 의학적 판단, 복용 권고, 안전 여부를 쓰지 마라. 너는 분류만 한다.
- unmatched 에는 임상적으로 의미가 있는데 다섯 칸 어디에도 안 들어간 내용만
  짧게 적는다. 없으면 빈 문자열.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...FIELDS, "situation", "unmatched"],
  properties: {
    // strict 모드에서 anyOf[enum, null] 은 null 로 쏠린다. "none" 센티널을 쓴다.
    situation: { type: "string", enum: [...situationIds, "none"] },
    age: { type: "string" },
    medication: { type: "string" },
    dose: { type: "string" },
    sex: { type: "string" },
    condition: { type: "string" },
    unmatched: { type: "string" },
  },
} as const;

type Interpreted = Record<Field, string> & {
  situation: SituationId | "none";
  unmatched: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 60) : "";
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";

  if (!text) {
    return NextResponse.json(
      { error: "정리할 문장을 먼저 적어 주세요." },
      { status: 400 },
    );
  }
  if (text.length > 600) {
    return NextResponse.json(
      { error: "600자 안으로 줄여서 다시 적어 주세요." },
      { status: 400 },
    );
  }
  if (!hasConsultKey()) {
    return NextResponse.json(
      { error: "이 서버에는 문장 정리 기능이 켜져 있지 않습니다. 아래에서 직접 고르셔도 됩니다." },
      { status: 503 },
    );
  }

  const result = await callLuna<Interpreted>({
    developer: DEVELOPER,
    user: text,
    schemaName: "safety_query_fields",
    schema: SCHEMA,
    maxOutputTokens: 2000,
  });

  if (!result.ok) {
    console.warn("[consult/interpret] failed", {
      reason: result.reason,
      detail: result.detail,
    });
    return NextResponse.json(
      {
        error: "문장을 정리하지 못했습니다. 아래에서 직접 고르셔도 됩니다.",
        reason: result.reason,
      },
      { status: 502 },
    );
  }

  const raw = result.value;
  const situation =
    raw.situation !== "none" && situationIds.includes(raw.situation as SituationId)
      ? (raw.situation as SituationId)
      : null;

  // 값은 축을 켜는 스위치로만 쓴다. 그 상황에 규칙이 없는 축은 켜지지 않으므로,
  // 값을 받아 두되 적용되지 않는다는 사실을 따로 돌려준다.
  const applied: { axis: AxisId; field: Field; value: string }[] = [];
  const unavailable: { axis: AxisId; field: Field; value: string }[] = [];
  const values = {} as Record<Field, string>;

  for (const field of FIELDS) {
    const value = clean(raw[field]);
    values[field] = value;
    if (!value) continue;
    const axis = fieldToAxis.get(field);
    if (!axis) continue;
    const coverage = situation ? axisCoverage[situation][axis] : undefined;
    if (situation && coverage === null) unavailable.push({ axis, field, value });
    else applied.push({ axis, field, value });
  }

  return NextResponse.json({
    situation,
    values,
    applied_axes: applied,
    unavailable_axes: unavailable,
    unmatched: clean(raw.unmatched),
    model: "ai_interpreted_input",
    // 화면이 반드시 같이 보여줄 사실. 값 자체로 문헌을 고르지 않는다.
    notice:
      "적어주신 말은 어떤 이야기를 조건으로 걸지 정하는 데만 씁니다. 값 자체와 논문 내용을 대조하지는 않습니다.",
  });
}
