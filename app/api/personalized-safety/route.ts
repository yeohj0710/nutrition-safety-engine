import { NextResponse } from "next/server";
import rules from "@/research/systematic_review_v3/personalized_rules.json";
const map: Record<string, string> = {
  "비타민 K": "A1",
  "vitamin k": "A1",
  "오메가-3": "A2",
  "omega-3": "A2",
  칼슘: "B1",
  calcium: "B1",
  "비타민 D": "B2",
  "vitamin d": "B2",
  "비타민 C": "B3",
  "vitamin c": "B3",
};
const guidance: Record<
  string,
  {
    title: string;
    summary: string;
    checks: string[];
    why: string;
    next: string[];
  }
> = {
  A1: {
    title: "비타민 K 섭취 변화와 항응고 상태를 함께 확인하세요",
    summary:
      "핵심은 비타민 K를 무조건 줄이는 것이 아니라 식사와 보충제에서 섭취하는 양을 가능한 일정하게 유지하고, 식단이나 제품을 바꾼 시점과 INR 변화를 함께 확인하는 것입니다.",
    checks: [
      "최근 식사·보충제 변경으로 비타민 K 섭취량이 달라졌는지",
      "현재 제품의 비타민 K 함량과 복용 빈도",
      "최근 INR 값과 변동 여부",
    ],
    why: "와파린 등 비타민 K 길항제의 항응고 효과는 비타민 K 섭취 변화와 관련될 수 있습니다.",
    next: [
      "제품 라벨의 비타민 K 함량을 확인하세요.",
      "최근 INR 결과와 식사·제품 변경 시점을 함께 정리하세요.",
      "임의로 중단하지 말고 처방기관 또는 약사에게 기록을 보여 주세요.",
    ],
  },
  A2: {
    title: "오메가-3 용량과 출혈 관련 조건을 확인하세요",
    summary:
      "핵심은 제품의 오메가-3 총량만 보지 않고 EPA+DHA 합산량, 최근 멍·코피·잇몸출혈, 다른 출혈 위험 약물과 시술 계획을 함께 확인하는 것입니다.",
    checks: [
      "하루 EPA+DHA 합산량",
      "멍·코피·잇몸출혈 등 최근 출혈 증상",
      "아스피린·NSAID·항혈소판제 병용 여부",
    ],
    why: "오메가-3와 항응고·항혈소판 치료를 함께 사용할 때 출혈 관련 맥락을 확인할 필요가 있습니다.",
    next: [
      "제품 라벨에서 EPA와 DHA 합산량을 계산하세요.",
      "최근 출혈 증상과 병용약을 기록하세요.",
      "시술 예정이거나 출혈이 지속되면 의료진에게 확인하세요.",
    ],
  },
  B1: {
    title: "보충제 칼슘과 식이 칼슘을 구분해 확인하세요",
    summary:
      "핵심은 식이 칼슘과 보충제 칼슘을 같은 방식으로 보지 않고, 보충제의 원소 칼슘 함량·복용 시점과 음식 섭취량·결석 성분·24시간 요중 칼슘을 구분해 확인하는 것입니다.",
    checks: [
      "보충제로 섭취하는 칼슘의 일일량",
      "음식에서 섭취하는 칼슘과 복용 시점",
      "결석 성분과 24시간 요중 칼슘 결과",
    ],
    why: "칼슘 섭취와 결석 위험의 관계는 섭취원, 용량, 복용 시점과 개인의 대사 상태에 따라 달라질 수 있습니다.",
    next: [
      "제품 라벨의 원소 칼슘 함량을 확인하세요.",
      "식이 칼슘과 보충제 칼슘을 별도로 기록하세요.",
      "결석 분석 또는 24시간 소변검사 결과를 의료진과 확인하세요.",
    ],
  },
  B2: {
    title: "비타민 D 용량과 칼슘 대사 지표를 함께 확인하세요",
    summary:
      "핵심은 비타민 D 용량만으로 판단하지 않고 복용 기간, 25(OH)D, 혈청 칼슘, 24시간 요중 칼슘과 고칼슘뇨 병력을 함께 확인하는 것입니다.",
    checks: [
      "비타민 D 일일 용량과 복용 기간",
      "25(OH)D와 혈청 칼슘",
      "24시간 요중 칼슘 또는 고칼슘뇨 병력",
    ],
    why: "비타민 D는 칼슘 대사와 관련되므로 고용량 또는 위험군에서는 관련 검사값이 중요합니다.",
    next: [
      "모든 제품의 비타민 D 총량을 합산하세요.",
      "최근 25(OH)D·칼슘 검사 결과를 준비하세요.",
      "고칼슘혈증 증상이나 검사 이상이 있으면 의료진에게 확인하세요.",
    ],
  },
  B3: {
    title: "비타민 C 고용량 노출과 옥살산 위험을 확인하세요",
    summary:
      "핵심은 비타민 C 일일 총량과 복용 기간만이 아니라 결석 성분, 신장기능, 고옥살산뇨 병력과 요중 옥살산 결과를 함께 확인하는 것입니다.",
    checks: [
      "비타민 C 일일 총량과 복용 기간",
      "칼슘옥살산 결석 또는 고옥살산뇨 병력",
      "신장기능과 요중 옥살산 결과",
    ],
    why: "고용량 비타민 C는 일부 상황에서 옥살산 노출과 관련될 수 있어 위험군 확인이 필요합니다.",
    next: [
      "여러 제품에 포함된 비타민 C 총량을 합산하세요.",
      "결석 성분과 신장기능 검사 결과를 확인하세요.",
      "고용량을 임의로 계속하거나 중단하지 말고 전문가와 상의하세요.",
    ],
  },
};
function numericTokens(value: string) {
  return new Set(value.match(/\d+(?:[.,]\d+)?/g) ?? []);
}
function isGroundedSummary(
  text: string,
  input: {
    summary: string;
    profile: string[];
    checks: string[];
    why: string;
    next: string[];
  },
) {
  if (!text || text.length > 200 || /https?:\/\//i.test(text)) return false;
  const required = numericTokens(input.profile.join(" "));
  const actual = numericTokens(text);
  if ([...required].some((token) => !actual.has(token))) return false;
  const allowed = numericTokens(JSON.stringify(input));
  if ([...actual].some((token) => !allowed.has(token))) return false;
  if (
    /(?:복용|용량).{0,12}(?:시작|중단|증량|감량)(?:하세요|하십시오)|안전합니다|금지합니다|진단됩니다/.test(
      text,
    )
  )
    return false;
  return true;
}
type SummaryInput = {
  ingredient: string;
  dose: string;
  medication: string;
  condition: string;
  labs: string;
  summary: string;
  profile: string[];
  checks: string[];
  why: string;
  next: string[];
};
const conciseSummaries: Record<string, string> = {
  "비타민 K":
    "비타민 K는 무조건 줄이기보다 섭취량을 일정하게 유지하는 것이 중요합니다.",
  "오메가-3": "EPA와 DHA 합산량과 출혈 증상을 함께 확인해야 합니다.",
  칼슘: "음식으로 먹는 칼슘과 보충제 칼슘을 나누어 확인해야 합니다.",
  "비타민 D": "비타민 D 복용량과 칼슘 관련 검사값을 함께 확인해야 합니다.",
  "비타민 C": "비타민 C 총량과 결석·신장 관련 정보를 함께 확인해야 합니다.",
};
function normalizeCondition(value: string) {
  if (/자주 남$/.test(value)) return value.replace(/자주 남$/, "자주 납니다");
  if (/병력$/.test(value)) return `${value}이 있습니다`;
  return value.endsWith("다") ? value : `${value}이 있습니다`;
}
function buildProfileSentence(input: SummaryInput) {
  const sentences: string[] = [];
  if (input.dose)
    sentences.push(`${input.ingredient} ${input.dose}를 복용 중입니다.`);
  if (input.medication && input.condition)
    sentences.push(
      `${input.medication}을 함께 복용하며 ${normalizeCondition(input.condition)}.`,
    );
  else if (input.medication)
    sentences.push(`${input.medication}을 함께 복용합니다.`);
  else if (input.condition)
    sentences.push(`${normalizeCondition(input.condition)}.`);
  if (input.labs) sentences.push(`검사 결과는 ${input.labs}입니다.`);
  return sentences.join(" ");
}
export async function summarize(input: SummaryInput) {
  const conciseSummary = conciseSummaries[input.ingredient] ?? input.summary;
  const fallback = [
    buildProfileSentence(input),
    conciseSummary,
  ]
    .filter(Boolean)
    .join(" ");
  if (!process.env.OPENAI_API_KEY) return fallback;
  try {
    const modelInput = { ...input, summary: conciseSummary };
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model: process.env.OPENAI_SUMMARY_MODEL ?? "gpt-5-mini",
        reasoning: { effort: "minimal" },
        input: [
          {
            role: "system",
            content:
              "일반 사용자가 한 번에 이해할 수 있는 건강정보 안내문을 쓴다. 제공된 사실만 사용한다. 문장은 3개 이하, 전체 180자 이하로 쓴다. 첫 문장에는 복용량·병용약·병력·검사값 중 입력된 내용을 자연스럽게 요약한다. 둘째 문장은 지금 확인할 핵심 한 가지만 말한다. 마지막 문장은 상담할 때 준비할 항목 한 가지만 말한다. 한 문장에 정보를 몰아넣지 않는다. '종합하면', '핵심은', '상담 전에는', '현재 입력한 조건', '입력값', '프로필'은 쓰지 않는다. 입력된 숫자와 단위는 그대로 포함한다. 진단, 위험 단정, 복용 시작·중단·용량 변경 지시는 하지 않는다.",
          },
          { role: "user", content: JSON.stringify(modelInput) },
        ],
        max_output_tokens: 300,
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const text =
      String(
        data.output_text ??
          data.output
            ?.flatMap(
              (x: { content?: Array<{ text?: string }> }) => x.content ?? [],
            )
            .map((x: { text?: string }) => x.text ?? "")
            .join("") ??
          fallback,
      ).trim() || fallback;
    if (!isGroundedSummary(text, { ...input, summary: conciseSummary }))
      return fallback;
    return text;
  } catch {
    return fallback;
  }
}
const inputLimits = {
  ingredient: 20,
  dose: 80,
  medication: 120,
  condition: 200,
  labs: 200,
} as const;
function parseInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const parsed: Record<keyof typeof inputLimits, string> = {
    ingredient: "",
    dose: "",
    medication: "",
    condition: "",
    labs: "",
  };
  for (const key of Object.keys(inputLimits) as Array<
    keyof typeof inputLimits
  >) {
    const field = source[key];
    if (field !== undefined && typeof field !== "string") return null;
    parsed[key] = String(field ?? "").trim();
    if (parsed[key].length > inputLimits[key]) return null;
  }
  return parsed;
}
export async function POST(req: Request) {
  const b = parseInput(await req.json().catch(() => null));
  if (!b)
    return NextResponse.json(
      {
        error:
          "입력 형식이나 길이가 올바르지 않습니다. 값을 줄여 다시 시도하세요.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const q = map[b.ingredient];
  if (!q)
    return NextResponse.json(
      { error: "지원하는 다섯 보충제 중 하나를 선택하세요." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const r = rules.find((x) => x.question_id === q)!;
  const g = guidance[q];
  const entered = [
    b.dose && `복용량 ${b.dose}`,
    b.medication && `병용약 ${b.medication}`,
    b.condition && `병력 ${b.condition}`,
    b.labs && `검사값 ${b.labs}`,
  ].filter(Boolean) as string[];
  const ai_summary = await summarize({
    ingredient: b.ingredient,
    dose: b.dose,
    medication: b.medication,
    condition: b.condition,
    labs: b.labs,
    summary: g.summary,
    profile: entered,
    checks: g.checks,
    why: g.why,
    next: g.next,
  });
  return NextResponse.json(
    {
      question_id: q,
      ingredient: b.ingredient,
      title: g.title,
      summary: g.summary,
      ai_summary,
      profile: entered,
      checks: g.checks,
      why: g.why,
      next_steps: g.next,
      evidence: r.evidence,
      interpretation:
        "이 결과는 상담 준비를 위한 근거 요약입니다. 복용 시작·중단·용량 변경을 직접 지시하지 않습니다.",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
