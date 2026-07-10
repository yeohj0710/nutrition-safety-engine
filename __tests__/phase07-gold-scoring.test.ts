import { describe, expect, it } from "vitest";
import { scoreActions } from "@/src/validation/score-engine-gold";

describe("independent gold scoring", () => {
  const a = { rule_id: "R1", action_class: "avoid_until_review" };
  const b = { rule_id: "R2", action_class: "information_only" };
  it("scores exact action sets", () => expect(scoreActions([a], [a])).toMatchObject({ tp: 1, fp: 0, fn: 0, exact: true }));
  it("keeps false negatives and false positives in separate denominators", () => {
    const value = scoreActions([a], [b]);
    expect(value).toMatchObject({ tp: 0, fp: 1, fn: 1, exact: false });
    expect(value.precision.N).toBe(1); expect(value.recall.N).toBe(1);
  });
  it("does not invent a rate for two empty action sets", () => {
    const value = scoreActions([], []);
    expect(value.exact).toBe(true); expect(value.precision.rate).toBeNull(); expect(value.recall.rate).toBeNull();
  });
});
