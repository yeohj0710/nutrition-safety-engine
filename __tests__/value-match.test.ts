import { describe, expect, it } from "vitest";
import { matchRecord, readRecordDoses, readValueMarks, readValueQuery, valueMarks } from "@/src/lib/value-match";

describe("적어 주신 값과 문헌 대조", () => {
  const query = readValueQuery({
    text: "혈액투석을 받고 있는 65세 남성인데 철분제를 하루 100mg 먹고 있어요",
    age: "65세",
    dose: "하루 100mg",
  });

  it("문장에서 성분, 나이, 양을 읽는다", () => {
    expect(query.ingredients.map((item) => item.key)).toEqual(["iron"]);
    expect(query.age).toBe(65);
    expect(query.dose).toMatchObject({ value: 100, family: "mass" });
  });

  it("성분이 같고 나이 범위 안이며 양이 절반에서 두 배 사이면 맞다고 표시한다", () => {
    const match = matchRecord(query, { i: ["iron", "vitamin_d"], a: [[50, 80]] }, "60 mg/day | 2 g");
    expect(match).toEqual({ ingredient: true, age: true, dose: true });
  });

  it("다른 성분, 범위 밖 나이, 먼 양은 아니라고 표시한다", () => {
    const match = matchRecord(query, { i: ["calcium"], a: [[18, 40]] }, "1000 mg/day");
    expect(match).toEqual({ ingredient: false, age: false, dose: false });
  });

  it("문헌에 나이나 양 정보가 없으면 판단하지 않는다", () => {
    expect(matchRecord(query, { i: ["iron"], a: [] }, "")).toEqual({ ingredient: true, age: null, dose: null });
  });

  it("체중당 양과 IU는 mg 와 비교하지 않는다", () => {
    expect(readRecordDoses("25 mg/kg/day | 2000 IU daily | 1,500 µg")).toEqual([
      { value: 2000, family: "iu" },
      { value: 1.5, family: "mass" },
    ]);
  });

  it("조회 요청에는 문장 대신 읽은 값만 싣고, 받는 쪽은 사전 밖 값을 버린다", () => {
    const marks = valueMarks(query)!;
    expect(JSON.stringify(marks)).not.toContain("혈액투석");
    expect(readValueMarks(marks)).toEqual(query);
    expect(readValueMarks({ ingredients: ["없는성분"], age: 500, dose: { value: -1, family: "mass" } })).toBeNull();
  });

  it("읽은 값이 없으면 대조하지 않는다", () => {
    const empty = readValueQuery({ text: "수술 앞두고 궁금해요" });
    expect(empty).toEqual({ ingredients: [], age: null, dose: null });
  });
});
