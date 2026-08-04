// AI 가 쓴 상담 문단을 결정론 규칙으로 심판한다. 한 군데라도 걸리면 그 문단을
// 쓰지 않고 결정론 문단을 그대로 내보낸다(무해 폴백). 프롬프트로 부탁하는 것과
// 달리 이 검사는 반드시 실행되므로, 규칙 파일이 정한
// decision_authority=none · clinical_recommendation=false 가 화면까지 지켜진다.

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

export type RefereeVerdict =
  | { ok: true; paragraphs: string[] }
  | { ok: false; rejections: string[] };

const MAX_PARAGRAPHS = 4;
const MAX_PARAGRAPH_CHARS = 320;

/**
 * 숫자는 근거에 있는 것만 쓰게 한다.
 *
 * 모델이 "하루 800 µg 까지" 같은 문장을 지어내면 그 숫자가 어디서 왔는지 화면이
 * 설명할 수 없다. 이번 응답이 실제로 고른 문헌 문자열과 결정론 문단에 등장하는
 * 숫자만 허용 목록에 넣고, 그 밖의 숫자가 나오면 문단 전체를 버린다.
 */
function collectNumbers(text: string) {
  return new Set((text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/,/g, "")));
}

export function refereeConsult({
  paragraphs,
  allowedText,
}: {
  paragraphs: unknown;
  /** 이번 응답이 실제로 고른 문헌 문자열 + 결정론 문단을 모두 이어 붙인 것. */
  allowedText: string;
}): RefereeVerdict {
  const rejections: string[] = [];

  if (!Array.isArray(paragraphs)) return { ok: false, rejections: ["not_array"] };

  const cleaned = paragraphs
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  if (!cleaned.length) return { ok: false, rejections: ["empty"] };
  if (cleaned.length > MAX_PARAGRAPHS) rejections.push("too_many_paragraphs");

  const allowedNumbers = collectNumbers(allowedText);

  for (const [index, paragraph] of cleaned.entries()) {
    if (paragraph.length > MAX_PARAGRAPH_CHARS) {
      rejections.push(`too_long:${index}`);
    }
    if (QUESTION.test(paragraph)) rejections.push(`question:${index}`);
    for (const pattern of DIRECTION) {
      if (pattern.test(paragraph)) {
        rejections.push(`direction:${index}:${pattern.source}`);
        break;
      }
    }
    for (const pattern of PERSONAL_CLAIM) {
      if (pattern.test(paragraph)) {
        rejections.push(`personal_claim:${index}:${pattern.source}`);
        break;
      }
    }
    for (const number of collectNumbers(paragraph)) {
      if (!allowedNumbers.has(number)) {
        rejections.push(`unsupported_number:${index}:${number}`);
        break;
      }
    }
  }

  if (rejections.length) return { ok: false, rejections };
  return { ok: true, paragraphs: cleaned };
}
