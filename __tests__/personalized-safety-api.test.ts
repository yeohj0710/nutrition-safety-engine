import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/personalized-safety/route";
import rules from "@/research/systematic_review_v40/personalized_rules.json";
import {
  axes,
  situationIds,
  situations,
} from "@/src/lib/clinical-situations";
import { publicInputExamples } from "@/src/lib/personalized-safety-examples";

type Rule = {
  question_id: string;
  personalization_axis: string;
  all_evidence: { record_id: string }[];
  evidence: { record_id: string }[];
  clinical_recommendation: boolean;
  decision_authority: string;
  output_scope: string;
};

const allRules = rules as unknown as Rule[];

function ruleFor(situation: string, axis: string) {
  return allRules.find(
    (rule) =>
      rule.question_id === situation && rule.personalization_axis === axis,
  );
}

async function ask(input: Record<string, string>) {
  const response = await POST(
    new Request("http://localhost/api/personalized-safety", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return { status: response.status, body: await response.json() };
}

describe("personalized safety API", () => {
  it("rejects a situation that is not one of the five", async () => {
    const { status, body } = await ask({ situation: "HRS9_UNKNOWN" });
    expect(status).toBe(400);
    expect(body.error).toMatch(/다섯 상황/);
  });

  it("rejects a body that is not an object", async () => {
    const response = await POST(
      new Request("http://localhost/api/personalized-safety", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("has a base rule for every situation the UI offers", () => {
    for (const situation of situations) {
      expect(ruleFor(situation.id, "base"), situation.id).toBeTruthy();
    }
    expect(situations.map((item) => item.id).sort()).toEqual(
      [...situationIds].sort(),
    );
  });

  it("returns this situation's core evidence when no axis is filled", async () => {
    for (const situation of situationIds) {
      const base = ruleFor(situation, "base");
      const { status, body } = await ask({ situation });
      expect(status, situation).toBe(200);
      expect(body.evidence.length, situation).toBe(
        Math.min(5, base!.evidence.length),
      );
      expect(body.core_evidence_count, situation).toBe(
        base!.all_evidence.length,
      );
      expect(body.applied_axes, situation).toEqual([]);
    }
  });

  it("keeps only papers that report every axis the user filled", async () => {
    // 축을 채우면 그 축을 보고한 문헌만 남아야 한다. 규칙 파일이 축별로 이미
    // 부분집합을 갖고 있으므로 응답은 그 교집합 안에 있어야 한다.
    const situation = "HRS1_PERIOPERATIVE";
    const ageRule = ruleFor(situation, "age_group")!;
    const medicationRule = ruleFor(situation, "concomitant_medication")!;
    const intersection = new Set(
      ageRule.all_evidence
        .map((item) => item.record_id)
        .filter((id) =>
          medicationRule.all_evidence.some((item) => item.record_id === id),
        ),
    );

    const { status, body } = await ask({
      situation,
      age: "68세",
      medication: "아스피린",
    });
    expect(status).toBe(200);
    expect(body.applied_axes.map((item: { axis: string }) => item.axis)).toEqual(
      ["age_group", "concomitant_medication"],
    );
    expect(body.evidence.length).toBeLessThanOrEqual(intersection.size);
    for (const item of body.evidence as { record_id: string }[]) {
      expect(intersection.has(item.record_id), item.record_id).toBe(true);
    }
  });

  it("reports an axis it cannot apply instead of silently ignoring it", async () => {
    // HRS2 에는 sex 축이 없다. 없는 축으로 걸러낸 척하면 안 된다.
    expect(ruleFor("HRS2_KIDNEY_DISEASE", "sex")).toBeUndefined();
    const { body } = await ask({ situation: "HRS2_KIDNEY_DISEASE", sex: "여성" });
    expect(body.unavailable_axes).toEqual([
      { axis: "sex", field: "sex", value: "여성" },
    ]);
    expect(body.applied_axes).toEqual([]);
  });

  it("treats 없음 and 모름 as an unfilled field", async () => {
    const { body } = await ask({
      situation: "HRS5_ANTICOAGULATION",
      medication: "없음",
      condition: "모름",
    });
    expect(body.applied_axes).toEqual([]);
    expect(body.unavailable_axes).toEqual([]);
  });

  it("never emits a clinical direction", async () => {
    for (const example of publicInputExamples) {
      const { status, body } = await ask(example.input);
      expect(status, example.title).toBe(200);
      expect(body.clinical_recommendation, example.title).toBe(false);
      expect(body.decision_authority, example.title).toBe("none");
      expect(body.output_scope, example.title).toBe("evidence_linking_only");
      expect(body.disclaimer, example.title).toMatch(/지시하지 않으며/);
      // 복용을 지시하는 표현이 요약에 섞이면 안 된다.
      expect(body.summary, example.title).not.toMatch(
        /복용을 (?:중단|시작)|용량을 (?:줄|늘)|드시지 마|끊으세요/,
      );
    }
  });

  it("says so plainly when the filters leave nothing", async () => {
    // 다섯 축을 모두 채우면 교집합이 빌 수 있다. 그때도 200 이고 이유를 말해야 한다.
    const { status, body } = await ask({
      situation: "HRS2_KIDNEY_DISEASE",
      age: "68세",
      medication: "와파린",
      dose: "2000 mg",
      condition: "고혈압",
    });
    expect(status).toBe(200);
    if (body.evidence.length === 0)
      expect(body.summary).toMatch(/문헌은 없습니다/);
  });

  it("answers every public example without an error", async () => {
    for (const example of publicInputExamples) {
      const { status, body } = await ask(example.input);
      expect(status, example.title).toBe(200);
      expect(body.error, example.title).toBeUndefined();
      expect(body.situation_label, example.title).toBeTruthy();
      expect(body.research_question, example.title).toBeTruthy();
      expect(body.evidence.length, example.title).toBeLessThanOrEqual(5);
      for (const item of body.evidence as { url: string; locator: string }[]) {
        expect(item.url, example.title).toMatch(/^https:\/\/pubmed\./);
        expect(item.locator, example.title).toBeTruthy();
      }
    }
  });

  it("covers every axis the UI shows with a real rule in at least one situation", () => {
    for (const axis of axes) {
      const found = situationIds.some((situation) =>
        Boolean(ruleFor(situation, axis.id)),
      );
      expect(found, axis.id).toBe(true);
    }
  });
});
