/**
 * 처음 보는 사람이 읽는 화면용 말.
 *
 * 연구 결과 문장에는 신뢰구간, p값, 효과크기가 괄호로 붙어 있다. 숫자를 지우는
 * 것이 아니라 첫 화면에서만 괄호 속 통계를 접고, 원래 문장은 '자세히' 안에 그대로
 * 둔다. 논문에 적힌 결과의 방향(줄었다, 차이가 없었다)은 괄호 밖에 있으므로 남는다.
 */

const STAT_PATTERN =
  /(95\s*%|\bCI\b|신뢰구간|\b[Pp]\s*[<>=≤≥]|\b(?:ES|OR|HR|RR|SMD|WMD|MD|aOR|IRR)\b|±|\bSD\b|\bvs\.?)/;

/** 괄호 묶음 가운데 통계값만 담은 것을 뺀다. 안쪽 대괄호는 같은 묶음으로 본다. */
export function withoutStatistics(text: string): string {
  if (!text) return text;
  let out = "";
  let depth = 0;
  let group = "";
  for (const char of text) {
    if (char === "(" || char === "（") {
      if (depth === 0) group = "";
      depth += 1;
      group += char;
      continue;
    }
    if (depth > 0) {
      group += char;
      if (char === ")" || char === "）") {
        depth -= 1;
        if (depth === 0) {
          const inner = group.slice(1, -1);
          if (!(STAT_PATTERN.test(inner) && /\d/.test(inner))) out += group;
        }
      }
      continue;
    }
    out += char;
  }
  if (depth > 0) out += group;
  return out
    .replace(/[;,]\s*[Pp]\s*[<>=≤≥]\s*0?\.\d+/g, "")
    // 번역문에 남은 가운뎃점은 쉼표로 읽는다.
    .replace(/\s*·\s*/g, ", ")
    .replace(/\s+([,.)])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const STUDY_KINDS: [RegExp, string][] = [
  [/Meta-Analysis/i, "메타분석"],
  [/Systematic Review/i, "체계적 문헌고찰"],
  [/Randomized Controlled Trial/i, "무작위 임상시험"],
  [/Clinical Trial/i, "임상시험"],
  [/Observational Study|Cohort|Case-Control/i, "관찰 연구"],
  [/Case Reports?/i, "증례 보고"],
  [/Practice Guideline|Guideline|Consensus/i, "진료 지침"],
  [/\bReview\b/i, "종설"],
  [/Comparative Study/i, "비교 연구"],
];

/** PubMed 출판유형 가운데 가장 구체적인 것 하나를 우리말로. */
export function studyKind(publicationTypes: string): string {
  for (const [pattern, label] of STUDY_KINDS) if (pattern.test(publicationTypes)) return label;
  return "연구 논문";
}
