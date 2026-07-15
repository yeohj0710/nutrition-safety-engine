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
    title: "비타민 K 섭취량과 와파린 효과",
    summary:
      "비타민 K는 무조건 줄이기보다 식사와 보충제로 먹는 양을 일정하게 유지해야 합니다. 식단이나 제품을 바꾼 시점과 INR이 달라진 시점을 함께 비교합니다.",
    checks: [
      "최근 식사·보충제 변경으로 비타민 K 섭취량이 달라졌는지",
      "현재 제품의 비타민 K 함량과 복용 빈도",
      "최근 INR 값과 변동 여부",
    ],
    why: "와파린 등 비타민 K 길항제의 항응고 효과는 비타민 K 섭취 변화와 관련될 수 있습니다.",
    next: [
      "제품 라벨의 비타민 K 함량을 확인하세요.",
      "최근 INR 결과와 식사·제품 변경 시점을 함께 정리하세요.",
      "섭취량을 갑자기 바꾸지 않는 것이 중요합니다.",
    ],
  },
  A2: {
    title: "오메가-3 복용량과 출혈 위험",
    summary:
      "제품의 오메가-3 총량만으로 판단하지 않습니다. EPA와 DHA의 합산량, 최근 멍·코피·잇몸출혈, 함께 먹는 약과 시술 계획을 봅니다.",
    checks: [
      "하루 EPA+DHA 합산량",
      "멍·코피·잇몸출혈 등 최근 출혈 증상",
      "아스피린·NSAID·항혈소판제 병용 여부",
    ],
    why: "오메가-3와 항응고제·항혈소판제를 함께 복용하면 최근 출혈 증상과 다른 약을 확인해야 합니다.",
    next: [
      "제품 라벨에서 EPA와 DHA 합산량을 계산하세요.",
      "최근 출혈 증상과 함께 먹는 약을 적어 두세요.",
      "시술 일정과 출혈 증상은 따로 기록해 두세요.",
    ],
  },
  B1: {
    title: "칼슘 섭취량과 신장결석 위험",
    summary:
      "음식으로 먹는 칼슘과 보충제 칼슘은 따로 계산합니다. 보충제의 원소 칼슘 함량과 복용 시점, 결석 성분, 24시간 요중 칼슘을 함께 봅니다.",
    checks: [
      "보충제로 섭취하는 칼슘의 일일량",
      "음식에서 섭취하는 칼슘과 복용 시점",
      "결석 성분과 24시간 요중 칼슘 결과",
    ],
    why: "칼슘 섭취와 결석 위험의 관계는 섭취원, 용량, 복용 시점과 개인의 대사 상태에 따라 달라질 수 있습니다.",
    next: [
      "제품 라벨의 원소 칼슘 함량을 확인하세요.",
      "식이 칼슘과 보충제 칼슘을 별도로 기록하세요.",
      "결석 분석과 24시간 소변검사 결과를 함께 비교하세요.",
    ],
  },
  B2: {
    title: "비타민 D 복용량과 칼슘 수치",
    summary:
      "비타민 D 용량만으로 판단하지 않습니다. 복용 기간, 25(OH)D, 혈청 칼슘, 24시간 요중 칼슘과 고칼슘뇨 병력을 함께 봅니다.",
    checks: [
      "비타민 D 일일 용량과 복용 기간",
      "25(OH)D와 혈청 칼슘",
      "24시간 요중 칼슘 또는 고칼슘뇨 병력",
    ],
    why: "비타민 D를 고용량으로 복용하거나 결석 병력이 있으면 혈청 칼슘과 24시간 요중 칼슘 결과가 중요합니다.",
    next: [
      "모든 제품의 비타민 D 총량을 합산하세요.",
      "최근 25(OH)D·칼슘 검사 결과를 준비하세요.",
      "검사 결과가 바뀐 시점과 복용량 변화를 함께 기록하세요.",
    ],
  },
  B3: {
    title: "비타민 C 복용량과 옥살산·결석 위험",
    summary:
      "비타민 C의 하루 총량과 복용 기간뿐 아니라 결석 성분, 신장기능, 고옥살산뇨 병력과 요중 옥살산 결과를 함께 봅니다.",
    checks: [
      "비타민 C 일일 총량과 복용 기간",
      "칼슘옥살산 결석 또는 고옥살산뇨 병력",
      "신장기능과 요중 옥살산 결과",
    ],
    why: "고용량 비타민 C는 일부 상황에서 옥살산 노출과 관련될 수 있어 위험군 확인이 필요합니다.",
    next: [
      "여러 제품에 포함된 비타민 C 총량을 합산하세요.",
      "결석 성분과 신장기능 검사 결과를 확인하세요.",
      "복용량과 검사 결과가 바뀐 시점을 함께 기록하세요.",
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
  if (!text.includes("그래서 지금")) return false;
  if (
    /(?:확인|기록|비교|계산|문의|상의)(?:하세요|해 ?주세요|해 ?두세요|받으세요)/.test(
      text,
    )
  )
    return false;
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
  A1: "그래서 지금 볼 것은 제품 라벨의 비타민 K 함량, 최근 식사 변화, INR 변화의 시점입니다. 세 항목의 날짜가 맞물리는지를 보면 섭취 변화와 INR의 관계가 더 분명해집니다.",
  A2: "그래서 지금 볼 것은 EPA와 DHA의 하루 합산량, 코피·멍·잇몸출혈 여부입니다. 현재 연구만으로 2,000 mg/day의 개인별 안전 여부를 단정할 수는 없습니다.",
  B1: "그래서 지금 볼 것은 제품 라벨의 원소 칼슘, 음식으로 먹는 칼슘, 결석 성분과 24시간 요중 칼슘입니다. 600 mg/day라는 숫자만으로 많고 적음을 정할 수는 없습니다.",
  B2: "그래서 지금 볼 것은 모든 제품의 비타민 D 총량과 복용 기간, 같은 시점의 25(OH)D·혈청 칼슘·24시간 요중 칼슘 변화입니다.",
  B3: "그래서 지금 볼 것은 여러 제품에 든 비타민 C의 하루 총량과 복용 기간, 결석 성분·신장기능·요중 옥살산의 변화입니다.",
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
function withAndParticle(value: string) {
  const last = value.at(-1) ?? "";
  const code = last.charCodeAt(0);
  const hasFinalConsonant =
    code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return `${value}${hasFinalConsonant ? "과" : "와"}`;
}
function describeConditionForAssessment(value: string) {
  if (!value) return "";
  if (value === "특별한 증상 없음") return "현재 불편한 증상은 없습니다.";
  if (/코피가 자주 남/.test(value)) return "현재 코피가 자주 납니다.";
  if (/코피가 남/.test(value)) return "현재 코피가 납니다.";
  if (/멍이 잘 듦/.test(value)) return "현재 멍이 잘 듭니다.";
  if (/잇몸 출혈/.test(value)) return "현재 잇몸에서 피가 납니다.";
  if (/(?:배가 아픔|배가 아파요)/.test(value)) return "현재 배가 아픕니다.";
  if (/INR이 자주 바뀜/.test(value)) return "INR이 자주 바뀝니다.";
  if (/소변 칼슘이 높다고 들음/.test(value))
    return "소변 칼슘이 높다는 말을 들었습니다.";
  if (/소변 옥살산이 높다고 들음/.test(value))
    return "소변 옥살산이 높다는 말을 들었습니다.";
  if (/칼슘 수치가 높다고 들음/.test(value))
    return "혈중 칼슘 수치가 높다는 말을 들었습니다.";
  if (/중$/.test(value)) return `${value}입니다.`;
  return `${withSubjectParticle(value)} 있습니다.`;
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
    sentences.push(
      `최근 검사에서는 ${withSubjectParticle(input.labs)} 확인됐고요.`,
    );
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
    return "복통이 매우 심하거나 검은변·혈변·토혈이 함께 있으면 바로 진료받으세요.";
  if (
    /(?:아픽사반|엘리퀴스|와파린|리바록사반|자렐토|에독사반|다비가트란)/i.test(
      input.medication,
    )
  )
    return "배가 아픈 증상은 오메가-3 근거와 별도로 봐야 합니다. 검은변·혈변·토혈이 함께 있으면 바로 진료가 필요한 신호입니다.";
  return "배가 아픈 증상은 보충제 근거와 별도로 봐야 합니다.";
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
              "약사가 상담실에서 차분하게 설명하듯 쓴다. 첫 문단은 '말씀해 주신 내용을 보면'으로 시작해 복용 중인 성분·용량, 병용약, 증상·병력과 최근 검사 결과를 존댓말로 자연스럽게 되짚는다. 둘째 문단은 '연구 결과를 같이 보면'으로 시작해 evidenceSummary의 연구 설계, 비교 용량과 수치를 빠뜨리지 않고 설명한다. 셋째 문단은 '다만'으로 시작해 현재 상황에 직접 적용할 수 있는 범위와 아직 답할 수 없는 범위를 설명한다. 마지막 문단은 '그래서 지금 볼 것은'으로 시작해 판단에 필요한 항목과 그 의미를 평서문으로 요약한다. '확인하세요', '기록하세요', '비교하세요', '보여 주세요', '확인받으세요', '상의하세요' 같은 지시형 문장으로 끝내지 않는다. 실제 위험 신호가 명시된 경우에만 진료 필요성을 말한다. 임의로 복용 시작·중단·증량·감량을 지시하지 않는다. 문단 사이는 빈 줄로 나눈다. 전체 700자 이하로 쓴다. 필드나 양식을 읽듯 쓰지 않는다. '입력되었습니다', '입력한 내용', '입력값', '대상자', '사용자', '프로필', '검사값', '종합하면', '핵심은', '상담 전에는', '현재 입력한 조건'은 쓰지 않는다. 모든 숫자와 단위는 그대로 포함한다. 서로 다른 연구 결과를 하나의 안전 상한처럼 합치지 않는다. 진단이나 위험을 단정하지 않는다.",
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
type AssessmentReference = { label: string; title: string; url: string };
type RuntimeEvidence = {
  title: string;
  url: string;
  dose?: string;
  outcome?: string;
  publication_types?: string;
  population?: string;
  priority_score?: number;
  [key: string]: unknown;
};
function reference(
  label: string,
  title: string,
  url: string,
): AssessmentReference {
  return { label, title, url };
}
function numberFrom(value: string) {
  const matches = value.match(/[\d,]+(?:\.\d+)?/g);
  return Number(matches?.at(-1)?.replaceAll(",", "") ?? NaN);
}
function normalizedDose(questionId: string, value: string) {
  const amount = numberFrom(value);
  if (!Number.isFinite(amount)) return amount;
  if (questionId === "B2" && /(?:μg|µg|mcg)/i.test(value)) return amount * 40;
  if (questionId === "A2" && /\bg\b/i.test(value) && !/mg/i.test(value))
    return amount * 1000;
  return amount;
}
function selectEvidence(
  all: RuntimeEvidence[],
  input: Exclude<ReturnType<typeof parseInput>, null>,
) {
  const medication = /없음|모르겠/.test(input.medication)
    ? ""
    : input.medication.toLowerCase();
  const condition = input.condition.toLowerCase();
  const ranked = all.map((item) => {
    const text =
      `${item.title} ${item.outcome ?? ""} ${item.population ?? ""}`.toLowerCase();
    let score = Number(item.priority_score ?? 0);
    const reasons: string[] = [];
    if (
      /systematic review|meta-analysis/.test(
        `${item.title} ${item.publication_types}`.toLowerCase(),
      )
    ) {
      score += 12;
      reasons.push("체계적 문헌고찰 또는 메타분석입니다.");
    } else if (
      /random|clinical trial/.test(
        `${item.title} ${item.publication_types}`.toLowerCase(),
      )
    ) {
      score += 8;
      reasons.push(
        "사람을 대상으로 한 임상시험입니다.",
      );
    }
    const medicationTerms = medication
      .split(/[^a-z0-9가-힣]+/)
      .filter((term) => term.length >= 3);
    if (medicationTerms.some((term) => text.includes(term))) {
      score += 40;
      reasons.push("복용 중인 약 이름이 제목이나 초록에 나옵니다.");
    } else if (
      medication &&
      /anticoag|warfarin|platelet|bleed|inr/.test(text)
    ) {
      score += 8;
      reasons.push(
        "같은 약을 직접 연구하지는 않았지만 항응고 작용이나 출혈 결과를 다뤘습니다.",
      );
    }
    if (
      /(코피|멍|출혈|혈변|토혈)/.test(condition) &&
      /bleed|hemorrhag|platelet|inr/.test(text)
    ) {
      score += 12;
      reasons.push(
        "현재 증상과 관련된 출혈·응고 지표를 보고했습니다.",
      );
    }
    if (
      /(결석|고칼슘뇨|옥살산)/.test(condition) &&
      /stone|calcul|hypercalciur|oxalat/.test(text)
    ) {
      score += 12;
      reasons.push(
        "현재 병력과 관련된 결석·칼슘·옥살산 결과를 보고했습니다.",
      );
    }
    return {
      ...item,
      relevance_score: score,
      selection_reason:
        reasons.join(" ") ||
        "이 보충제의 안전성 결과를 보고한 문헌입니다.",
    };
  });
  ranked.sort(
    (a, b) =>
      b.relevance_score - a.relevance_score ||
      Number(b.priority_score ?? 0) - Number(a.priority_score ?? 0),
  );
  const medicationTerms = medication
    .split(/[^a-z0-9가-힣]+/)
    .filter((term) => term.length >= 3);
  const directMedicationMatches = ranked.filter((item) =>
    medicationTerms.some((term) =>
      `${item.title} ${item.outcome ?? ""}`.toLowerCase().includes(term),
    ),
  ).length;
  return {
    selected: ranked.slice(0, 5),
    all: ranked,
    directMedicationMatches,
  };
}
function buildAssessment(
  questionId: string,
  input: ReturnType<typeof parseInput> extends infer T
    ? Exclude<T, null>
    : never,
  evidence: Array<{ title: string; url: string }>,
) {
  const dose = normalizedDose(questionId, input.dose);
  const lab = numberFrom(input.labs);
  const doseLabel = Number.isFinite(dose) ? input.dose : "현재 복용량";
  const medicationName =
    input.medication && !/없음|모르겠/.test(input.medication)
      ? input.medication
      : "";
  const conditionText = describeConditionForAssessment(input.condition);
  const context = [
    `${withObjectParticle(input.ingredient)} 복용 중입니다.`,
    /모르겠/.test(input.dose)
      ? "제품 라벨의 하루 양은 아직 모릅니다."
      : input.dose
        ? `제품 라벨의 하루 섭취량은 ${input.dose}입니다.`
        : "",
    medicationName
      ? `${withObjectParticle(medicationName)} 함께 복용 중입니다.`
      : "",
    conditionText,
    input.labs ? `최근 검사 결과는 ${input.labs}입니다.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const study = (index: number) =>
    reference(
      `논문 ${index + 1}`,
      evidence[index]?.title ?? "근거 문헌",
      evidence[index]?.url ?? "#",
    );
  const ods = {
    calcium: reference(
      "NIH 기준",
      "NIH ODS Calcium Fact Sheet",
      "https://ods.od.nih.gov/factsheets/calcium-HealthProfessional/",
    ),
    omega: reference(
      "NIH 기준",
      "NIH ODS Omega-3 Fatty Acids Fact Sheet",
      "https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/",
    ),
    vitaminK: reference(
      "NIH 기준",
      "NIH ODS Vitamin K Fact Sheet",
      "https://ods.od.nih.gov/factsheets/VitaminK-HealthProfessional/",
    ),
    vitaminD: reference(
      "NIH 기준",
      "NIH ODS Vitamin D Fact Sheet",
      "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/",
    ),
    vitaminC: reference(
      "NIH 기준",
      "NIH ODS Vitamin C Fact Sheet",
      "https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/",
    ),
  };
  if (questionId === "A1")
    return {
      context,
      verdict:
        "비타민 K는 갑자기 줄이지 말고 매일 비슷한 양을 섭취하는 편이 낫습니다.",
      dose: `${Number.isFinite(dose) ? `${dose} mcg/day라는 양` : "현재 복용량"} 자체보다 섭취량이 갑자기 바뀌는지가 INR에 더 큰 영향을 줄 수 있습니다.`,
      interaction:
        "와파린의 효과는 비타민 K 섭취량에 따라 달라질 수 있습니다. 섭취량이 갑자기 늘거나 줄면 INR도 변할 수 있습니다.",
      watch:
        "최근 INR이 달라졌다면 제품이나 식사에서 비타민 K 섭취량이 바뀐 시점과 비교해야 합니다.",
      references: [ods.vitaminK, study(0), study(1)],
    };
  if (questionId === "A2") {
    const hasAbdominalPain = /(?:배가\s*아|복통)/.test(input.condition);
    const baseVerdict =
      Number.isFinite(dose) && dose <= 5000
        ? "현재 용량은 일반 성인 기준으로는 안전 범위 안에 있습니다."
        : Number.isFinite(dose)
          ? "현재 용량은 일반 기준 5,000 mg/day보다 높습니다. 유지하기보다 줄이는 편이 낫습니다."
          : "하루 섭취량을 일반 성인 기준과 비교해야 합니다.";
    const bleedingPriority = medicationName
      ? `${withObjectParticle(medicationName)} 함께 복용 중이므로 오메가-3 용량보다 출혈 증상을 먼저 봐야 합니다.`
      : "멍·코피·잇몸출혈이 있다면 오메가-3 용량보다 출혈 증상을 먼저 봐야 합니다.";
    return {
      context,
      verdict: `${baseVerdict} ${bleedingPriority}`,
      dose: Number.isFinite(dose) && dose <= 5000
        ? `${dose.toLocaleString()} mg/day는 일반 기준 5,000 mg/day보다 낮습니다. 출혈 증상이 있으면 용량보다 증상을 먼저 봐야 합니다.`
        : Number.isFinite(dose)
          ? `${dose.toLocaleString()} mg/day는 일반 기준 5,000 mg/day보다 높습니다. 출혈 관련 약을 함께 먹거나 출혈 증상이 있으면 이 용량을 유지하지 않아야 합니다.`
        : "하루 섭취량을 모르면 일반 기준 5,000 mg/day와 비교할 수 없습니다.",
      interaction: medicationName
        ? `${withAndParticle(medicationName)} 오메가-3는 모두 출혈과 관련될 수 있습니다. 아스피린·NSAID·항혈소판제를 더 복용하면 출혈 위험이 커질 수 있습니다.`
        : "오메가-3는 출혈과 관련될 수 있습니다. 아스피린·NSAID·항혈소판제를 함께 복용하면 출혈 위험이 커질 수 있습니다.",
      watch: hasAbdominalPain
        ? "복통만으로 출혈을 판단할 수는 없습니다. 검은변·혈변·토혈이 함께 나타나는지가 더 중요합니다."
        : "멍·코피·잇몸출혈·혈변이 새로 생기거나 심해지는지 봐야 합니다.",
      references: [ods.omega, study(0), study(4)],
    };
  }
  if (questionId === "B1") {
    const highUrineCalcium = Number.isFinite(lab) && lab > 275;
    return {
      context,
      verdict: highUrineCalcium
          ? `현재 ${doseLabel}를 그대로 유지하기에는 적합하지 않습니다. 요중 칼슘과 결석 병력을 고려하면 줄이는 편이 낫습니다.`
        : Number.isFinite(dose)
          ? `${doseLabel} 자체는 성인 총섭취 상한보다 낮습니다. 음식으로 먹는 칼슘까지 더해야 현재 용량을 유지해도 되는지 판단할 수 있습니다.`
          : "복용량을 모르면 현재 용량을 유지해도 되는지 판단할 수 없습니다. 제품 라벨의 원소 칼슘과 음식으로 먹는 칼슘을 더한 양이 필요합니다.",
      dose: Number.isFinite(dose)
        ? `성인 칼슘 상한은 음식과 보충제를 합쳐 2,000–2,500 mg/day입니다. 보충제 ${input.dose}만으로 상한을 넘지는 않습니다.`
        : "성인 칼슘 상한은 음식과 보충제를 합쳐 2,000–2,500 mg/day입니다.",
      interaction:
        "레보티록신, 퀴놀론계 항생제, 돌루테그라비르의 흡수를 떨어뜨릴 수 있어 복용 시간 간격이 중요합니다.",
      watch: highUrineCalcium
        ? `${lab} mg/day는 NIH가 제시한 고칼슘뇨 기준보다 높습니다. 결석 병력까지 있으므로 총 칼슘 섭취량과 복용 시점을 조정할 근거가 됩니다.`
        : "결석 병력에서는 보충제 양보다 결석 성분, 식이 칼슘, 24시간 요중 칼슘을 함께 봅니다.",
      references: [ods.calcium, study(0), study(1)],
    };
  }
  if (questionId === "B2")
    return {
      context,
      verdict:
        Number.isFinite(dose) && dose >= 4000
          ? `현재 ${input.dose}는 ${dose === 4000 ? "성인 상한 4,000 IU/day와 같습니다" : "성인 상한 4,000 IU/day보다 높습니다"}. 결석이나 고칼슘뇨 병력이 있다면 늘리기보다 줄이는 편이 낫습니다.`
          : "현재 용량은 성인 상한 아래이지만 결석·고칼슘뇨가 있으면 칼슘 검사와 함께 판단합니다.",
      dose: "성인 비타민 D 상한은 4,000 IU/day입니다. 상한은 권장량이 아니라 넘기지 말아야 할 총량 기준입니다.",
      interaction:
        "티아지드 이뇨제는 고칼슘혈증 위험을 높일 수 있고, 올리스타트는 비타민 D 흡수를 낮출 수 있습니다.",
      watch:
        "25(OH)D만 보지 말고 혈청 칼슘과 24시간 요중 칼슘도 함께 봐야 합니다.",
      references: [ods.vitaminD, study(0), study(1)],
    };
  const vitaminCHighRisk = /(옥살산|결석|신장기능|신장 질환|신장질환)/.test(
    `${input.condition} ${input.labs}`,
  );
  return {
    context,
    verdict:
      vitaminCHighRisk && !Number.isFinite(dose)
        ? "복용량은 아직 모르지만 요중 옥살산 상승 또는 결석·신장 관련 조건이 있으므로, 고용량 비타민 C를 유지하지 않는 쪽이 맞습니다."
        : vitaminCHighRisk
          ? "일반 성인 상한 아래라도 결석·고옥살산뇨·신장기능 저하가 있으면 현재 용량을 유지하기보다 줄이는 쪽이 맞습니다."
          : Number.isFinite(dose) && dose >= 1000
            ? "현재 용량은 일반 성인 상한 아래이지만 고용량에 해당하므로, 장기 유지보다 총량과 복용 기간을 다시 판단해야 합니다."
            : Number.isFinite(dose)
              ? "현재 용량은 일반 성인 상한 아래입니다. 결석·고옥살산뇨·신장기능 저하가 없다면 고위험 조건은 확인되지 않았습니다."
              : "복용량을 모르면 유지 여부를 판단할 수 없습니다. 제품 라벨의 하루 비타민 C 총량을 먼저 확인해야 합니다.",
    dose: "성인 비타민 C 상한은 2,000 mg/day이지만, 결석 위험군의 안전선이 2,000 mg/day라는 뜻은 아닙니다.",
    interaction:
      "철 과다증에서는 철 흡수를 늘릴 수 있고, 일부 검사 결과에도 영향을 줄 수 있습니다.",
    watch: vitaminCHighRisk
      ? "제품 라벨에서 하루 총량을 확인해야 합니다. 요중 옥살산 상승, 칼슘옥살산 결석 또는 신장기능 저하가 확인되면 고용량을 피해야 합니다."
      : "요중 옥살산 상승, 칼슘옥살산 결석 또는 신장기능 저하가 새로 확인되면 고용량을 유지하지 않아야 합니다.",
    references: [ods.vitaminC, study(0), study(1)],
  };
}
export async function POST(req: Request) {
  const b = parseInput(await req.json().catch(() => null));
  if (!b)
    return NextResponse.json(
      {
        error:
          "작성한 내용이 너무 길거나 형식에 맞지 않습니다. 각 입력란을 확인한 뒤 다시 시도하세요.",
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
    b.dose && `하루 섭취량 ${b.dose}`,
    b.medication &&
      !/없음|모르겠/.test(b.medication) &&
      `함께 먹는 약 ${b.medication}`,
    b.condition &&
      `${/(?:아파|통증|출혈|어지|구토|설사|코피|멍)/.test(b.condition) ? "현재 증상" : "증상·병력"} ${b.condition}`,
    b.labs && `검사 결과 ${b.labs}`,
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
  const evidenceSelection = selectEvidence(r.all_evidence, b);
  const assessment = buildAssessment(q, b, evidenceSelection.selected);
  return NextResponse.json(
    {
      question_id: q,
      ingredient: b.ingredient,
      title: g.title,
      summary: g.summary,
      ai_summary,
      assessment,
      profile: entered,
      checks: g.checks,
      why: g.why,
      next_steps: g.next,
      evidence: evidenceSelection.selected,
      all_evidence: evidenceSelection.all,
      evidence_selection: {
        selected: evidenceSelection.selected.length,
        total_candidates: evidenceSelection.all.length,
        direct_medication_matches: evidenceSelection.directMedicationMatches,
        medication_name:
          b.medication && !/없음|모르겠/.test(b.medication)
            ? b.medication
            : "",
        method:
          "체계적 문헌고찰·메타분석·임상시험을 먼저 보고, 복용 중인 약과 병력·증상을 직접 다룬 문헌을 위에 배치했습니다.",
      },
      interpretation:
        "이 결과는 상담 준비를 위한 근거 요약입니다. 복용 시작·중단·용량 변경을 직접 지시하지 않습니다.",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
