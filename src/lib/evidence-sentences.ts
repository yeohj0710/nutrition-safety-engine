const abbreviationSuffixes = [
  "dr.",
  "mr.",
  "mrs.",
  "ms.",
  "prof.",
  "fig.",
  "no.",
  "vs.",
  "et al.",
  "e.g.",
  "i.e.",
];

function isProtectedPeriod(value: string, index: number) {
  const previous = value[index - 1] ?? "";
  const next = value[index + 1] ?? "";
  if (/\d/.test(previous) && /\d/.test(next)) return true;

  const prefix = value.slice(Math.max(0, index - 16), index + 1).toLowerCase();
  if (abbreviationSuffixes.some((suffix) => prefix.endsWith(suffix))) return true;

  const currentToken = value.slice(0, index + 1).match(/(?:^|\s)((?:[a-z]\.){2,})$/i);
  return Boolean(currentToken);
}

/**
 * 화면용 근거 문장을 보수적으로 나눈다. 소수점과 흔한 영문 약어는 유지하고,
 * 마침표·물음표·느낌표 뒤에 실제 공백이나 문자열 끝이 있을 때만 경계로 본다.
 */
export function splitEvidenceSentences(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return [];

  const sentences: string[] = [];
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const punctuation = text[index];
    if (![".", "?", "!"].includes(punctuation)) continue;
    if (punctuation === "." && isProtectedPeriod(text, index)) continue;

    let end = index + 1;
    while (end < text.length && /["'’”)\]}]/.test(text[end])) end += 1;
    if (end < text.length && !/\s/.test(text[end])) continue;

    const sentence = text.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    while (end < text.length && /\s/.test(text[end])) end += 1;
    start = end;
    index = end - 1;
  }

  const remainder = text.slice(start).trim();
  if (remainder) sentences.push(remainder);
  return sentences.length ? sentences : [text];
}

export type FlattenedTranslatedFinding<T> = {
  item: T;
  paperNumber: number;
  sentence: string;
  sentenceIndex: number;
};

/** 문헌을 먼저 자르지 않고 모든 번역 문장을 평탄화해 표시 순서를 고정한다. */
export function flattenTranslatedFindings<
  T extends { key_finding_ko?: string },
>(items: T[], paperNumberOffset = 0): FlattenedTranslatedFinding<T>[] {
  return items.flatMap((item, paperIndex) =>
    splitEvidenceSentences(item.key_finding_ko ?? "").map(
      (sentence, sentenceIndex) => ({
        item,
        paperNumber: paperNumberOffset + paperIndex + 1,
        sentence,
        sentenceIndex,
      }),
    ),
  );
}

/** 봉인 데이터의 locator에 문장이 붙은 예전 형식도 표시 계층에서 복원한다. */
export function deriveEvidenceSource(keyFinding: string, locator: string) {
  const normalizedLocator = locator.trim();
  const locatorMatch = /^([A-Z_]+_\d+):\s*([\s\S]+)$/.exec(normalizedLocator);
  return {
    sourceLocator: locatorMatch?.[1] ?? normalizedLocator,
    sourceSentence: keyFinding.trim() || locatorMatch?.[2]?.trim() || "",
  };
}
