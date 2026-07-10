import { describe, expect, it, vi } from "vitest";

import warfarinScenario from "@/__tests__/fixtures/warfarin-vitamin-k.json";
import { POST } from "@/app/api/legacy/rules/query/route";
import type { EngineResponse } from "@/src/types/knowledge";

vi.mock("server-only", () => ({}));

describe("legacy mode boundary", () => {
  it("serves a known baseline rule only from the explicit legacy endpoint", async () => {
    const response = await POST(
      new Request("http://localhost/api/legacy/rules/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(warfarinScenario.query),
      }),
    );
    const payload = (await response.json()) as EngineResponse;
    const matchedIds = new Set(
      payload.definitely_matched.map((match) => match.ruleId),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Research-Mode")).toBe("legacy_unverified");
    expect(matchedIds.has("RULE-VITK-WARFARIN-CONSISTENCY")).toBe(true);
  });
});
