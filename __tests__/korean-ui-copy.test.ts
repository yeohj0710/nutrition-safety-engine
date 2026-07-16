import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import rules from "@/research/systematic_review_v3/personalized_rules.json";
import { toHaeyoStyle } from "@/src/lib/korean-ui-copy";

describe("Korean public UI copy", () => {
  it.each([
    ["신장결석 발생과 관련이 없었습니다.", "신장결석 발생과 관련이 없었어요."],
    [
      "신장결석 위험을 증가시킬 수 있습니다.",
      "신장결석 위험을 증가시킬 수 있어요.",
    ],
    [
      "사람을 대상으로 한 임상시험입니다.",
      "사람을 대상으로 한 임상시험이에요.",
    ],
    ["위험이 증가할 것입니다.", "위험이 증가할 거예요."],
    ["요중 옥살산을 감소시킵니다.", "요중 옥살산을 감소시켜요."],
    ["효과가 더 큽니다.", "효과가 더 커요."],
    ["제품 라벨의 하루 양은 모릅니다.", "제품 라벨의 하루 양은 몰라요."],
    ["개인마다 결과가 다릅니다.", "개인마다 결과가 달라요."],
    ["현재 용량을 줄이는 쪽이 맞습니다.", "현재 용량을 줄이는 쪽이 맞아요."],
    ["출혈 위험이 커집니다.", "출혈 위험이 커져요."],
    ["이량은 결석 위험을 높입니다.", "이 양은 결석 위험을 높여요."],
  ])(
    "converts formal endings without changing the claim",
    (source, expected) => {
      expect(toHaeyoStyle(source)).toBe(expected);
    },
  );

  it("covers every Korean key finding shown in the public evidence list", () => {
    const evidence = rules.flatMap(
      (rule) => rule.all_evidence ?? rule.evidence,
    );

    for (const item of evidence) {
      const converted = toHaeyoStyle(item.key_finding_ko);
      expect(converted, item.record_id).not.toMatch(
        /(?:습니다|합니다|입니다)(?=[.!?]|$)/,
      );
      expect(converted.match(/\d+(?:[.,]\d+)?/g)).toEqual(
        item.key_finding_ko.match(/\d+(?:[.,]\d+)?/g),
      );
    }
  });

  it("preserves the calcium-to-oxalate direction reported by the paper", () => {
    const item = rules
      .flatMap((rule) => rule.all_evidence ?? rule.evidence)
      .find((evidence) => evidence.record_id === "REC-PUBMED-11271790");

    expect(item?.key_finding_ko).toContain("칼슘에 대한 옥살레이트의 비율");
    expect(item?.key_finding_ko).not.toContain("옥살레이트에 대한 칼슘의 비율");
  });

  it("does not expose the PubMed abstract unit typo for the vitamin D trial", () => {
    const item = rules
      .flatMap((rule) => rule.all_evidence ?? rule.evidence)
      .find((evidence) => evidence.record_id === "REC-PUBMED-23595003");

    expect(item?.key_finding).not.toContain("250 mg/week");
    expect(item?.key_finding).toContain("1250 μg treatment group");
    expect(item?.key_finding_ko).toContain("1,250 μg 투여군");
  });

  it("keeps every core evidence record in all_evidence", () => {
    const csv = readFileSync(
      "research/systematic_review_v3/core_evidence.csv",
      "utf8",
    );
    const coreIds = new Set(
      [...csv.matchAll(/^(A1|A2|B1|B2|B3),(REC-PUBMED-\d+),/gm)].map(
        ([, questionId, recordId]) => `${questionId}:${recordId}`,
      ),
    );
    const ruleIds = new Set(
      rules.flatMap((rule) =>
        rule.all_evidence.map(
          (evidence) => `${rule.question_id}:${evidence.record_id}`,
        ),
      ),
    );

    expect(ruleIds.size).toBe(121);
    expect(ruleIds).toEqual(coreIds);
  });
});
