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
    evidenceSummary: string;
    profile: string[];
    checks: string[];
    why: string;
    next: string[];
  },
) {
  if (
    !text ||
    text.length > 700 ||
    /https?:\/\//i.test(text) ||
    /입력(?:되|하|된)|입력값|프로필|대상자|사용자|검사값/.test(text)
  )
    return false;
  if (!text.includes("그래서 지금은")) return false;
  const required = numericTokens(
    `${input.profile.join(" ")} ${input.evidenceSummary}`,
  );
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
  questionId: string;
  ingredient: string;
  dose: string;
  medication: string;
  condition: string;
  labs: string;
  summary: string;
  evidenceSummary: string;
  profile: string[];
  checks: string[];
  why: string;
  next: string[];
};
const evidenceSummaries: Record<string, string> = {
  A1: "관련 연구에서는 비타민 K 25 mcg이 든 종합비타민이 비타민 K 상태가 낮은 와파린 복용자의 항응고 조절에 영향을 준 사례가 있었고, INR 안정화를 위한 시험에서는 비타민 K 100·150·200 μg/day가 비교됐습니다. 이는 일정한 섭취의 중요성을 보여주지만 개인별 적정량을 정한 기준은 아닙니다.",
  A2: "와파린 환자 연구에서는 어유 3–6 g/day가 INR에 통계적으로 유의한 변화를 보이지 않았고, 건강한 지원자 연구에서는 오메가-3 카복실산 4 g에서도 뚜렷한 와파린 상호작용이 관찰되지 않았습니다. 반면 와파린·트라조돈·오메가-3 병용 후 INR 8.06이 보고된 단일 증례도 있습니다.",
  B1: "결석 환자 연구에서는 칼슘 500 mg/day와 식사 중 칼슘 섭취가 평가됐고, 골다공증 환자 대상 문헌고찰에서는 보충제 칼슘이 신장결석 위험을 유의하게 높이지 않았습니다. 약 1,200 mg/day를 사용한 연구에서는 혈청과 24시간 요중 칼슘을 반복 측정했습니다.",
  B2: "무작위시험에서는 비타민 D 100,000 IU를 매달 투여해 3.3년 추적했을 때 결석이 비타민 D군 76명, 위약군 82명에서 보고됐습니다. 다른 연구에서는 50,000 IU의 반복 투여가 고칼슘뇨와 관련됐으며, 결석 재발 환자에서는 2,000 IU/day와 50,000 IU/week가 비교됐습니다.",
  B3: "비타민 C 관련 증례에서는 680 mg/day, 2 g/day, 장기간 3 g/day 복용 후 고옥살산뇨·옥살산 신병증이 보고됐습니다. 이는 위험이 시작되는 확정 기준이 아니라, 신장질환·장질환·탈수 같은 취약 조건이 있던 개별 사례입니다.",
};
const evidenceLimits: Record<string, string> = {
  A1: "현재 섭취량이 적절한지는 최근 INR 변화와 식사·보충제 섭취 패턴을 함께 봐야 합니다.",
  A2: "이 연구들은 아픽사반 복용자에게 안전한 EPA+DHA 상한을 직접 정하지 않았으므로, 현재 2,000 mg/day가 안전하다고 단정할 수 없습니다.",
  B1: "보충제 용량만으로 결석 위험을 판단할 수 없고 결석 성분과 24시간 요중 칼슘이 필요합니다.",
  B2: "투여 간격과 대상자가 달라 일일 안전용량으로 단순 환산할 수 없으며 혈청·요중 칼슘 확인이 필요합니다.",
  B3: "증례만으로 모든 사람의 안전 상한을 정할 수 없지만, 결석 또는 신장질환 병력이 있다면 고용량 노출을 가볍게 볼 수 없습니다.",
};
const actionPlans: Record<string, string> = {
  A1: "그래서 지금은 제품 라벨의 비타민 K 함량과 최근 식사 변화를 적고, 최근 INR 결과와 함께 처방기관이나 약사에게 보여 주세요. 복용량은 임의로 바꾸지 마세요.",
  A2: "그래서 지금은 제품 라벨에서 EPA와 DHA의 하루 합산량을 확인하고, 코피·멍·잇몸출혈이 생긴 날짜를 적어 처방기관이나 약사에게 보여 주세요. 출혈이 계속되거나 심해지면 바로 진료를 받으세요.",
  B1: "그래서 지금은 제품 라벨에서 원소 칼슘이 하루에 실제로 얼마인지 확인하고, 음식으로 먹는 칼슘은 따로 기록하세요. 결석 성분 결과와 이번 24시간 소변검사를 비뇨의학과나 처방기관에 가져가 복용량과 복용 시점을 확인받으세요.",
  B2: "그래서 지금은 복용 중인 모든 제품의 비타민 D 총량과 복용 기간을 적고, 최근 25(OH)D·혈청 칼슘·24시간 요중 칼슘 결과를 처방기관에 가져가 현재 용량을 계속 써도 되는지 확인받으세요.",
  B3: "그래서 지금은 여러 제품에 든 비타민 C의 하루 총량과 복용 기간을 합산하고, 결석 성분·신장기능·요중 옥살산 결과를 처방기관에 보여 주세요. 현재 용량을 계속 쓸지는 이 결과를 확인한 뒤 결정하세요.",
};
const conciseSummaries: Record<string, string> = {
  "비타민 K":
    "비타민 K는 무조건 줄이기보다 섭취량을 일정하게 유지하는 것이 중요합니다.",
  "오메가-3": "EPA와 DHA 합산량과 출혈 증상을 함께 확인해야 합니다.",
  칼슘: "음식으로 먹는 칼슘과 보충제 칼슘을 나누어 확인해야 합니다.",
  "비타민 D": "비타민 D 복용량과 칼슘 관련 검사값을 함께 확인해야 합니다.",
  "비타민 C": "비타민 C 총량과 결석·신장 관련 정보를 함께 확인해야 합니다.",
};
function describeConditionInCounseling(value: string) {
  if (/자주 남$/.test(value)) return value.replace(/자주 남$/, "자주 나고요");
  if (/병력$/.test(value)) return `${value}도 있으시고요`;
  return `${value}도 확인되고요`;
}
function withObjectParticle(value: string) {
  const last = value.at(-1) ?? "";
  const code = last.charCodeAt(0);
  const hasFinalConsonant =
    code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return `${value}${hasFinalConsonant ? "을" : "를"}`;
}
function withSubjectParticle(value: string) {
  const last = value.at(-1) ?? "";
  const code = last.charCodeAt(0);
  const hasFinalConsonant =
    code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return `${value}${hasFinalConsonant ? "이" : "가"}`;
}
function buildProfileSentence(input: SummaryInput) {
  const sentences: string[] = [];
  if (input.dose)
    sentences.push(
      `말씀해 주신 내용을 보면, ${withObjectParticle(input.ingredient)} ${input.dose} 복용하고 계십니다.`,
    );
  if (input.medication && input.condition)
    sentences.push(
      `${input.medication}도 함께 복용하고 계시고, ${describeConditionInCounseling(input.condition)}.`,
    );
  else if (input.medication)
    sentences.push(`${input.medication}도 함께 복용하고 계십니다.`);
  else if (input.condition)
    sentences.push(`${describeConditionInCounseling(input.condition)}.`);
  if (input.labs)
    sentences.push(`최근 검사에서는 ${withSubjectParticle(input.labs)} 확인됐고요.`);
  return sentences.join(" ");
}
function buildSymptomAdvice(input: SummaryInput) {
  const symptom = input.condition;
  if (!/(?:배가\s*아|복통|배\s*아픔)/.test(symptom)) return "";
  const urgent =
    /(?:갑자기|극심|심한|참기\s*힘|악화|검은\s*변|혈변|피\s*섞인\s*변|토혈|피를?\s*토|커피색\s*구토|실신|의식|식은땀)/.test(
      symptom,
    );
  if (urgent)
    return "증상부터 확인하면, 지금 적어 주신 복통에는 응급 신호가 포함될 수 있습니다. 아픽사반 같은 항응고제를 복용 중이라면 내부 출혈 가능성도 배제할 수 없으므로 지금 바로 119에 연락하거나 응급실로 가세요. 약은 임의로 중단하지 말고 복용 중인 제품과 약 목록을 가져가세요.";
  if (/(?:아픽사반|엘리퀴스|와파린|리바록사반|자렐토|에독사반|다비가트란)/i.test(input.medication))
    return "증상부터 확인하면, 배가 아픈 원인은 이 결과만으로 판단할 수 없습니다. 항응고제를 복용 중이므로 검은변·혈변·토혈, 심한 어지럼이나 실신, 갑자기 심해지는 복통이 있는지 먼저 확인하세요. 하나라도 있으면 바로 119에 연락하거나 응급실로 가세요. 그런 증상이 없어도 복통이 새로 생겼거나 계속되면 가급적 오늘 처방기관이나 의료기관에 연락하고, 약은 임의로 중단하지 마세요.";
  return "증상부터 확인하면, 배가 아픈 원인은 이 결과만으로 판단할 수 없습니다. 통증이 갑자기 심해지거나 검은변·혈변·토혈, 실신이 동반되면 바로 119에 연락하거나 응급실로 가세요. 그렇지 않아도 통증이 계속되거나 악화되면 의료기관에 연락하세요.";
}
export async function summarize(input: SummaryInput) {
  const conciseSummary = conciseSummaries[input.ingredient] ?? input.summary;
  const symptomAdvice = buildSymptomAdvice(input);
  const fallback = [
    symptomAdvice,
    buildProfileSentence(input),
    `연구 결과를 같이 보면, ${input.evidenceSummary}`,
    `다만 ${evidenceLimits[input.questionId]}`,
    actionPlans[input.questionId],
  ]
    .filter(Boolean)
    .join("\n\n");
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
              "약사가 상담실에서 차분하게 설명하듯 쓴다. 첫 문단은 '말씀해 주신 내용을 보면'으로 시작해 복용 중인 성분·용량, 병용약, 증상·병력과 최근 검사 결과를 존댓말로 자연스럽게 되짚는다. 둘째 문단은 '연구 결과를 같이 보면'으로 시작해 evidenceSummary의 연구 설계, 비교 용량과 수치를 빠뜨리지 않고 설명한다. 셋째 문단은 '다만'으로 시작해 현재 상황에 직접 적용할 수 있는 범위와 아직 답할 수 없는 범위를 설명한다. 마지막 문단은 반드시 '그래서 지금은'으로 시작하고 next에 있는 행동을 구체적으로 안내한다. 무엇을 확인·기록하고 어떤 검사 결과를 누구에게 보여 줄지 분명히 쓴다. 위험 증상이 있으면 진료 시점도 안내하되, 임의로 복용 시작·중단·증량·감량을 지시하지 않는다. 문단 사이는 빈 줄로 나눈다. 전체 700자 이하로 쓴다. 필드나 양식을 읽듯 쓰지 않는다. '입력되었습니다', '입력한 내용', '입력값', '대상자', '사용자', '프로필', '검사값', '종합하면', '핵심은', '상담 전에는', '현재 입력한 조건'은 쓰지 않는다. 모든 숫자와 단위는 그대로 포함한다. 서로 다른 연구 결과를 하나의 안전 상한처럼 합치지 않는다. 진단이나 위험을 단정하지 않는다.",
          },
          { role: "user", content: JSON.stringify(modelInput) },
        ],
        max_output_tokens: 700,
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
    return symptomAdvice ? `${symptomAdvice}\n\n${text}` : text;
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
    b.condition &&
      `${/(?:아파|통증|출혈|어지|구토|설사|코피|멍)/.test(b.condition) ? "증상" : "병력"} ${b.condition}`,
    b.labs && `검사값 ${b.labs}`,
  ].filter(Boolean) as string[];
  const ai_summary = await summarize({
    questionId: q,
    ingredient: b.ingredient,
    dose: b.dose,
    medication: b.medication,
    condition: b.condition,
    labs: b.labs,
    summary: g.summary,
    evidenceSummary: evidenceSummaries[q],
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
