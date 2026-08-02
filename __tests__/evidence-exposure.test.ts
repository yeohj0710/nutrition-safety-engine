import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/personalized-safety/route";
import { axisIds, situationIds, type AxisId } from "@/src/lib/clinical-situations";
import extended from "@/research/systematic_review_v40/extended_evidence_v40.json";

const AXES = [...axisIds] as AxisId[];

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

function subsets<T>(items: T[]): T[][] {
  return items.reduce<T[][]>(
    (acc, item) => acc.concat(acc.map((s) => [...s, item])),
    [[]],
  );
}

/**
 * 근거가 골고루 노출되는지 고정한다.
 *
 * 예전에는 확장 목록을 파일 순서대로 잘라 보여줬다. 어떤 조건을 넣든 같은 문헌이
 * 앞에 와서 1,899건 가운데 화면에 닿는 것이 650건(34%)뿐이었다. 지금은 조건 적합도와
 * 다양성으로 점수를 매기고, 점수 구간을 띠로 나눈 뒤 띠마다 질의별 회전값으로 하나씩
 * 꺼내 페이지를 엮는다. 이 성질이 깨지면 노출이 다시 상위 몇 건으로 몰린다.
 */
describe("근거 노출 분포", () => {
  it("조건이 다르면 확장 첫 페이지도 달라진다", async () => {
    const situation = "HRS3_PREGNANCY";
    const a = await ask({ situation, axes: [], expanded: true, offset: 0 });
    const b = await ask({
      situation,
      axes: ["age_group"],
      expanded: true,
      offset: 0,
    });
    const idsA = (a.evidence as { record_id: string }[]).map((e) => e.record_id);
    const idsB = (b.evidence as { record_id: string }[]).map((e) => e.record_id);
    const shared = idsA.filter((id) => idsB.includes(id)).length;
    expect(shared).toBeLessThan(idsA.length);
  });

  it("같은 입력은 항상 같은 순서를 준다", async () => {
    const query = {
      situation: "HRS1_PERIOPERATIVE",
      axes: ["age_group", "underlying_condition"],
      expanded: true,
      offset: 0,
    };
    const first = await ask(query);
    const second = await ask(query);
    expect(
      (first.evidence as { record_id: string }[]).map((e) => e.record_id),
    ).toEqual((second.evidence as { record_id: string }[]).map((e) => e.record_id));
  });

  it("한 페이지가 상위·중위·하위 근거를 함께 담는다", async () => {
    // 띠 엮기가 살아 있으면 한 페이지 안에 우선순위 점수 폭이 넓게 남는다.
    const body = await ask({
      situation: "HRS3_PREGNANCY",
      axes: [],
      expanded: true,
      offset: 0,
    });
    const scores = (body.evidence as { priority_score: number }[]).map(
      (e) => Number(e.priority_score ?? 0),
    );
    expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThan(5);
  });

  it("모든 조건 조합을 합치면 확장 근거의 절반 이상이 첫 페이지에 닿는다", async () => {
    const qs = (extended as { questions: Record<string, { record_id: string }[]> })
      .questions;
    const universe = new Set<string>();
    for (const q of Object.keys(qs))
      for (const row of qs[q]) universe.add(`${q}|${row.record_id}`);

    const seen = new Set<string>();
    for (const situation of situationIds) {
      for (const combo of subsets(AXES)) {
        const body = await ask({ situation, axes: combo, expanded: true, offset: 0 });
        for (const e of (body.evidence ?? []) as { record_id: string }[])
          seen.add(`${situation}|${e.record_id}`);
      }
    }
    // 파일 순서대로 자르던 때는 34.2% 였다.
    expect(seen.size / universe.size).toBeGreaterThan(0.5);
  }, 300000);
});
