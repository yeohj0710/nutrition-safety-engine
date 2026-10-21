import terms from "@/src/lib/ingredient-terms.json";

/**
 * 적어 주신 성분, 나이, 양을 목록의 문헌과 대조한다(2026-10-21).
 *
 * 조회 목록 자체는 바꾸지 않는다. 어떤 문헌이 나오는지는 지금처럼 상황과 조건
 * 규칙이 정하고, 여기서는 나온 문헌마다 "같은 성분인가, 나이대가 겹치는가,
 * 양이 비슷한가"를 표시만 한다. 언어모델은 쓰지 않는다.
 *
 * - 성분: 입력 문장에서 성분 사전(ingredient-terms.json)의 한국어 이름을 찾고,
 *   빌드 때 제목과 초록에서 뽑아 둔 성분 열쇠와 비교한다.
 * - 나이: 입력의 나이 한 값이 초록에서 뽑은 대상 나이 범위 안에 드는지 본다.
 * - 양: 입력의 양이 초록의 양 표기 가운데 하나의 절반에서 두 배 사이인지 본다.
 *   mg 계열(g, mg, µg)끼리, IU 끼리만 비교하고 체중당 양은 비교하지 않는다.
 */

type Term = { key: string; label: string; ko: string; en: string };
const TERMS = (terms as { ingredients: Term[] }).ingredients.map((term) => ({
  ...term,
  koRe: new RegExp(term.ko, "i"),
  enRe: new RegExp(term.en, "i"),
}));

export type RecordTraits = { i: string[]; a: [number, number][] };

export type ValueQuery = {
  ingredients: { key: string; label: string }[];
  age: number | null;
  dose: { value: number; family: "mass" | "iu"; text: string } | null;
};

export type ValueMatch = {
  ingredient: boolean | null;
  age: boolean | null;
  dose: boolean | null;
};

/** 입력 문장과 칸 값에서 성분, 나이, 양을 읽는다. 읽지 못한 것은 비워 둔다. */
export function readValueQuery(input: { text?: string; age?: string; dose?: string }): ValueQuery {
  const text = `${input.text ?? ""} ${input.dose ?? ""}`;
  const found = TERMS.filter((term) => term.koRe.test(text) || term.enRe.test(text));
  // 철분제를 먹는다는 문장에 "비타민 B군"까지 잡히지 않게, 더 구체적인 열쇠가 있으면 넓은 묶음은 뺀다.
  const keys = new Set(found.map((term) => term.key));
  const ingredients = found
    .filter((term) => !(term.key === "vitamin_b" && keys.has("vitamin_b12")))
    .map((term) => ({ key: term.key, label: term.label }));
  return { ingredients, age: readAge(`${input.age ?? ""} ${input.text ?? ""}`), dose: readDose(input.dose || input.text || "") };
}

/**
 * 조회 요청에 실려 온 대조 값을 다시 읽는다. 자유 문장은 조회 요청에 싣지 않으므로
 * 화면이 readValueQuery 로 읽은 결과(성분 열쇠, 나이, 양)만 받는다.
 * 사전에 없는 열쇠와 범위를 벗어난 숫자는 버린다.
 */
export function readValueMarks(raw: unknown): ValueQuery | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as { ingredients?: unknown; age?: unknown; dose?: unknown };
  const keys = Array.isArray(input.ingredients) ? input.ingredients.slice(0, 10).map(String) : [];
  const ingredients = TERMS.filter((term) => keys.includes(term.key)).map((term) => ({ key: term.key, label: term.label }));
  const ageValue = Number(input.age);
  const age = input.age !== null && input.age !== undefined && Number.isFinite(ageValue) && ageValue > 0 && ageValue < 120 ? ageValue : null;
  let dose: ValueQuery["dose"] = null;
  if (input.dose && typeof input.dose === "object") {
    const d = input.dose as { value?: unknown; family?: unknown; text?: unknown };
    const value = Number(d.value);
    if (Number.isFinite(value) && value > 0 && value < 1e7 && (d.family === "mass" || d.family === "iu")) {
      dose = { value, family: d.family, text: String(d.text ?? "").slice(0, 30) };
    }
  }
  return ingredients.length || age !== null || dose ? { ingredients, age, dose } : null;
}

/** 화면에서 조회 요청에 실을 대조 값. 문장 대신 읽은 결과만 보낸다. */
export function valueMarks(query: ValueQuery) {
  if (!query.ingredients.length && query.age === null && !query.dose) return undefined;
  return { ingredients: query.ingredients.map((item) => item.key), age: query.age, dose: query.dose };
}

function readAge(text: string): number | null {
  const korean = text.match(/(\d{1,3})\s*(?:세|살)/);
  const english = text.match(/(\d{1,3})\s*(?:years?\s*old|yo\b|y\/o)/i);
  const decade = text.match(/(\d)0\s*대/);
  const value = korean ? Number(korean[1]) : english ? Number(english[1]) : decade ? Number(decade[1]) * 10 + 5 : NaN;
  return Number.isFinite(value) && value > 0 && value < 120 ? value : null;
}

const MASS: Record<string, number> = { g: 1000, gs: 1000, gram: 1000, grams: 1000, 그램: 1000, mg: 1, 밀리그램: 1, "µg": 0.001, "μg": 0.001, mcg: 0.001, 마이크로그램: 0.001 };

function readDose(text: string): ValueQuery["dose"] {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(mg|g|µg|μg|mcg|iu|IU|밀리그램|마이크로그램|그램|아이유)(?![a-z])/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", ""));
  const unit = match[2].toLowerCase();
  if (unit === "iu" || unit === "아이유") return { value, family: "iu", text: match[0] };
  const factor = MASS[unit] ?? MASS[match[2]];
  return factor ? { value: value * factor, family: "mass", text: match[0] } : null;
}

/** 초록에서 모은 양 표기(" | "로 이은 문자열)를 mg 또는 IU 값으로 읽는다. 체중당 양은 뺀다. */
export function readRecordDoses(dose: string): { value: number; family: "mass" | "iu" }[] {
  const out: { value: number; family: "mass" | "iu" }[] = [];
  for (const part of String(dose ?? "").split("|")) {
    const m = part.trim().match(/^(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\s*(?:-|–|to)\s*[\d.,]+)?\s*(mg|g|gs|grams?|milligrams?|micrograms?|µg|μg|mcg|iu)\b(.*)$/i);
    if (!m || /\/\s*kg|per\s+kg/i.test(m[3])) continue;
    const value = Number(m[0].match(/^[\d.,]+/)![0].replace(/,/g, ""));
    const unit = m[2].toLowerCase();
    if (unit === "iu") out.push({ value, family: "iu" });
    else {
      const factor = unit.startsWith("micro") ? 0.001 : unit.startsWith("milli") ? 1 : MASS[unit] ?? (unit.startsWith("gram") ? 1000 : undefined);
      if (factor) out.push({ value: value * factor, family: "mass" });
    }
  }
  return out;
}

export function matchRecord(query: ValueQuery, traits: RecordTraits | undefined, dose: string): ValueMatch {
  const ingredient = query.ingredients.length
    ? Boolean(traits?.i.some((key) => query.ingredients.some((item) => item.key === key)))
    : null;
  const age =
    query.age === null || !traits?.a.length
      ? null
      : traits.a.some(([lo, hi]) => query.age! >= lo && query.age! <= hi);
  let doseMatch: boolean | null = null;
  if (query.dose) {
    const amounts = readRecordDoses(dose).filter((item) => item.family === query.dose!.family);
    doseMatch = amounts.length
      ? amounts.some((item) => item.value >= query.dose!.value / 2 && item.value <= query.dose!.value * 2)
      : null;
  }
  return { ingredient, age, dose: doseMatch };
}
