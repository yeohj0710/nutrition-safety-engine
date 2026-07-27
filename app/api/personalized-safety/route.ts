import { NextResponse } from "next/server";
import rules from "@/research/systematic_review_v30/personalized_rules.json";
import { splitMultiValue } from "@/src/lib/multi-value-input";
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
type SummaryInput = {
  questionId: string;
  ingredient: string;
  dose: string;
  medication: string;
  condition: string;
  labs: string;
  summary: string;
  evidenceSummary: string;
  evidenceLimit: string;
  actionPlan: string;
  profile: string[];
  checks: string[];
  why: string;
  next: string[];
};
// 연구 서술은 상수로 두지 않는다. v3.0 선별을 통과해 이번 응답에 실제로 선택된 문헌에서만
// 만든다. 선택된 문헌이 없으면 없다고 적고, 문헌이 뒷받침하지 않는 주장을 대신 채우지 않는다.
function studyKindLabel(item: RuntimeEvidence) {
  const types = String(item.publication_types ?? "");
  const year = item.year ? `${item.year}년 ` : "";
  if (/systematic review|meta-analysis/i.test(types))
    return `${year}체계적 문헌고찰`;
  if (/randomized controlled trial/i.test(types)) return `${year}무작위 대조시험`;
  if (/clinical trial/i.test(types)) return `${year}임상시험`;
  if (/case reports/i.test(types)) return `${year}증례 보고`;
  if (/review/i.test(types)) return `${year}문헌고찰`;
  return `${year}연구`;
}
function evidenceFindingText(item: RuntimeEvidence) {
  return String(item.key_finding_ko ?? item.key_finding ?? "")
    .replace(/\s+/g, " ")
    .trim();
}
// 인용은 문장 경계에서만 줄인다. 문장 중간을 잘라 의미가 뒤집히는 일이 없어야 하고,
// 줄인 경우에는 줄였다고 밝힌 뒤 전문을 볼 위치를 알린다.
const QUOTE_LIMIT = 220;
function trimToSentences(text: string) {
  if (text.length <= QUOTE_LIMIT) return { text, trimmed: false };
  const sentences = text.split(/(?<=[.!?])\s+/);
  let kept = "";
  for (const sentence of sentences) {
    const next = kept ? `${kept} ${sentence}` : sentence;
    if (kept && next.length > QUOTE_LIMIT) break;
    kept = next;
    if (kept.length >= QUOTE_LIMIT) break;
  }
  return { text: kept || sentences[0], trimmed: (kept || sentences[0]).length < text.length };
}
const doseLabelFor = (dose: string) =>
  dose && !/모르겠/.test(dose) ? dose : "현재 복용량";
function buildEvidenceSummary(
  evidence: RuntimeEvidence[],
  directMedicationMatches: number,
  medicationName: string,
) {
  if (!evidence.length)
    return "선별을 통과한 문헌 가운데 이 조합에 연결된 것이 없습니다. 아래 설명은 공개 기준 자료에만 근거합니다.";
  const top = evidence[0];
  const finding = evidenceFindingText(top);
  const shortened = trimToSentences(finding);
  const quoted = finding
    ? `${studyKindLabel(top)}의 핵심 소견은 “${shortened.text}”입니다.${
        shortened.trimmed ? " 나머지 문장은 아래 근거 목록에 있습니다." : ""
      }`
    : "";
  const head = `이번 판단에 연결된 문헌은 ${evidence.length}건입니다.`;
  const gap =
    medicationName && directMedicationMatches === 0
      ? ` 다만 ${withObjectParticle(medicationName)} 직접 다룬 연구는 이 가운데 없습니다.`
      : "";
  return `${head} ${quoted}${gap}`.trim();
}
function buildEvidenceLimit(
  evidence: RuntimeEvidence[],
  directMedicationMatches: number,
  ingredient: string,
  medicationName: string,
  dose: string,
) {
  const doseText = doseLabelFor(dose);
  if (!evidence.length)
    return `이 조합에 연결된 문헌이 없어 ${doseText}의 개인별 안전 여부를 문헌으로 뒷받침할 수 없습니다.`;
  const body =
    medicationName && directMedicationMatches === 0
      ? `이 문헌들은 ${withObjectParticle(medicationName)} 직접 연구하지 않았고, ${ingredient}의 개인별 안전 상한도 정하지 않았습니다.`
      : `이 문헌들은 ${ingredient}의 개인별 안전 상한을 정하지 않았습니다.`;
  return `${body} 따라서 ${doseText}가 안전하다고 단정할 수 없습니다.`;
}
const actionWatchLists: Record<string, string> = {
  A1: "제품 라벨의 비타민 K 함량, 최근 식사 변화, INR 변화의 시점",
  A2: "EPA와 DHA의 하루 합산량, 코피·멍·잇몸출혈 여부",
  B1: "제품 라벨의 원소 칼슘, 음식으로 먹는 칼슘, 결석 성분과 24시간 요중 칼슘",
  B2: "모든 제품의 비타민 D 총량과 복용 기간, 같은 시점의 25(OH)D·혈청 칼슘·24시간 요중 칼슘 변화",
  B3: "여러 제품에 든 비타민 C의 하루 총량과 복용 기간, 결석 성분·신장기능·요중 옥살산의 변화",
};
function buildActionPlan(questionId: string, dose: string) {
  return `그래서 지금 볼 것은 ${actionWatchLists[questionId]}입니다. 현재 연결된 문헌만으로 ${doseLabelFor(dose)}의 개인별 안전 여부를 단정할 수는 없습니다.`;
}
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
function medicationValues(value: string) {
  return splitMultiValue(value).filter((item) => !/없음|모르겠/.test(item));
}
function conditionValues(value: string) {
  const values = splitMultiValue(value);
  const specificValues = values.filter((item) => item !== "특별한 증상 없음");
  return specificValues.length ? specificValues : values;
}
function compactMultiValue(values: string[]) {
  return values.join("·");
}
function isSentenceLikeFreeText(value: string) {
  return /(?:다|요|죠|음|함|같아|같음|모름|들음)\s*[.!?。！？]*$/.test(
    value.trim(),
  );
}
function describeConditionForAssessment(value: string) {
  if (!value) return "";
  if (value === "특별한 증상 없음") return "현재 불편한 증상은 없습니다.";
  if (/코피가 자주 남/.test(value)) return "현재 코피가 자주 납니다.";
  if (/코피가 남/.test(value)) return "현재 코피가 납니다.";
  if (/멍이 잘 듦/.test(value)) return "현재 멍이 잘 듭니다.";
  if (/잇몸 출혈/.test(value)) return "현재 잇몸에서 피가 납니다.";
  if (/검은변 또는 혈변/.test(value))
    return "현재 검은변 또는 혈변이 있습니다.";
  if (/(?:배가 아픔|배가 아파요)/.test(value)) return "현재 배가 아픕니다.";
  if (/메스꺼움/.test(value)) return "현재 메스꺼움이 있습니다.";
  if (/갈증이 심하고 소변이 잦음/.test(value))
    return "현재 갈증이 심하고 소변이 자주 나옵니다.";
  if (/설사/.test(value)) return "현재 설사가 있습니다.";
  if (/INR이 자주 바뀜/.test(value)) return "INR이 자주 바뀝니다.";
  if (/소변 칼슘이 높다고 들음/.test(value))
    return "소변 칼슘이 높다는 말을 들었습니다.";
  if (/소변 옥살산이 높다고 들음/.test(value))
    return "소변 옥살산이 높다는 말을 들었습니다.";
  if (/칼슘 수치가 높다고 들음/.test(value))
    return "혈중 칼슘 수치가 높다는 말을 들었습니다.";
  if (/중$/.test(value)) return `${value}입니다.`;
  if (!isSentenceLikeFreeText(value))
    return `${withSubjectParticle(value)} 있습니다.`;
  const quoted = value.replace(/[.!?。！？]+$/, "").trim();
  return `증상·병력으로 “${quoted}”라고 적은 내용을 반영했습니다.`;
}
function describeConditionForCounselingContext(value: string) {
  if (!value) return "";
  if (value === "특별한 증상 없음")
    return "현재 불편한 증상은 없다고 하셨어요.";
  if (/코피가 자주 남/.test(value))
    return "현재 코피가 자주 난다고 하셨어요.";
  if (/코피가 남/.test(value)) return "현재 코피가 난다고 하셨어요.";
  if (/멍이 잘 듦/.test(value)) return "현재 멍이 잘 든다고 하셨어요.";
  if (/잇몸 출혈/.test(value))
    return "현재 잇몸에서 피가 난다고 하셨어요.";
  if (/검은변 또는 혈변/.test(value))
    return "현재 검은변 또는 혈변이 있다고 하셨어요.";
  if (/(?:배가 아픔|배가 아파요)/.test(value))
    return "현재 배가 아프다고 하셨어요.";
  if (/메스꺼움/.test(value)) return "현재 메스꺼움이 있다고 하셨어요.";
  if (/갈증이 심하고 소변이 잦음/.test(value))
    return "현재 갈증이 심하고 소변이 자주 나온다고 하셨어요.";
  if (/설사/.test(value)) return "현재 설사가 있다고 하셨어요.";
  if (/INR이 자주 바뀜/.test(value)) return "INR이 자주 바뀐다고 하셨어요.";
  if (/소변 칼슘이 높다고 들음/.test(value))
    return "소변 칼슘이 높다는 말을 들으셨네요.";
  if (/소변 옥살산이 높다고 들음/.test(value))
    return "소변 옥살산이 높다는 말을 들으셨네요.";
  if (/칼슘 수치가 높다고 들음/.test(value))
    return "혈중 칼슘 수치가 높다는 말을 들으셨네요.";
  if (/병력$/.test(value)) return `${withSubjectParticle(value)} 있다고 하셨어요.`;
  if (/중$/.test(value)) return `${value}이라고 하셨어요.`;
  if (!isSentenceLikeFreeText(value)) return `${value}도 있다고 하셨어요.`;
  const quoted = value.replace(/[.!?。！？]+$/, "").trim();
  return `증상이나 병력은 “${quoted}”이라고 말씀하셨어요.`;
}
function buildProfileSentence(input: SummaryInput) {
  const sentences: string[] = [];
  const medicines = medicationValues(input.medication);
  const conditions = conditionValues(input.condition);
  const medicineName = compactMultiValue(medicines);
  if (input.dose)
    sentences.push(
      `말씀해 주신 내용을 보면, ${withObjectParticle(input.ingredient)} ${input.dose} 복용하고 계십니다.`,
    );
  if (medicineName && conditions.length === 1)
    sentences.push(
      `${medicineName}도 함께 복용하고 계시고, ${describeConditionInCounseling(conditions[0])}.`,
    );
  else {
    if (medicineName)
      sentences.push(`${medicineName}도 함께 복용하고 계십니다.`);
    if (conditions.length === 1)
      sentences.push(`${describeConditionInCounseling(conditions[0])}.`);
    else if (conditions.length > 1)
      sentences.push(...conditions.map(describeConditionForAssessment));
  }
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
function buildSummaryFallback(input: SummaryInput) {
  const symptomAdvice = buildSymptomAdvice(input);
  return [
    symptomAdvice,
    buildProfileSentence(input),
    `연구 결과를 같이 보면, ${input.evidenceSummary}`,
    `다만 ${input.evidenceLimit}`,
    input.actionPlan,
  ]
    .filter(Boolean)
    .join("\n\n");
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
type ParsedInput = Exclude<ReturnType<typeof parseInput>, null>;
type InputInterpretation = {
  input: ParsedInput;
  aiUsed: boolean;
  changed: boolean;
};
const interpretedInputKeys = [
  "dose",
  "medication",
  "condition",
  "labs",
] as const;
type GroundedConcept = { candidate: RegExp; source: RegExp };
const medicationConcepts: GroundedConcept[] = [
  {
    candidate: /아픽사반|엘리퀴스/i,
    source: /아픽사반|엘리퀴스|apixaban|eliquis/i,
  },
  {
    candidate: /리바록사반|자렐토/i,
    source: /리바록사반|자렐토|rivaroxaban|xarelto/i,
  },
  {
    candidate: /와파린|쿠마딘/i,
    source: /와파린|쿠마딘|warfarin|coumadin/i,
  },
  { candidate: /아스피린/i, source: /아스피린|aspirin|ASA/i },
  {
    candidate: /클로피도그렐|플라빅스/i,
    source: /클로피도그렐|플라빅스|clopidogrel|plavix/i,
  },
  {
    candidate: /진통소염제|NSAID|이부프로펜|나프록센/i,
    source: /진통소염제|NSAID|이부프로펜|나프록센|ibuprofen|naproxen/i,
  },
  {
    candidate: /레보티록신|씬지로이드|신지로이드/i,
    source: /레보티록신|씬지로이드|신지로이드|levothyroxine|synthroid/i,
  },
  {
    candidate: /퀴놀론|레보플록사신|시프로플록사신|목시플록사신/i,
    source: /퀴놀론|레보플록사신|시프로플록사신|목시플록사신|levofloxacin|ciprofloxacin|moxifloxacin/i,
  },
  { candidate: /돌루테그라비르/i, source: /돌루테그라비르|dolutegravir/i },
  { candidate: /리튬/i, source: /리튬|lithium/i },
  { candidate: /티아지드/i, source: /티아지드|thiazide/i },
  { candidate: /올리스타트/i, source: /올리스타트|orlistat/i },
  {
    candidate: /스테로이드|프레드니|덱사메타손/i,
    source: /스테로이드|프레드니|덱사메타손|steroid|predni|dexamethasone/i,
  },
  {
    candidate: /스타틴|아토르바스타틴|로수바스타틴|심바스타틴/i,
    source: /스타틴|아토르바스타틴|로수바스타틴|심바스타틴|statin|atorvastatin|rosuvastatin|simvastatin/i,
  },
];
const conditionConcepts: GroundedConcept[] = [
  { candidate: /코피|비출혈/, source: /코피|비출혈|코.{0,6}피/ },
  { candidate: /멍|반상출혈/, source: /멍|반상출혈/ },
  { candidate: /잇몸.*출혈|잇몸.*피/, source: /잇몸.{0,6}(?:출혈|피)/ },
  { candidate: /검은변|혈변/, source: /검은\s*변|혈변|피.{0,6}변/ },
  { candidate: /신장결석|요로결석/, source: /신장결석|요로결석|결석|콩팥.{0,6}돌/ },
  { candidate: /신장기능|콩팥기능/, source: /신장|콩팥|eGFR|크레아티닌/i },
  { candidate: /옥살산/, source: /옥살산/ },
  { candidate: /칼슘/, source: /칼슘/ },
];
const labConcepts: GroundedConcept[] = [
  { candidate: /INR/i, source: /INR/i },
  { candidate: /칼슘/, source: /칼슘/ },
  { candidate: /옥살산/, source: /옥살산/ },
  {
    candidate: /25\s*\(OH\)\s*D|비타민\s*D/i,
    source: /25\s*\(OH\)\s*D|비타민\s*D/i,
  },
  { candidate: /eGFR|사구체/i, source: /eGFR|사구체/i },
];
function conceptsAreGrounded(
  source: string,
  candidate: string,
  concepts: GroundedConcept[],
) {
  return concepts.every(
    (concept) => !concept.candidate.test(candidate) || concept.source.test(source),
  );
}
function exactNumericTokens(value: string) {
  return (value.match(/\d[\d,]*(?:\.\d+)?/g) ?? [])
    .map((token) => token.replaceAll(",", ""))
    .sort();
}
function isGroundedInterpretation(source: ParsedInput, candidate: ParsedInput) {
  if (candidate.ingredient !== source.ingredient) return false;
  if (
    !conceptsAreGrounded(
      source.medication,
      candidate.medication,
      medicationConcepts,
    ) ||
    !conceptsAreGrounded(
      source.condition,
      candidate.condition,
      conditionConcepts,
    ) ||
    !conceptsAreGrounded(source.labs, candidate.labs, labConcepts)
  )
    return false;
  for (const key of interpretedInputKeys) {
    const before = source[key];
    const after = candidate[key];
    if (!before && after) return false;
    if (before && !after) return false;
    if (
      exactNumericTokens(before).join("|") !==
      exactNumericTokens(after).join("|")
    )
      return false;
    if (
      /(?:복용을?\s*(?:중단|시작)|증량|감량|진단|처방|안전하(?:다|다고)|위험하(?:다|다고))/.test(
        after,
      )
    )
      return false;
  }
  return true;
}
function normalizeInterpretedCondition(value: unknown) {
  return String(value ?? "")
    .replace(/(?:코피|비출혈)\s*빈발/g, "코피가 자주 남")
    .replace(/(^|[ ·,;])오심(?=$|[ ·,;])/g, "$1메스꺼움")
    .trim();
}
async function interpretFreeText(input: ParsedInput): Promise<InputInterpretation> {
  const fallback = { input, aiUsed: false, changed: false };
  if (!process.env.OPENAI_API_KEY) return fallback;
  if (!interpretedInputKeys.some((key) => input[key])) return fallback;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
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
              "보충제 안전성 입력을 판정하지 말고 구조화만 한다. 사용자가 쓴 사실을 유지하면서 일상 표현과 띄어쓰기를 표준화한다. dose는 숫자와 단위를 보존한다. medication은 상품명이 분명할 때만 '상품명(성분명)'으로 보강하고 여러 약은 ' · '로 구분한다. condition은 '코피가 자주 남', '멍이 잘 듦', '메스꺼움'처럼 일반인이 읽는 자연스러운 표현으로 정리하고 여러 항목은 ' · '로 구분한다. '빈발', '오심' 같은 의무기록 축약은 쓰지 않는다. labs는 검사 이름, 수치, 단위를 원래 순서대로 보존하고 여러 검사는 ' · '로 구분한다. 원문에 없는 약, 증상, 검사, 숫자, 단위, 진단 또는 복용 지시를 만들지 않는다. 불확실하면 원문을 그대로 반환한다.",
          },
          { role: "user", content: JSON.stringify(input) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "supplement_input_interpretation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                dose: { type: "string" },
                medication: { type: "string" },
                condition: { type: "string" },
                labs: { type: "string" },
              },
              required: ["dose", "medication", "condition", "labs"],
            },
          },
        },
        max_output_tokens: 400,
      }),
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    const outputText = String(
      data.output_text ??
        data.output
          ?.flatMap(
            (item: { content?: Array<{ text?: string }> }) =>
              item.content ?? [],
          )
          .map((item: { text?: string }) => item.text ?? "")
          .join("") ??
        "",
    ).trim();
    const interpreted = JSON.parse(outputText) as Record<string, unknown>;
    const candidate = parseInput({
      ingredient: input.ingredient,
      dose: interpreted.dose,
      medication: interpreted.medication,
      condition: normalizeInterpretedCondition(interpreted.condition),
      labs: interpreted.labs,
    });
    if (!candidate || !isGroundedInterpretation(input, candidate))
      return fallback;
    return {
      input: candidate,
      aiUsed: true,
      changed: interpretedInputKeys.some((key) => candidate[key] !== input[key]),
    };
  } catch {
    return fallback;
  }
}
type AssessmentReference = {
  label: string;
  title: string;
  url: string;
  summary_ko?: string;
};
type RuntimeEvidence = {
  title: string;
  url: string;
  dose?: string;
  outcome?: string;
  locator?: string;
  key_finding?: string;
  key_finding_ko?: string;
  publication_types?: string;
  population?: string;
  priority_score?: number;
  [key: string]: unknown;
};
type RuntimeRule = {
  question_id: string;
  source_question_id?: string;
  all_evidence: RuntimeEvidence[];
};
function reference(
  label: string,
  title: string,
  url: string,
  summary_ko?: string,
): AssessmentReference {
  return { label, title, url, summary_ko };
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

type EvidenceMedicationAlias = {
  input: RegExp;
  direct: RegExp[];
  related: RegExp[];
};

const evidenceMedicationAliases: EvidenceMedicationAlias[] = [
  {
    input: /와파린|쿠마딘|warfarin/i,
    direct: [/\bwarfarin\b/i],
    related: [/vitamin k antagonist|\bvka\b|anticoag/i],
  },
  {
    input: /아픽사반|엘리퀴스|apixaban|eliquis/i,
    direct: [/\bapixaban\b|\beliquis\b/i],
    related: [/anticoag|warfarin|bleed|hemorrhag|\binr\b/i],
  },
  {
    input: /리바록사반|자렐토|rivaroxaban|xarelto/i,
    direct: [/\brivaroxaban\b|\bxarelto\b/i],
    related: [/anticoag|warfarin|bleed|hemorrhag|\binr\b/i],
  },
  {
    input: /다비가트란|프라닥사|dabigatran|pradaxa/i,
    direct: [/\bdabigatran\b|\bpradaxa\b/i],
    related: [/anticoag|warfarin|bleed|hemorrhag|\binr\b/i],
  },
  {
    input: /아스피린|aspirin|acetylsalicylic|\basa\b/i,
    direct: [/\baspirin\b|acetylsalicylic|\basa\b/i],
    related: [/antiplatelet|platelet/i],
  },
  {
    input: /클로피도그렐|clopidogrel|plavix/i,
    direct: [/\bclopidogrel\b|\bplavix\b/i],
    related: [/antiplatelet|platelet/i],
  },
  {
    input: /티아지드|히드로클로로티아지드|hydrochlorothiazide|thiazide/i,
    direct: [/hydrochlorothiazide|thiazide/i],
    related: [/diuretic|hypercalcem|serum calcium/i],
  },
  {
    input: /레보티록신|갑상선약|levothyroxine|synthroid/i,
    direct: [/levothyroxine|synthroid/i],
    related: [/\bthyroid\b/i],
  },
  {
    input: /퀴놀론|ciprofloxacin|levofloxacin|quinolone/i,
    direct: [/quinolone|ciprofloxacin|levofloxacin/i],
    related: [/antibiotic/i],
  },
  {
    input: /돌루테그라비르|dolutegravir|tivicay/i,
    direct: [/dolutegravir|tivicay/i],
    related: [/antiretroviral|integrase inhibitor/i],
  },
  {
    input: /리튬|lithium/i,
    direct: [/\blithium\b/i],
    related: [/hypercalcem|serum calcium/i],
  },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function evidenceMedicationPatterns(value: string) {
  const direct: RegExp[] = [];
  const related: RegExp[] = [];
  for (const medicine of medicationValues(value)) {
    const alias = evidenceMedicationAliases.find((candidate) =>
      candidate.input.test(medicine),
    );
    if (alias) {
      direct.push(...alias.direct);
      related.push(...alias.related);
      continue;
    }
    const words = medicine.trim().split(/\s+/).filter(Boolean);
    if (words.join("").length < 3) continue;
    const phrase = words.map(escapeRegExp).join("\\s+");
    const boundaries = /^[a-z0-9]/i.test(medicine) ? "\\b" : "";
    direct.push(new RegExp(`${boundaries}${phrase}${boundaries}`, "i"));
  }
  return { direct, related };
}

function evidenceDoseAmounts(questionId: string, value: string) {
  const amounts: number[] = [];
  const gramAmounts: number[] = [];
  const pattern =
    /(?:(\d[\d, ]*(?:\.\d+)?)\s*(?:-|–|—|to)\s*)?(\d[\d, ]*(?:\.\d+)?)\s*(international units?|iu|μg|µg|mcg|milligrams?|mg|grams?|g)\b/gi;
  for (const match of value.matchAll(pattern)) {
    const unit = match[3].toLowerCase().replace("µ", "μ");
    for (const rawAmount of [match[1], match[2]].filter(Boolean)) {
      const amount = Number(rawAmount.replace(/[\s,]/g, ""));
      if (!Number.isFinite(amount)) continue;
      if (questionId === "A1" && /^(?:μg|mcg)$/.test(unit)) {
        amounts.push(amount);
      } else if (questionId === "B2") {
        if (/^(?:iu|international unit)/.test(unit)) amounts.push(amount);
        else if (/^(?:μg|mcg)$/.test(unit)) amounts.push(amount * 40);
      } else if (["A2", "B1", "B3"].includes(questionId)) {
        if (/^(?:g|gram)/.test(unit)) {
          amounts.push(amount * 1000);
          if (questionId === "A2") gramAmounts.push(amount * 1000);
        } else if (/^(?:mg|milligram)/.test(unit)) amounts.push(amount);
      }
    }
  }
  if (questionId === "A2" && gramAmounts.length) return gramAmounts;
  return amounts;
}

function reportsComparableDose(
  questionId: string,
  inputDose: string,
  evidence: RuntimeEvidence,
) {
  const target = normalizedDose(questionId, inputDose);
  if (!Number.isFinite(target) || target <= 0) return false;
  const amounts = [
    ...new Set(
      evidenceDoseAmounts(
        questionId,
        `${evidence.dose ?? ""} ${evidence.key_finding ?? ""}`,
      ),
    ),
  ];
  if (questionId === "B1" && amounts.length !== 1) return false;
  const tolerance = questionId === "B1" ? 0.2 : 0.1;
  return amounts.some((amount) => Math.abs(amount - target) / target <= tolerance);
}

function selectEvidence(
  questionId: string,
  all: RuntimeEvidence[],
  input: Exclude<ReturnType<typeof parseInput>, null>,
) {
  const medication = medicationValues(input.medication).join(" ").toLowerCase();
  const clinicalInput = `${input.condition} ${input.labs}`.toLowerCase();
  const hasClinicalRiskModifier =
    /(코피|멍|출혈|혈변|토혈|잇몸|결석|고칼슘뇨|고칼슘혈증|요중.{0,12}칼슘|소변.{0,12}칼슘|혈청.{0,12}칼슘|혈중.{0,12}칼슘|옥살산|옥살레이트|신장기능|신기능|egfr|신부전|콩팥|inr)/.test(
      clinicalInput,
    );
  const medicationPatterns = evidenceMedicationPatterns(input.medication);
  const ranked = all.map((item) => {
    const text =
      `${item.title} ${item.outcome ?? ""} ${item.population ?? ""} ${item.locator ?? ""} ${item.key_finding ?? ""}`.toLowerCase();
    let score = Number(item.priority_score ?? 0);
    const reasons: string[] = [];
    if (
      /systematic review|meta-analysis/.test(
        `${item.title} ${item.publication_types}`.toLowerCase(),
      )
    ) {
      score += 16;
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
    const directlyMatchesMedication = medicationPatterns.direct.some((pattern) =>
      pattern.test(text),
    );
    if (directlyMatchesMedication) {
      score += 40;
      reasons.push("입력한 약을 직접 다룬 문헌입니다.");
    } else if (
      medication &&
      medicationPatterns.related.some((pattern) => pattern.test(text))
    ) {
      score += 8;
      reasons.push(
        "입력한 약을 직접 연구하지는 않았지만 같은 약물 계열이나 관련 안전성 결과를 다뤘습니다.",
      );
    }
    if (
      /(코피|멍|출혈|혈변|토혈|잇몸)/.test(clinicalInput) &&
      /bleed|hemorrhag|platelet|inr/.test(text)
    ) {
      score += 12;
      reasons.push(
        "현재 증상과 관련된 출혈·응고 지표를 보고했습니다.",
      );
    }
    if (
      /결석/.test(clinicalInput) &&
      /stone|calcul|hypercalciur|oxalat/.test(text)
    ) {
      score += 24;
      reasons.push(
        "현재 병력과 관련된 결석·칼슘·옥살산 결과를 보고했습니다.",
      );
    }
    if (
      /(고칼슘혈증|혈청\s*칼슘|혈중\s*칼슘|칼슘\s*수치가\s*높)/.test(
        clinicalInput,
      ) && /hypercalcem|serum calcium|calcium level/.test(text)
    ) {
      score += 18;
      reasons.push("입력한 혈중 칼슘 결과와 관련된 고칼슘혈증을 보고했습니다.");
    }
    if (
      /(고칼슘뇨|요중.{0,12}칼슘|소변.{0,12}칼슘|24시간.{0,12}칼슘)/.test(
        clinicalInput,
      ) && /hypercalciur|urinary calcium|urine calcium|24(?:-h| hour) urine calcium/.test(text)
    ) {
      score += 18;
      reasons.push("입력한 요중 칼슘 결과와 관련된 고칼슘뇨를 보고했습니다.");
    }
    if (
      /(옥살산|옥살레이트)/.test(clinicalInput) &&
      /oxalat/.test(text)
    ) {
      score += 18;
      reasons.push("입력한 옥살산 결과와 관련된 요중 옥살산을 보고했습니다.");
    }
    if (
      /(신장기능|신기능|egfr|신부전|콩팥)/.test(clinicalInput) &&
      /renal failure|kidney (?:injury|disease|function)|renal (?:disease|insufficiency|function)|nephropath|oxalosis/.test(
        text,
      )
    ) {
      score += 24;
      reasons.push("입력한 신장기능 저하와 관련된 신손상·신병증을 보고했습니다.");
    }
    if (
      (medication || hasClinicalRiskModifier) &&
      reportsComparableDose(questionId, input.dose, item)
    ) {
      score += 20;
      reasons.push("입력한 용량과 같거나 가까운 용량을 보고했습니다.");
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
  const directMedicationMatches = ranked.filter((item) =>
    medicationPatterns.direct.some((pattern) =>
      pattern.test(
        `${item.title} ${item.outcome ?? ""} ${item.population ?? ""} ${item.locator ?? ""} ${item.key_finding ?? ""}`,
      ),
    )
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
  evidence: RuntimeEvidence[],
) {
  const dose = normalizedDose(questionId, input.dose);
  const lab = numberFrom(input.labs);
  const doseLabel = Number.isFinite(dose) ? input.dose : "현재 복용량";
  const medicines = medicationValues(input.medication);
  const medicationName = compactMultiValue(medicines);
  const hasMedication = (pattern: RegExp) =>
    medicines.some((medicine) => pattern.test(medicine));
  const conditionText = conditionValues(input.condition)
    .map(describeConditionForCounselingContext)
    .join(" ");
  const context = [
    `${withObjectParticle(input.ingredient)} 복용하고 계시네요.`,
    /모르겠/.test(input.dose)
      ? "제품 라벨의 하루 양은 아직 모르겠다고 하셨고요."
      : input.dose
        ? `제품 라벨에는 하루 ${input.dose}로 적혀 있다고 하셨고요.`
        : "",
    medicationName
      ? `${medicationName}도 함께 복용하고 계시고요.`
      : "",
    conditionText,
    input.labs
      ? isSentenceLikeFreeText(input.labs)
        ? `최근 검사와 관련해서는 “${input.labs.replace(/[.!?。！？]+$/, "").trim()}”이라는 내용도 말씀하셨어요.`
        : `최근 검사 결과는 ${input.labs}이라고 하셨어요.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  // 선택된 문헌이 없는 자리는 빈 링크로 채우지 않는다. 화면의 근거 링크는
  // 이번 응답이 실제로 사용한 문헌만 가리켜야 한다.
  const study = (index: number): AssessmentReference | null => {
    const item = evidence[index];
    if (!item) return null;
    return reference(
      `논문 ${index + 1}`,
      item.title,
      item.url,
      item.key_finding_ko,
    );
  };
  const studies = (...indexes: number[]) =>
    indexes.map(study).filter((item): item is AssessmentReference => item !== null);
  const ods = {
    calcium: reference(
      "NIH 기준",
      "NIH ODS Calcium Fact Sheet",
      "https://ods.od.nih.gov/factsheets/calcium-HealthProfessional/",
      "칼슘의 권장 섭취량과 상한, 약물 상호작용을 정리한 기준 자료입니다.",
    ),
    omega: reference(
      "NIH 기준",
      "NIH ODS Omega-3 Fatty Acids Fact Sheet",
      "https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/",
      "오메가-3의 섭취 기준과 출혈·약물 상호작용을 정리한 기준 자료입니다.",
    ),
    vitaminK: reference(
      "NIH 기준",
      "NIH ODS Vitamin K Fact Sheet",
      "https://ods.od.nih.gov/factsheets/VitaminK-HealthProfessional/",
      "비타민 K의 섭취 기준과 와파린 상호작용을 정리한 기준 자료입니다.",
    ),
    vitaminD: reference(
      "NIH 기준",
      "NIH ODS Vitamin D Fact Sheet",
      "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/",
      "비타민 D의 섭취 기준과 상한, 약물 상호작용을 정리한 기준 자료입니다.",
    ),
    vitaminC: reference(
      "NIH 기준",
      "NIH ODS Vitamin C Fact Sheet",
      "https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/",
      "비타민 C의 섭취 기준과 상한, 건강 위험을 정리한 기준 자료입니다.",
    ),
  };
  if (questionId === "A1") {
    const interactions: string[] = [];
    if (hasMedication(/와파린|쿠마딘/))
      interactions.push(
        "와파린의 효과는 비타민 K 섭취량에 따라 달라질 수 있습니다. 섭취량이 갑자기 늘거나 줄면 INR도 변할 수 있습니다.",
      );
    if (hasMedication(/항생제/))
      interactions.push(
        "항생제를 장기간 복용하면 장내 비타민 K 생성이 줄어 비타민 K 상태를 낮출 수 있습니다.",
      );
    if (hasMedication(/담즙산결합수지/))
      interactions.push("담즙산결합수지는 비타민 K 흡수를 낮출 수 있습니다.");
    if (hasMedication(/올리스타트/))
      interactions.push("올리스타트는 비타민 K 흡수를 낮출 수 있습니다.");
    return {
      context,
      verdict:
        "비타민 K는 갑자기 줄이지 말고 매일 비슷한 양을 섭취하는 편이 낫습니다.",
      dose: `${Number.isFinite(dose) ? `${dose} mcg/day라는 양` : "현재 복용량"} 자체보다 섭취량이 갑자기 바뀌는지가 INR에 더 큰 영향을 줄 수 있습니다.`,
      interaction:
        interactions.join(" ") ||
        "와파린의 효과는 비타민 K 섭취량에 따라 달라질 수 있습니다. 섭취량이 갑자기 늘거나 줄면 INR도 변할 수 있습니다.",
      watch:
        "최근 INR이 달라졌다면 제품이나 식사에서 비타민 K 섭취량이 바뀐 시점과 비교해야 합니다.",
      references: [ods.vitaminK, ...studies(0, 1)],
    };
  }
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
      references: [ods.omega, ...studies(0, 4)],
    };
  }
  if (questionId === "B1") {
    const hasUrineCalciumLab =
      /(?:(?:요중|소변|24시간).{0,16}칼슘|칼슘.{0,16}(?:요중|소변|24시간))/.test(
        input.labs,
      );
    const highUrineCalcium =
      hasUrineCalciumLab && Number.isFinite(lab) && lab > 275;
    const interactions: string[] = [];
    if (hasMedication(/갑상선약|레보티록신/))
      interactions.push(
        "칼슘은 레보티록신의 흡수를 떨어뜨릴 수 있어 복용 시간 간격이 중요합니다.",
      );
    if (hasMedication(/퀴놀론|항생제/))
      interactions.push(
        "칼슘은 퀴놀론계 항생제의 흡수를 떨어뜨릴 수 있어 복용 시간 간격이 중요합니다.",
      );
    if (hasMedication(/돌루테그라비르/))
      interactions.push(
        "칼슘은 돌루테그라비르의 흡수를 떨어뜨릴 수 있어 복용 시간 간격이 중요합니다.",
      );
    if (hasMedication(/리튬/))
      interactions.push(
        "리튬은 혈중 칼슘을 높일 수 있어 칼슘 보충제와 함께 먹을 때 칼슘 수치를 봐야 합니다.",
      );
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
        interactions.join(" ") ||
        "레보티록신, 퀴놀론계 항생제, 돌루테그라비르의 흡수를 떨어뜨릴 수 있어 복용 시간 간격이 중요합니다.",
      watch: highUrineCalcium
        ? `${lab} mg/day는 NIH가 제시한 고칼슘뇨 기준보다 높습니다. 결석 병력까지 있으므로 총 칼슘 섭취량과 복용 시점을 조정할 근거가 됩니다.`
        : "결석 병력에서는 보충제 양보다 결석 성분, 식이 칼슘, 24시간 요중 칼슘을 함께 봅니다.",
      references: [ods.calcium, ...studies(0, 1)],
    };
  }
  if (questionId === "B2") {
    const interactions: string[] = [];
    if (hasMedication(/티아지드|이뇨제/))
      interactions.push(
        "티아지드 이뇨제는 소변으로 배출되는 칼슘을 줄여 고칼슘혈증 위험을 높일 수 있습니다.",
      );
    if (hasMedication(/올리스타트/))
      interactions.push("올리스타트는 비타민 D 흡수를 낮출 수 있습니다.");
    if (hasMedication(/스테로이드|프레드니/))
      interactions.push(
        "스테로이드는 칼슘 흡수와 비타민 D 대사에 영향을 줄 수 있습니다.",
      );
    if (hasMedication(/스타틴/))
      interactions.push(
        "고용량 비타민 D는 일부 스타틴의 작용에 영향을 줄 수 있습니다.",
      );
    return {
      context,
      verdict:
        Number.isFinite(dose) && dose >= 4000
          ? `현재 ${input.dose}는 ${dose === 4000 ? "성인 상한 4,000 IU/day와 같습니다" : "성인 상한 4,000 IU/day보다 높습니다"}. 결석이나 고칼슘뇨 병력이 있다면 늘리기보다 줄이는 편이 낫습니다.`
          : "현재 용량은 성인 상한 아래이지만 결석·고칼슘뇨가 있으면 칼슘 검사와 함께 판단합니다.",
      dose: "성인 비타민 D 상한은 4,000 IU/day입니다. 상한은 권장량이 아니라 넘기지 말아야 할 총량 기준입니다.",
      interaction:
        interactions.join(" ") ||
        "티아지드 이뇨제는 고칼슘혈증 위험을 높일 수 있고, 올리스타트는 비타민 D 흡수를 낮출 수 있습니다.",
      watch:
        "25(OH)D만 보지 말고 혈청 칼슘과 24시간 요중 칼슘도 함께 봐야 합니다.",
      references: [ods.vitaminD, ...studies(0, 1)],
    };
  }
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
    references: [ods.vitaminC, ...studies(0, 1)],
  };
}
type RuleAssessment = ReturnType<typeof buildAssessment>;
type NarrativeAssessment = {
  ai_used: boolean;
  // 서술 재작성이 실패해 규칙 기반 문장으로 돌아간 이유. 조용한 저하를 남기지 않는다.
  fallback_reason?: string;
  conclusion: string;
  context: string;
  explanation: string;
  next: string;
};
const narrativeKeys = [
  "conclusion",
  "context",
  "explanation",
  "next",
] as const;
const narrativeClinicalConcepts: GroundedConcept[] = [
  {
    candidate: /복통|복부.{0,5}통증|배.{0,5}아프|통증/,
    source: /복통|복부.{0,5}통증|배.{0,5}아프|통증/,
  },
  { candidate: /혈뇨|소변.{0,6}피/, source: /혈뇨|소변.{0,6}피/ },
  { candidate: /고열|발열/, source: /고열|발열/ },
  { candidate: /오심|메스꺼|구토/, source: /오심|메스꺼|구토/ },
  { candidate: /옆구리/, source: /옆구리/ },
  { candidate: /크레아티닌/, source: /크레아티닌/ },
  { candidate: /설사/, source: /설사/ },
  { candidate: /어지|실신|의식/, source: /어지|실신|의식/ },
  { candidate: /응급|119/, source: /응급|119/ },
  { candidate: /진료|의료기관/, source: /진료|의료기관/ },
  { candidate: /즉시/, source: /즉시/ },
];
function assessmentCopy(assessment: RuleAssessment) {
  return {
    context: assessment.context,
    verdict: assessment.verdict,
    dose: assessment.dose,
    interaction: assessment.interaction,
    watch: assessment.watch,
  };
}
function preservesDecision(verdict: string, conclusion: string) {
  const checks: Array<[RegExp, RegExp]> = [
    [
      /판단할 수 없습니다/,
      /판단할 수 없|판단하기 어렵|판단할 근거가 부족/,
    ],
    [
      /줄이는 (?:편|쪽)|유지하지|피해야/,
      /줄이|감량|낮추|유지하지|피해야|피하는/,
    ],
    [
      /안전 범위 안|상한 아래|상한보다 낮/,
      /안전 범위|상한(?:보다)? (?:아래|미만|낮)|기준 (?:안|이내)/,
    ],
    [/상한.{0,20}보다 높|기준.{0,20}보다 높/, /높|초과/],
    [/매일 비슷한 양|일정하게/, /비슷한|일정/],
    [/와 같습니다/, /같|동일|상한선/],
  ];
  return checks.every(
    ([sourcePattern, outputPattern]) =>
      !sourcePattern.test(verdict) || outputPattern.test(conclusion),
  );
}
// 통과하면 빈 문자열, 막히면 어느 검사에서 막혔는지 돌려준다.
// 어떤 이유로 규칙 기반 문장으로 되돌아갔는지 응답에 남기기 위한 것이다.
function narrativeGroundingFailure(
  candidate: Omit<NarrativeAssessment, "ai_used">,
  source: Record<string, unknown>,
): string {
  const combined = narrativeKeys.map((key) => candidate[key]).join(" ");
  if (
    narrativeKeys.some(
      (key) =>
        typeof candidate[key] !== "string" ||
        !candidate[key].trim() ||
        candidate[key].length > 320,
    ) ||
    combined.length > 950 ||
    /https?:\/\//i.test(combined) ||
    /입력(?:되|하|된)|입력값|프로필|대상자|사용자|같아(?:요)?입니다|같다고.{0,12}입니다|원래 조건|조건대로|작성 규칙|요청대로|지침|제시했습니다/.test(
      combined,
    ) ||
    /확인해야.{0,24}판단할 수 없습니다|\/day으로/.test(combined) ||
    /(?:복용|용량).{0,12}(?:시작|중단|증량)(?:하세요|하십시오)|안전합니다|진단됩니다/.test(
      combined,
    )
  )
    return "style_or_length";
  const submittedInput = source.submitted_input as Partial<ParsedInput>;
  if (
    /같아|같은|기억|들었|정확하지|확실하지/.test(
      String(submittedInput.labs ?? ""),
    ) &&
    !/같|기억|들었|정확하지|확실하지|추정/.test(candidate.context)
  )
    return "uncertainty_dropped";
  const sourceText = JSON.stringify(source);
  const actualNumbers = numericTokens(combined);
  const allowedNumbers = numericTokens(sourceText);
  const requiredNumbers = numericTokens(
    JSON.stringify({
      rule_assessment: source.rule_assessment,
      symptom_note: source.symptom_note,
    }),
  );
  const invented = [...actualNumbers].filter(
    (token) => !allowedNumbers.has(token),
  );
  if (invented.length) return `number_not_in_source:${invented.join(",")}`;
  const dropped = [...requiredNumbers].filter(
    (token) => !actualNumbers.has(token),
  );
  if (dropped.length) return `required_number_missing:${dropped.join(",")}`;
  if (
    !conceptsAreGrounded(sourceText, combined, medicationConcepts) ||
    !conceptsAreGrounded(sourceText, combined, conditionConcepts) ||
    !conceptsAreGrounded(sourceText, combined, labConcepts) ||
    !conceptsAreGrounded(sourceText, combined, narrativeClinicalConcepts)
  )
    return "concept_not_in_source";
  if (
    ["근접", "초과", "중단", "증량", "시작", "권장", "규정"].some(
      (term) => combined.includes(term) && !sourceText.includes(term),
    ) ||
    (/철 흡수/.test(combined) &&
      /철 과다증/.test(sourceText) &&
      !/철 과다증/.test(combined)) ||
    (/(?:하세요|마세요|하십시오)/.test(combined) &&
      !/(?:하세요|마세요|하십시오)/.test(String(source.symptom_note ?? "")))
  )
    return "forbidden_term_or_imperative";
  const ruleAssessment = source.rule_assessment as { verdict?: string };
  return preservesDecision(String(ruleAssessment.verdict ?? ""), candidate.conclusion)
    ? ""
    : "decision_changed";
}
async function generateNarrativeAssessment({
  submitted,
  interpreted,
  assessment,
  symptomNote,
  evidenceLimit,
}: {
  submitted: ParsedInput;
  interpreted: ParsedInput;
  assessment: RuleAssessment;
  symptomNote: string;
  evidenceLimit: string;
}): Promise<NarrativeAssessment> {
  const fellBack = (reason: string): NarrativeAssessment => ({
    ai_used: false,
    fallback_reason: reason,
    conclusion: assessment.verdict,
    context: assessment.context,
    explanation: `${assessment.dose} ${assessment.interaction}`,
    next: [symptomNote, assessment.watch].filter(Boolean).join(" "),
  });
  if (!process.env.OPENAI_API_KEY) return fellBack("api_key_missing");
  const source = {
    submitted_input: submitted,
    interpreted_input: interpreted,
    rule_assessment: assessmentCopy(assessment),
    symptom_note: symptomNote,
    evidence_limit: evidenceLimit,
  };
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
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
              "보충제 안전성 결과를 일반인이 바로 이해할 수 있는 한국어로 작성한다. submitted_input과 interpreted_input을 통째로 읽고, rule_assessment의 판단을 결론으로 사용한다. AI가 새 판단을 만들거나 판단 방향을 바꾸지 않는다. 단어 뒤에 조사를 기계적으로 붙이지 말고 전체 의미를 파악해 자연스러운 문장으로 다시 쓴다. 네 항목 모두 '~해요', '~돼요', '~예요' 같은 해요체로 쓰고, 모든 문장의 마지막은 '요'로 끝낸다. '~습니다', '~합니다', '~입니다', '~모릅니다' 같은 합쇼체는 쓰지 않는다. conclusion은 유지·감량·총량 확인 중 필요한 결론을 첫 문장에 명확히 쓴다. 복용량을 모르는 경우에는 '하루 총량을 확인하기 전에는 유지 여부를 판단할 수 없어요'처럼 조건과 결론의 순서를 분명히 쓴다. context는 판단에 필요한 현재 복용 상황, 약, 증상, 검사 결과만 자연스럽게 연결한다. 사용자가 '같다', '기억한다', '잘 모르겠다'고 쓴 내용은 확정된 기록으로 바꾸지 말고 '낮았던 것으로 기억해요'처럼 불확실성을 유지한다. explanation은 rule_assessment의 용량 기준과 상호작용, evidence_limit의 직접성 한계만 연결해 설명한다. 숫자와 단위 뒤에 억지로 조사를 붙이지 말고 '상한은 2,000 mg/day예요'처럼 문장을 끝낸다. 철 흡수 영향을 쓰려면 '철 과다증에서는'이라는 조건을 같은 문장에 둔다. next는 rule_assessment.watch와 symptom_note만 자연스럽게 다시 쓴다. 원문에 없는 증상·검사·진료 긴급도나 별도 의학 지식을 추가하지 않는다. 단순히 의료진과 상의하라는 말로 끝내지 않는다. symptom_note에 긴급 진료 문구가 있을 때만 그 긴급도를 그대로 유지한다. 원문과 rule_assessment에 없는 약, 질환, 수치, 단위, 진단, 복용 지시를 만들지 않는다. 상한 수치를 임의로 위험이 시작되는 기준이나 '근접한 고용량'으로 바꾸지 않는다. 제품 라벨의 총량을 권장량이라고 부르지 않는다. 모든 수치와 단위를 그대로 보존한다. 긴급 진료 문구를 그대로 옮기는 경우 외에는 '하세요', '마세요' 같은 명령형을 쓰지 않는다. 작성 규칙을 지켰다는 설명이나 '원래 조건대로', '제시했습니다' 같은 내부 작업 문구를 결과에 쓰지 않는다. '입력되었습니다', '사용자', '대상자', '프로필', '같아요입니다', '종합하면', '핵심은'은 쓰지 않는다. 네 항목 전체는 950자 이하로 쓴다.",
          },
          { role: "user", content: JSON.stringify(source) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "personalized_safety_narrative",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                conclusion: { type: "string" },
                context: { type: "string" },
                explanation: { type: "string" },
                next: { type: "string" },
              },
              required: narrativeKeys,
            },
          },
        },
        max_output_tokens: 700,
      }),
    });
    if (!response.ok) return fellBack(`http_${response.status}`);
    const data = await response.json();
    const outputText = String(
      data.output_text ??
        data.output
          ?.flatMap(
            (item: { content?: Array<{ text?: string }> }) =>
              item.content ?? [],
          )
          .map((item: { text?: string }) => item.text ?? "")
          .join("") ??
        "",
    ).trim();
    const parsed = JSON.parse(outputText) as Omit<
      NarrativeAssessment,
      "ai_used"
    >;
    const groundingFailure = narrativeGroundingFailure(parsed, source);
    if (groundingFailure) return fellBack(`ungrounded:${groundingFailure}`);
    return { ai_used: true, ...parsed, context: assessment.context };
  } catch (error) {
    return fellBack(
      error instanceof Error && error.name === "TimeoutError"
        ? "timeout"
        : "request_failed",
    );
  }
}
export async function POST(req: Request) {
  const submitted = parseInput(await req.json().catch(() => null));
  if (!submitted)
    return NextResponse.json(
      {
        error:
          "작성한 내용이 너무 길거나 형식에 맞지 않습니다. 각 입력란을 확인한 뒤 다시 시도하세요.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const q = map[submitted.ingredient];
  if (!q)
    return NextResponse.json(
      { error: "지원하는 다섯 보충제 중 하나를 선택하세요." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const r = (rules as RuntimeRule[]).find((x) => x.question_id === q);
  if (!r)
    return NextResponse.json(
      { error: "이 보충제의 근거 규칙을 불러오지 못했습니다. 잠시 후 다시 시도하세요." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  const g = guidance[q];
  const inputInterpretation = await interpretFreeText(submitted);
  const b = inputInterpretation.input;
  const entered = [
    b.dose && `하루 섭취량 ${b.dose}`,
    b.medication &&
      !/없음|모르겠/.test(b.medication) &&
      `함께 먹는 약 ${b.medication}`,
    b.condition &&
      `${/(?:아파|통증|출혈|어지|구토|설사|코피|멍)/.test(b.condition) ? "현재 증상" : "증상·병력"} ${b.condition}`,
    b.labs && `검사 결과 ${b.labs}`,
  ].filter(Boolean) as string[];
  const evidenceSelection = selectEvidence(q, r.all_evidence, b);
  const assessment = buildAssessment(q, b, evidenceSelection.selected);
  const selectedMedicationName = compactMultiValue(medicationValues(b.medication));
  const evidenceSummary = buildEvidenceSummary(
    evidenceSelection.selected,
    evidenceSelection.directMedicationMatches,
    selectedMedicationName,
  );
  const evidenceLimit = buildEvidenceLimit(
    evidenceSelection.selected,
    evidenceSelection.directMedicationMatches,
    b.ingredient,
    selectedMedicationName,
    b.dose,
  );
  const actionPlan = buildActionPlan(q, b.dose);
  const summaryInput: SummaryInput = {
    questionId: q,
    ingredient: b.ingredient,
    dose: b.dose,
    medication: b.medication,
    condition: b.condition,
    labs: b.labs,
    summary: g.summary,
    evidenceSummary,
    evidenceLimit,
    actionPlan,
    profile: entered,
    checks: g.checks,
    why: g.why,
    next: g.next,
  };
  const narrativeAssessment = await generateNarrativeAssessment({
    submitted,
    interpreted: b,
    assessment,
    symptomNote: buildSymptomAdvice(summaryInput),
    evidenceLimit,
  });
  const ai_summary = narrativeAssessment.ai_used
    ? narrativeKeys
        .map((key) => narrativeAssessment[key])
        .filter(Boolean)
        .join("\n\n")
    : buildSummaryFallback(summaryInput);
  return NextResponse.json(
    {
      question_id: q,
      evidence_lineage: {
        track: "v3.0_full_ai_autonomy",
        source_question_id: r.source_question_id ?? r.question_id,
      },
      ingredient: b.ingredient,
      title: g.title,
      summary: g.summary,
      ai_summary,
      narrative_assessment: narrativeAssessment,
      input_interpretation: {
        ai_used: inputInterpretation.aiUsed,
        changed: inputInterpretation.changed,
      },
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
        medication_name: compactMultiValue(medicationValues(b.medication)),
        method:
          "연구 설계와 입력한 약·증상·병력·검사 결과·용량을 문헌의 대상과 결과에 대조해 관련도가 높은 순서로 배치했습니다.",
      },
      interpretation:
        "이 결과는 상담 준비를 위한 근거 요약입니다. 복용 시작·중단·용량 변경을 직접 지시하지 않습니다.",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
