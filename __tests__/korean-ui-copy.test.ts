import { describe, expect, it } from "vitest";

import rules from "@/research/systematic_review_v3/personalized_rules.json";
import { toHaeyoStyle } from "@/src/lib/korean-ui-copy";

describe("Korean public UI copy", () => {
  it.each([
    ["신장결석 발생과 관련이 없었습니다.", "신장결석 발생과 관련이 없었어요."],
    ["신장결석 위험을 증가시킬 수 있습니다.", "신장결석 위험을 증가시킬 수 있어요."],
    ["사람을 대상으로 한 임상시험입니다.", "사람을 대상으로 한 임상시험이에요."],
    ["위험이 증가할 것입니다.", "위험이 증가할 거예요."],
    ["요중 옥살산을 감소시킵니다.", "요중 옥살산을 감소시켜요."],
    ["효과가 더 큽니다.", "효과가 더 커요."],
    ["제품 라벨의 하루 양은 모릅니다.", "제품 라벨의 하루 양은 몰라요."],
    ["개인마다 결과가 다릅니다.", "개인마다 결과가 달라요."],
    ["출혈 위험이 커집니다.", "출혈 위험이 커져요."],
    ["이량은 결석 위험을 높입니다.", "이 양은 결석 위험을 높여요."],
  ])("converts formal endings without changing the claim", (source, expected) => {
    expect(toHaeyoStyle(source)).toBe(expected);
  });

  it("covers every Korean key finding shown in the public evidence list", () => {
    const evidence = rules.flatMap((rule) => rule.all_evidence ?? rule.evidence);

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
});
