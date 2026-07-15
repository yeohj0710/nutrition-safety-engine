import { describe, expect, it } from "vitest";
import {
  hasMultiValue,
  splitMultiValue,
  toggleMultiValue,
} from "@/src/lib/multi-value-input";

describe("multi-value input", () => {
  it("adds and removes ordinary choices without losing other selections", () => {
    const first = toggleMultiValue("", "와파린");
    const second = toggleMultiValue(first, "아스피린");

    expect(second).toBe("와파린 · 아스피린");
    expect(splitMultiValue(second)).toEqual(["와파린", "아스피린"]);
    expect(hasMultiValue(second, "와파린")).toBe(true);
    expect(toggleMultiValue(second, "와파린")).toBe("아스피린");
  });

  it("keeps absence and uncertainty choices mutually exclusive", () => {
    const exclusive = ["복용 약 없음", "잘 모르겠어요"];

    expect(
      toggleMultiValue("와파린 · 아스피린", "복용 약 없음", exclusive),
    ).toBe("복용 약 없음");
    expect(toggleMultiValue("복용 약 없음", "와파린", exclusive)).toBe(
      "와파린",
    );
    expect(toggleMultiValue("잘 모르겠어요", "잘 모르겠어요", exclusive)).toBe(
      "",
    );
  });

  it("treats no current symptoms as exclusive", () => {
    expect(
      toggleMultiValue(
        "코피가 남 · 멍이 잘 듦",
        "특별한 증상 없음",
        ["특별한 증상 없음"],
      ),
    ).toBe("특별한 증상 없음");
    expect(
      toggleMultiValue(
        "특별한 증상 없음",
        "코피가 남",
        ["특별한 증상 없음"],
      ),
    ).toBe("코피가 남");
  });
});
