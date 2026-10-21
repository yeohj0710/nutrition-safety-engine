import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/personalized-safety/route";
import traits from "@/research/systematic_review/record_traits/HRS3_PREGNANCY.json";

async function ask(body: unknown) {
  const res = await POST(
    new Request("http://localhost/api/personalized-safety", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return res.json();
}

const mentionsIron = (id: string) =>
  Boolean((traits as Record<string, { i: string[] }>)[id]?.i.includes("iron"));

describe("성분을 적으면 그 성분을 다룬 문헌을 앞에 둔다", () => {
  it("임신 중 철분제 30mg: 같은 조건 문헌 가운데 철분 연구가 먼저 나온다", async () => {
    const body = await ask({
      situation: "HRS3_PREGNANCY",
      axes: ["dose_range"],
      marks: { ingredients: ["iron"], age: null, dose: { value: 30, family: "mass", text: "30mg" } },
    });
    const ids = (body.evidence as { record_id: string }[]).map((item) => item.record_id);
    expect(ids.length).toBe(15);
    expect(body.ingredient_first?.shown).toBeGreaterThanOrEqual(10);
    // 철분 연구가 앞에 모여 있고, 철분이 아닌 연구는 뒤에만 온다.
    const firstOther = ids.findIndex((id) => !mentionsIron(id));
    if (firstOther >= 0) expect(ids.slice(firstOther).every((id) => !mentionsIron(id))).toBe(true);
    expect(mentionsIron(ids[0])).toBe(true);
  });

  it("투석 65세 철분 100mg: 나이와 양까지 맞는 철분 연구가 맨 앞에 온다", async () => {
    const body = await ask({
      situation: "HRS2_KIDNEY_DISEASE",
      axes: ["age_group", "dose_range"],
      marks: { ingredients: ["iron"], age: 65, dose: { value: 100, family: "mass", text: "100mg" } },
    });
    const first = body.evidence[0].value_match;
    expect(first).toEqual({ ingredient: true, age: true, dose: true });
  });

  it("같은 입력에는 같은 목록이 나온다", async () => {
    const body = { situation: "HRS3_PREGNANCY", axes: ["dose_range"], marks: { ingredients: ["iron"] } };
    const first = (await ask(body)).evidence.map((item: { record_id: string }) => item.record_id);
    const second = (await ask(body)).evidence.map((item: { record_id: string }) => item.record_id);
    expect(second).toEqual(first);
  });

  it("성분을 적지 않으면 예전 목록 그대로다", async () => {
    const body = await ask({ situation: "HRS3_PREGNANCY", axes: ["dose_range"] });
    expect(body.ingredient_first).toBeNull();
  });
});
