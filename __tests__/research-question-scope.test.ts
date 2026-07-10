import { describe, expect, it } from "vitest";
import { protocolQuestions } from "@/src/domain/research-questions";

describe("thesis research-question scope", () => {
  it("keeps the five homepage questions aligned with protocol v1.0", () => {
    expect(protocolQuestions).toEqual([
      ["A1", "항응고제 복용자와 비타민 K 관련 안전성"],
      ["A2", "항응고제 복용자와 오메가-3 관련 안전성"],
      ["B1", "칼슘 보충제와 신장결석 위험"],
      ["B2", "비타민 D 보충제와 신장결석 위험"],
      ["B3", "비타민 C 보충제와 신장결석 위험"],
    ]);
  });
});
