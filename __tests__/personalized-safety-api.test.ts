import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/personalized-safety/route";
import rules from "@/research/systematic_review_v40/personalized_rules.json";
import {
  axes,
  situationIds,
  situations,
} from "@/src/lib/clinical-situations";
import { publicInputExamples } from "@/src/lib/personalized-safety-examples";
import { axisCoverage, coreCoverage } from "@/src/lib/axis-coverage";
import { flattenTranslatedFindings } from "@/src/lib/evidence-sentences";

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

// 표시 개수 상한은 라우트가 정한다. 여기에 숫자를 다시 적으면 상한을 바꿀 때
// 화면은 바뀌었는데 테스트만 옛 숫자를 지키는 상태가 된다. 상한 자체가 아니라
// "핵심 근거를 잘라 보여주지 않는다"는 성질을 검사한다.
const selectedLimit = Math.max(
  ...situationIds.map(
    (situation) => ruleFor(situation, "base")?.all_evidence.length ?? 0,
  ),
);

function ruleFor(situation: string, axis: string) {
  return allRules.find(
    (rule) =>
      rule.question_id === situation && rule.personalization_axis === axis,
  );
}

async function ask(input: Record<string, unknown>) {
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
      // 핵심 근거는 all_evidence 다. 규칙 파일의 `evidence` 는 빌더가 만든 상위 3건
      // 미리보기이므로 표시 개수의 기준이 아니다.
      expect(body.evidence.length, situation).toBe(
        Math.min(selectedLimit, base!.all_evidence.length),
      );
      expect(body.core_evidence_count, situation).toBe(
        base!.all_evidence.length,
      );
      expect(body.applied_axes, situation).toEqual([]);
    }
  });

  it("never shows fewer papers with no filter than with a filter", async () => {
    // 조건을 안 넣은 화면이 조건을 넣은 화면보다 좁으면 안 된다. 예전에 아무 축도
    // 적용하지 않은 경로만 상위 3건 미리보기를 써서 이 역전이 실제로 있었다.
    for (const situation of situationIds) {
      const { body: unfiltered } = await ask({ situation });
      for (const axis of ["age", "medication", "dose", "sex", "condition"]) {
        const { body: filtered } = await ask({ situation, [axis]: "확인" });
        expect(
          unfiltered.evidence.length,
          `${situation} / ${axis}`,
        ).toBeGreaterThanOrEqual(filtered.evidence.length);
      }
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

  it("accepts explicit metadata-axis filters without pretending to match values", async () => {
    const { status, body } = await ask({
      situation: "HRS1_PERIOPERATIVE",
      axes: ["age_group", "concomitant_medication"],
    });
    expect(status).toBe(200);
    expect(body.matching_basis).toBe("metadata_axis_presence");
    expect(body.applied_axes.map((item: { axis: string }) => item.axis)).toEqual([
      "age_group",
      "concomitant_medication",
    ]);
    expect(body.query_snapshot.requested_axes).toEqual([
      "age_group",
      "concomitant_medication",
    ]);
    expect(body.filter_trace.map((item: { count: number }) => item.count)).toEqual([
      15,
      7,
      1,
    ]);
  });

  it("treats an explicit axes array as authoritative over legacy value fields", async () => {
    const { status, body } = await ask({
      situation: "HRS1_PERIOPERATIVE",
      axes: ["age_group"],
      medication: "와파린",
      dose: "2000 mg",
    });
    expect(status).toBe(200);
    expect(body.query_snapshot.requested_axes).toEqual(["age_group"]);
    expect(body.query_snapshot.active_axes).toEqual(["age_group"]);
    expect(body.applied_axes.map((item: { axis: string }) => item.axis)).toEqual([
      "age_group",
    ]);
    expect(body.filter_trace).toHaveLength(2);
  });

  it("ignores every legacy value in all derived output when axes is present", async () => {
    const baseline = await ask({
      situation: "HRS1_PERIOPERATIVE",
      axes: [],
    });
    const withLegacyDose = await ask({
      situation: "HRS1_PERIOPERATIVE",
      axes: [],
      dose: "2000 mg",
    });

    expect(withLegacyDose.status).toBe(200);
    expect(withLegacyDose.body.inputs).toEqual({
      age: "",
      medication: "",
      dose: "",
      sex: "",
      condition: "",
    });
    expect(withLegacyDose.body.query_snapshot).toEqual(
      baseline.body.query_snapshot,
    );
    expect(withLegacyDose.body.summary).toBe(baseline.body.summary);
    expect(withLegacyDose.body.narrative).toEqual(baseline.body.narrative);
    expect(
      withLegacyDose.body.evidence.map((item: { record_id: string }) => item.record_id),
    ).toEqual(
      baseline.body.evidence.map((item: { record_id: string }) => item.record_id),
    );
  });

  it("rejects unknown metadata-axis filters", async () => {
    const { status, body } = await ask({
      situation: "HRS1_PERIOPERATIVE",
      axes: ["age_group", "made_up_axis"],
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/필터/);
  });

  it("reports a requested filter that this situation cannot apply", async () => {
    const { status, body } = await ask({
      situation: "HRS2_KIDNEY_DISEASE",
      axes: ["sex"],
    });
    expect(status).toBe(200);
    expect(body.applied_axes).toEqual([]);
    expect(body.unavailable_axes).toEqual([
      { axis: "sex", field: "sex", value: "" },
    ]);
    expect(body.query_snapshot.requested_axes).toEqual(["sex"]);
    expect(body.narrative[0]).toMatch(/적용 가능한 표현 필터가/);
  });

  it("keeps an unavailable legacy field in the requested snapshot", async () => {
    const { status, body } = await ask({
      situation: "HRS2_KIDNEY_DISEASE",
      sex: "여성",
    });
    expect(status).toBe(200);
    expect(body.query_snapshot.requested_axes).toEqual(["sex"]);
    expect(body.query_snapshot.active_axes).toEqual([]);
    expect(body.unavailable_axes.map((item: { axis: string }) => item.axis)).toEqual([
      "sex",
    ]);
  });

  it("keeps available and unavailable legacy fields in one coherent snapshot", async () => {
    const { status, body } = await ask({
      situation: "HRS2_KIDNEY_DISEASE",
      age: "68세",
      sex: "여성",
    });
    expect(status).toBe(200);
    expect(body.query_snapshot.requested_axes).toEqual(["age_group", "sex"]);
    expect(body.query_snapshot.active_axes).toEqual(["age_group"]);
    expect(body.applied_axes.map((item: { axis: string }) => item.axis)).toEqual([
      "age_group",
    ]);
    expect(body.unavailable_axes.map((item: { axis: string }) => item.axis)).toEqual([
      "sex",
    ]);
  });

  it("keeps the collection overview separate from an individual paper finding", async () => {
    const { status, body } = await ask({ situation: "HRS1_PERIOPERATIVE" });
    expect(status).toBe(200);
    expect(body.evidence.length).toBeGreaterThan(1);
    expect(body.narrative[1]).not.toContain(body.evidence[0].key_finding_ko);
  });

  it("says so plainly when the filters leave nothing", async () => {
    // 이 조합은 봉인된 규칙 파일에서 실제 교집합이 0건이다. 0건 상태가 우연히
    // 생길 때만 검사하면 회귀를 놓치므로 응답 수까지 고정한다.
    const { status, body } = await ask({
      situation: "HRS1_PERIOPERATIVE",
      axes: ["age_group", "concomitant_medication", "dose_range"],
    });
    expect(status).toBe(200);
    expect(body.evidence).toHaveLength(0);
    expect(body.evidence_total_after_filter).toBe(0);
    expect(body.summary).toMatch(/문헌은 없습니다/);
  });

  it("answers every public example without an error", async () => {
    for (const example of publicInputExamples) {
      const { status, body } = await ask(example.input);
      expect(status, example.title).toBe(200);
      expect(body.error, example.title).toBeUndefined();
      expect(body.situation_label, example.title).toBeTruthy();
      expect(body.research_question, example.title).toBeTruthy();
      expect(body.evidence.length, example.title).toBeLessThanOrEqual(
        selectedLimit,
      );
      expect(body.evidence_total_after_filter, example.title).toBe(
        example.expectedEvidenceCount,
      );
      for (const item of body.evidence as { url: string; locator: string }[]) {
        expect(item.url, example.title).toMatch(/^https:\/\/pubmed\./);
        expect(item.locator, example.title).toBeTruthy();
      }
    }
  });

  it("returns an explicit evidence display summary", async () => {
    const { status, body } = await ask({ situation: "HRS4_LIVER_DISEASE" });
    expect(status).toBe(200);
    expect(body.evidence_summary.displayed_records).toBe(15);
    expect(body.evidence_summary.unique_titles).toBe(14);
    expect(body.evidence_summary.source_scope).toEqual({
      abstract_only: 15,
      title_only: 0,
    });
    expect(body.evidence_summary.ai_extracted_sentences).toBe(15);
    expect(body.evidence_summary.ai_translated_sentences).toBe(
      flattenTranslatedFindings(body.evidence).length,
    );
  });

  it("counts rendered translated sentences instead of translated papers", async () => {
    const { status, body } = await ask({ situation: "HRS1_PERIOPERATIVE" });
    expect(status).toBe(200);
    expect(body.evidence_summary.ai_translated_sentences).toBe(
      flattenTranslatedFindings(body.evidence).length,
    );
    expect(body.evidence_summary.ai_translated_sentences).toBeGreaterThan(
      body.evidence_summary.displayed_records,
    );
  });

  it("applies the same axis filter beyond the 15-item core in expanded mode", async () => {
    const { status, body } = await ask({
      situation: "HRS1_PERIOPERATIVE",
      axes: ["age_group"],
      expanded: true,
      offset: 0,
    });
    expect(status).toBe(200);
    // 축 색인이 확장 근거에도 있으므로 확장 보기에서도 조건이 걸린다.
    expect(body.filter_mode).toBe("metadata_axis_presence");
    expect(body.matching_basis).toBe("metadata_axis_presence_extended");
    expect(body.applied_axes.map((item: { axis: string }) => item.axis)).toEqual([
      "age_group",
    ]);
    expect(body.ignored_axes).toEqual([]);
    // 걸린 결과는 그 상황 전체보다 좁고, 핵심 근거 15건보다는 넓다.
    expect(body.extended_total).toBeLessThan(body.extended_pool_total);
    expect(body.extended_total).toBeGreaterThan(body.core_evidence_count);
    expect(body.evidence_total_after_filter).toBe(body.extended_total);
    expect(body.filter_trace.at(-1)).toMatchObject({
      axis: "age_group",
      count: body.extended_total,
    });
    expect(body.evidence[0].source_sentence).toBe(body.evidence[0].key_finding);
    expect(body.evidence[0].translation_authorship).toBeNull();
  });

  it("reports the condition-matched extended count before opening expanded view", async () => {
    const { status, body } = await ask({
      situation: "HRS3_PREGNANCY",
      axes: ["age_group", "concomitant_medication", "underlying_condition"],
    });
    expect(status).toBe(200);
    // 기본 화면은 핵심 근거 15건 안에서만 좁혀 몇 건 남지 않는다.
    expect(body.evidence.length).toBeLessThanOrEqual(15);
    // 그런데 같은 조건에 해당하는 확장 근거 수는 확장 보기를 열기 전에 이미 알려준다.
    expect(body.extended_match_total).toBeGreaterThan(body.evidence.length);
    expect(body.extended_match_total).toBeLessThan(body.extended_pool_total);
    expect(body.extended_total).toBe(body.extended_match_total);
  });

  it("narrows the expanded pool further as axes stack", async () => {
    const counts: number[] = [];
    for (const axes of [[], ["age_group"], ["age_group", "concomitant_medication"]]) {
      const { status, body } = await ask({
        situation: "HRS1_PERIOPERATIVE",
        axes,
        expanded: true,
        offset: 0,
      });
      expect(status).toBe(200);
      counts.push(body.extended_total);
    }
    expect(counts[0]).toBeGreaterThan(counts[1]);
    expect(counts[1]).toBeGreaterThan(counts[2]);
    // 조건 두 개를 걸어도 핵심 근거 15건짜리 경로보다 넓게 남는다.
    expect(counts[2]).toBeGreaterThan(15);
  });

  it("counts title-derived expanded records separately from extracted abstract sentences", async () => {
    const { status, body } = await ask({
      situation: "HRS1_PERIOPERATIVE",
      expanded: true,
      offset: 300,
    });
    expect(status).toBe(200);
    expect(body.evidence_summary.displayed_records).toBe(12);
    expect(body.evidence_summary.source_scope).toEqual({
      abstract_only: 11,
      title_only: 1,
    });
    expect(body.evidence_summary.ai_extracted_sentences).toBe(11);
    expect(body.evidence_summary.title_derived_records).toBe(1);
  });

  it("does not claim that filters were ignored for an unfiltered expanded request", async () => {
    const { status, body } = await ask({
      situation: "HRS1_PERIOPERATIVE",
      axes: [],
      expanded: true,
    });
    expect(status).toBe(200);
    expect(body.query_snapshot.requested_axes).toEqual([]);
    expect(body.ignored_axes).toEqual([]);
    expect(body.extended_note).not.toMatch(/필터.*적용하지/);
    expect(body.summary).not.toMatch(/필터.*적용하지/);
  });

  it("covers every axis the UI shows with a real rule in at least one situation", () => {
    for (const axis of axes) {
      const found = situationIds.some((situation) =>
        Boolean(ruleFor(situation, axis.id)),
      );
      expect(found, axis.id).toBe(true);
    }
  });

  // 화면은 입력 전에 축별 건수를 보여주려고 규칙 파일에서 뽑아 둔 상수를 읽는다.
  // 그 상수가 규칙 파일과 어긋나면 화면이 없는 숫자를 말하게 되므로 여기서 묶어 둔다.
  it("keeps the prebuilt axis coverage identical to the rules file", () => {
    for (const situation of situationIds) {
      expect(coreCoverage[situation], situation).toBe(
        ruleFor(situation, "base")!.all_evidence.length,
      );
      for (const axis of axes) {
        const rule = ruleFor(situation, axis.id);
        expect(
          axisCoverage[situation][axis.id],
          `${situation}/${axis.id}`,
        ).toBe(rule ? rule.all_evidence.length : null);
      }
    }
  });

  // 축은 "그 항목을 보고했는가"로만 걸린다. 값은 대조하지 않는다(AGENTS.md 참고).
  // 화면 문구가 이 성질에 맞춰져 있으므로, 성질이 바뀌면 문구도 함께 바꿔야 한다.
  it("filters by whether an axis is reported, not by the value typed in", async () => {
    const ask = async (medication: string) => {
      const response = await POST(
        new Request("http://localhost/api/personalized-safety", {
          method: "POST",
          body: JSON.stringify({
            situation: "HRS5_ANTICOAGULATION",
            medication,
          }),
        }),
      );
      const body = (await response.json()) as {
        evidence: { record_id: string }[];
      };
      return body.evidence.map((item) => item.record_id).join("|");
    };
    const warfarin = await ask("와파린");
    const nonsense = await ask("zzzz아무말이나");
    expect(warfarin).toBe(nonsense);
    expect(warfarin.length).toBeGreaterThan(0);
  });
});
