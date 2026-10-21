import { describe, expect, it } from "vitest";

import { cleanTallyRow, summarizeTally } from "@/src/lib/consult-tally";

describe("연구별 결과 집계", () => {
  const source = "Pregnant women received 60 mg iron daily. Anaemia at delivery was 40% lower.";

  it("원자료에 없는 숫자가 든 글 칸은 비우고, 정해진 값 밖의 선택지는 안전한 값으로 바꾼다", () => {
    const row = cleanTallyRow(
      "pubmed:1",
      { relation: "직접 먹인 연구", exposure: "먹는 철분 60mg, 매일", outcome: "빈혈 2.7 감소", direction: "아주 좋아짐", harm: "언급 없음", harmNote: "" },
      source,
    );
    expect(row.exposure).toBe("먹는 철분 60mg, 매일");
    expect(row.outcome).toBe("");
    expect(row.direction).toBe("결과 없음");
    expect(row.relation).toBe("직접 먹인 연구");
  });

  it("가운뎃점과 줄표는 쉼표로 바꾼다", () => {
    const row = cleanTallyRow("pubmed:1", { relation: "직접 먹인 연구", exposure: "철분·엽산", outcome: "빈혈", direction: "좋아짐", harm: "부작용 보고", harmNote: "변비—메스꺼움" }, source);
    expect(row.exposure).not.toMatch(/[·—]/);
    expect(row.harmNote).not.toMatch(/[·—]/);
  });

  it("관계와 방향별로 센다", () => {
    const base = { exposure: "", outcome: "", harm: "언급 없음" as const, harmNote: "" };
    const summary = summarizeTally([
      { ...base, recordId: "a", relation: "직접 먹인 연구", direction: "좋아짐" },
      { ...base, recordId: "b", relation: "직접 먹인 연구", direction: "좋아짐" },
      { ...base, recordId: "c", relation: "직접 먹인 연구", direction: "차이 없음" },
      { ...base, recordId: "d", relation: "결과로만 잰 연구", direction: "나빠짐" },
    ]);
    expect(summary.map((group) => [group.relation, group.total])).toEqual([
      ["직접 먹인 연구", 3],
      ["결과로만 잰 연구", 1],
    ]);
    expect(summary[0].byDirection[0]).toEqual({ direction: "좋아짐", recordIds: ["a", "b"] });
  });
});
