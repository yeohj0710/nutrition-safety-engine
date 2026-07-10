import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runThesisEngine } from "@/src/engine/run-thesis-engine";

const projectRoot = process.cwd();

describe("thesis mode boundary", () => {
  it("returns one deterministic, empty validated-scope response", () => {
    const query = {
      profile: { age: 67, medications: ["warfarin"] },
      candidateItems: [{ name: "vitamin K" }],
    };

    const first = runThesisEngine(query);
    const second = runThesisEngine(query);

    expect(second).toEqual(first);
    expect(first.scope).toBe("validated_thesis_scope");
    expect(first.matched_rules).toEqual([]);
    expect(first.evidence_claims).toEqual([]);
    expect(first.actions).toEqual([]);
    expect(first.limitations).toContain(
      "검증 완료된 근거 주장과 규칙이 아직 없어 개인별 판단을 제공하지 않습니다.",
    );
    expect(JSON.stringify(first)).not.toContain("RULE-VITK-WARFARIN-CONSISTENCY");
  });

  it("keeps the default page free of legacy imports and research counts", () => {
    const source = readFileSync(path.join(projectRoot, "app", "page.tsx"), "utf8");

    expect(source).not.toContain("literature-candidates.json");
    expect(source).not.toContain("RuleExplorerClient");
    expect(source).not.toMatch(/12,?023|252,?502|214개|236개/);
    expect(source).toContain("validated_thesis_scope");
  });

  it("has no runtime AI route or client fetch", () => {
    expect(
      existsSync(path.join(projectRoot, "app", "api", "ai-explain", "route.ts")),
    ).toBe(false);

    const clientSource = readFileSync(
      path.join(projectRoot, "src", "components", "rule-explorer-client.tsx"),
      "utf8",
    );
    expect(clientSource).not.toContain("/api/ai-explain");
  });
});
