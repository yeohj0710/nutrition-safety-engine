// AI 가 쓴 상담 문단을 결정론 규칙으로 심판한다. 한 군데라도 걸리면 그 문단을
// 쓰지 않고 결정론 문단을 그대로 내보낸다(무해 폴백). 프롬프트로 부탁하는 것과
// 달리 이 검사는 반드시 실행되므로, 규칙 파일이 정한
// decision_authority=none · clinical_recommendation=false 가 화면까지 지켜진다.
//
// ★ 문단은 자기가 근거로 삼은 기록 id 를 들고 와야 한다. 예전에는 숫자를 payload
//   전체와 대조했는데, 그러면 "그 값이 어딘가 있다"만 볼 뿐 무엇을 가리키는지는
//   못 본다. 실제로 발췌 목록 개수 12 를 화면 표시 건수로 쓴 문장이 그대로
//   통과한 적이 있다. 인용한 기록 안에서만 숫자를 허용하면 그 종류가 닫힌다.

/** 복용을 지시하거나 안전을 단정하는 표현. 규칙 파일이 금지한 권한이다. */
const DIRECTION = [
  /복용을\s*(?:중단|시작|계속)/,
  /(?:끊|중단하|시작하)(?:으)?세요/,
  /용량을\s*(?:줄|늘)/,
  /(?:줄이|늘리|올리|낮추)세요/,
  /드시지\s*(?:마|말)/,
  /드세요|복용하세요|섭취하세요/,
  /권(?:장|고)합니다|권해\s*드립니다|추천(?:합니다|드립니다)/,
  /안전합니다|위험합니다|해롭습니다|괜찮습니다/,
  /피하(?:세요|셔야)/,
  /(?:상한|한도)(?:은|는|을|를)?\s*\d/,
];

/** 이 화면은 대화가 아니다. 되묻는 문장은 답을 받을 자리가 없다. */
const QUESTION = /[?？]/;

/** 문헌이 보고한 것이 아니라 개인에게 일어날 일로 읽히는 단정. */
const PERSONAL_CLAIM = [
  /당신(?:의|에게|은|이)/,
  /환자분(?:께|에게|은)\s*(?:는|)\s*(?:안전|위험)/,
  /(?:틀림없|분명히|반드시)\s*/,
];

export type ComposedParagraph = {
  text: string;
  /** 이 문단이 근거로 삼은 기록 id. 화면에도 출처로 표시한다. */
  recordIds: string[];
};

export type RefereeVerdict =
  | { ok: true; paragraphs: ComposedParagraph[] }
  | { ok: false; rejections: string[] };

const MAX_PARAGRAPHS = 4;
/**
 * 320 이던 것을 올렸다. 문단이 성분 이름과 대상과 수치를 다 짚게 바꾸고 나니
 * 320 에서 잘려 나가는 문단이 생겼고, 잘린 문단 하나 때문에 상담문 전체가
 * 결정론 폴백으로 떨어졌다. 뭉뚱그린 문장을 막으려고 고친 것을 길이 상한이
 * 되돌리면 안 된다.
 */
// 여러 연구의 대상·용량·결과를 함께 설명할 공간을 둔다. 처방·출처 검사는 별도로 유지한다.
const MAX_PARAGRAPH_CHARS = 600;
/**
 * 한 문단이 댈 수 있는 근거 수.
 *
 * 전부를 가리키는 출처는 아무것도 가리키지 않는 것과 같다. 실제로 모델이
 * 문단마다 15건 전부를 달아 화면이 칩 30개로 덮인 적이 있다. 특정 문헌을 짚는
 * 문단만 인용하고, 총평이나 화면 안내 문단은 빈 배열로 두게 한다.
 *
 * 3 이던 것을 올렸다. 문단이 문헌 넷 이상에서 수치를 끌어오는 경우가 생겼는데,
 * 상한이 3 이면 나머지를 인용에서 빼야 하고 그러면 그 수치가
 * unsupported_number 로 걸려 상담문 전체가 폴백으로 떨어졌다. 숫자를 쓴 문헌은
 * 반드시 인용하게 하는 쪽이 맞고, 5 는 칩이 화면을 덮지 않는 선이다.
 */
const MAX_RECORD_REFS = 5;

function collectNumbers(text: string) {
  return new Set(
    (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => String(Number(n.replace(/,/g, "")))),
  );
}

/**
 * 초록이 단위를 늘 짧게 쓰지는 않는다. "15 gs of raw herbs", "1,400 grams" 처럼
 * 복수형이나 풀어 쓴 말이 그대로 저장돼 있다. 짧은 표기만 모으면 원문에 있는 양을
 * 모델이 정상 표기로 옮겨 쓴 문단이 unsupported_measurement 로 걸린다(실측: 황기
 * 15 g 문단이 이렇게 떨어졌다). 같은 양을 같은 열쇠로 모으고, 단위를 바꿔 쓴 것만
 * 잡는다는 목적은 그대로다.
 */
const SPELLED_UNITS: Record<string, string> = {
  gram: "g", grams: "g",
  milligram: "mg", milligrams: "mg",
  microgram: "mcg", micrograms: "mcg",
  millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml",
};

function measurements(text: string) {
  const found = new Set<string>();
  for (const match of text.matchAll(/(\d+(?:[.,]\d+)*)\s*(µg|μg|mcg|ug|mg|g|ml|mL|IU|mmol)s?(?![a-zA-Z])/g)) {
    found.add(`${Number(match[1].replace(/,/g, ""))}|${match[2].replace(/^(?:µg|μg|ug)$/, "mcg").toLowerCase()}`);
  }
  for (const match of text.matchAll(/(\d+(?:[.,]\d+)*)\s*(grams?|milligrams?|micrograms?|millilitres?|milliliters?)(?![a-zA-Z])/gi)) {
    const unit = SPELLED_UNITS[match[2].toLowerCase()];
    if (unit) found.add(`${Number(match[1].replace(/,/g, ""))}|${unit}`);
  }
  return found;
}

export function refereeConsult({
  paragraphs,
  recordText,
  sharedText,
}: {
  paragraphs: unknown;
  /** 기록 id → 그 기록의 문자열 전부. 문단이 인용한 것만 골라 숫자를 대조한다. */
  recordText: Record<string, string>;
  /** 어느 문단이든 쓸 수 있는 값. 시스템이 계산한 결정론 문단과 조건 줄. */
  sharedText: string;
}): RefereeVerdict {
  const rejections: string[] = [];

  if (!Array.isArray(paragraphs)) return { ok: false, rejections: ["not_array"] };

  const cleaned: ComposedParagraph[] = [];
  for (const item of paragraphs) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text) continue;
    const recordIds = Array.isArray(row.recordIds)
      ? row.recordIds.filter((id): id is string => typeof id === "string")
      : [];
    cleaned.push({ text, recordIds });
  }

  if (!cleaned.length) return { ok: false, rejections: ["empty"] };
  if (cleaned.length > MAX_PARAGRAPHS) rejections.push("too_many_paragraphs");

  const sharedNumbers = collectNumbers(sharedText);

  for (const [index, paragraph] of cleaned.entries()) {
    const { text, recordIds } = paragraph;
    if (!recordIds.length) rejections.push(`missing_source:${index}`);

    if (text.length > MAX_PARAGRAPH_CHARS) rejections.push(`too_long:${index}`);
    if (QUESTION.test(text)) rejections.push(`question:${index}`);
    for (const pattern of DIRECTION) {
      if (pattern.test(text)) {
        rejections.push(`direction:${index}:${pattern.source}`);
        break;
      }
    }
    for (const pattern of PERSONAL_CLAIM) {
      if (pattern.test(text)) {
        rejections.push(`personal_claim:${index}:${pattern.source}`);
        break;
      }
    }

    // 없는 기록을 인용하면 그 문단이 무엇을 근거로 하는지 화면이 설명할 수 없다.
    const unknownIds = recordIds.filter((id) => !(id in recordText));
    if (unknownIds.length) {
      rejections.push(`unknown_record:${index}:${unknownIds[0]}`);
    }
    if (recordIds.length > MAX_RECORD_REFS) {
      rejections.push(`too_many_refs:${index}:${recordIds.length}`);
    }

    // 숫자는 이 문단이 인용한 기록 + 공용 텍스트 안에서만 허용한다.
    const allowed = new Set(sharedNumbers);
    for (const id of recordIds) {
      const source = recordText[id];
      if (!source) continue;
      for (const number of collectNumbers(source)) allowed.add(number);
    }
    for (const number of collectNumbers(text)) {
      if (!allowed.has(number)) {
        rejections.push(`unsupported_number:${index}:${number}`);
        break;
      }
    }
    const allowedMeasurements = measurements([sharedText, ...recordIds.map(id => recordText[id] ?? "")].join("\n"));
    for (const value of measurements(text)) {
      if (!allowedMeasurements.has(value)) rejections.push(`unsupported_measurement:${index}:${value}`);
    }
  }

  if (rejections.length) return { ok: false, rejections };
  return { ok: true, paragraphs: cleaned };
}

/**
 * 기록 한 건을 풀어 쓴 한 줄을 검사한다.
 *
 * 핵심 근거는 이미 한국어 번역이 붙지만 확장 근거는 영어 원문만 보인다. 그
 * 문장을 한 줄로 옮기는 자리다. 옮기는 대상이 그 기록 하나뿐이므로 숫자도 그
 * 기록 안에서만 나와야 한다.
 */
export function refereeRecordLine({
  line,
  allowedText,
}: {
  line: unknown;
  /** 그 기록이 담은 문자열 전부. 제목·연도·연구유형·원문 문장. */
  allowedText: string;
}): { ok: true; line: string } | { ok: false; reason: string } {
  if (typeof line !== "string") return { ok: false, reason: "not_string" };
  const text = line.trim();
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > 150) return { ok: false, reason: "too_long" };
  if (QUESTION.test(text)) return { ok: false, reason: "question" };
  for (const pattern of DIRECTION) {
    if (pattern.test(text)) return { ok: false, reason: `direction:${pattern.source}` };
  }
  for (const pattern of PERSONAL_CLAIM) {
    if (pattern.test(text)) return { ok: false, reason: `personal_claim:${pattern.source}` };
  }
  const allowed = collectNumbers(allowedText);
  for (const number of collectNumbers(text)) {
    if (!allowed.has(number)) return { ok: false, reason: `unsupported_number:${number}` };
  }
  return { ok: true, line: text };
}
