import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 핵심 근거는 한국어를 달고 배포돼야 한다.
 *
 * 화면은 번역이 없는 기록에만 /api/consult/record 를 불러 한 줄을 사 온다
 * (src/components/personalized-safety-query.tsx). 그래서 번역이 비면 조회 한 번에
 * 모델 호출 12건이 나간다. v41 로 갈아끼울 때 실제로 그렇게 됐다. 번역 파트
 * 생성기가 v40 에서 물려받을 문장이 없는 64건에 숫자를 나열한 자리표시를 넣었고,
 * 라우트가 그것을 번역 없음으로 되돌리면서 화면이 매번 다시 샀다.
 *
 * 이 검사는 그 상태로 되돌아가는 것을 막는다. 값이 드는 회귀라 화면으로는 티가
 * 안 나고 요금으로만 보인다.
 */

const root = process.cwd();
const PLACEHOLDER = "원문에서 관찰된 결과를 확인합니다";

type Evidence = { record_id: string; key_finding_ko?: string };
type Rule = { rule_id: string; evidence?: Evidence[] };

const rules = JSON.parse(
  readFileSync(
    path.join(root, "research/systematic_review/personalized_rules.json"),
    "utf8",
  ),
) as Rule[];

const translations = JSON.parse(
  readFileSync(
    path.join(root, "research/systematic_review/key_finding_translations_ko.json"),
    "utf8",
  ),
) as {
  author: string;
  translations: { translation_id: string; translation_ko: string }[];
};

describe("핵심 근거 한국어 커버리지", () => {
  it("규칙 파일의 근거에 번역이 빠진 것이 없다", () => {
    const missing = rules
      .flatMap((rule) => (rule.evidence ?? []).map((item) => ({ rule, item })))
      .filter(({ item }) => !String(item.key_finding_ko ?? "").trim())
      .map(({ rule, item }) => `${rule.rule_id}|${item.record_id}`);
    expect(missing).toEqual([]);
  });

  it("자리표시가 근거로 나가지 않는다", () => {
    const leaked = rules
      .flatMap((rule) => (rule.evidence ?? []).map((item) => ({ rule, item })))
      .filter(({ item }) => String(item.key_finding_ko ?? "").startsWith(PLACEHOLDER))
      .map(({ rule, item }) => `${rule.rule_id}|${item.record_id}`);
    expect(leaked).toEqual([]);
  });

  it("번역 75건이 모두 사람이 읽는 문장이다", () => {
    expect(translations.translations).toHaveLength(75);
    const bad = translations.translations
      .filter((row) => {
        const line = String(row.translation_ko ?? "").trim();
        // 자리표시, 빈 줄, 가운뎃점 셋 다 화면에 나가면 안 된다.
        return !line || line.startsWith(PLACEHOLDER) || line.includes("·");
      })
      .map((row) => row.translation_id);
    expect(bad).toEqual([]);
  });

  it("번역 작성자를 실제 작성자로 적는다", () => {
    expect(translations.author).toBe("Claude");
  });
});
