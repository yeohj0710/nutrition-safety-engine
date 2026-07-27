import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/personalized-safety/route";
import { personalizedSafetyExamples } from "@/src/lib/personalized-safety-examples";
const original = process.env.OPENAI_API_KEY;
afterEach(() => {
  vi.restoreAllMocks();
  if (original) process.env.OPENAI_API_KEY = original;
  else delete process.env.OPENAI_API_KEY;
});

async function requestAssessment(input: Record<string, string>) {
  delete process.env.OPENAI_API_KEY;
  const response = await POST(
    new Request("http://local/api/personalized-safety", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
  return { response, body: await response.json() };
}

describe("personalized safety API", () => {
  it("returns a complete assessment for every public input example", async () => {
    delete process.env.OPENAI_API_KEY;
    const expectedQuestionByIngredient: Record<string, string> = {
      "비타민 K": "A1",
      "오메가-3": "A2",
      칼슘: "B1",
      "비타민 D": "B2",
      "비타민 C": "B3",
    };
    const expectedVerdictById: Record<string, string> = {
      "vitamin-k-warfarin-inr": "매일 비슷한 양을 섭취",
      "vitamin-k-unknown-dose": "매일 비슷한 양을 섭취",
      "vitamin-k-bruising": "갑자기 줄이지 말고",
      "omega3-warfarin-bruising": "안전 범위 안",
      "omega3-warfarin-high-dose": "일반 기준 5,000 mg/day보다 높습니다",
      "omega3-aspirin-no-symptoms": "안전 범위 안",
      "calcium-ckd-hypercalcemia": "성인 총섭취 상한보다 낮습니다",
      "calcium-levothyroxine": "성인 총섭취 상한보다 낮습니다",
      "calcium-unknown-antibiotic": "복용량을 모르면",
      "vitamin-d-ckd-hypercalcemia": "성인 상한 4,000 IU/day와 같습니다",
      "vitamin-d-peritoneal-dialysis": "성인 상한 아래",
      "vitamin-d-microgram-thiazide": "성인 상한 4,000 IU/day와 같습니다",
      "vitamin-c-kidney-function": "줄이는 쪽이 맞습니다",
      "vitamin-c-ckd-iron": "줄이는 쪽이 맞습니다",
      "vitamin-c-low-dose-no-risk": "고위험 조건은 확인되지 않았습니다",
    };
    expect(personalizedSafetyExamples).toHaveLength(15);
    expect(
      personalizedSafetyExamples.reduce<Record<string, number>>((counts, example) => {
        counts[example.input.ingredient] =
          (counts[example.input.ingredient] ?? 0) + 1;
        return counts;
      }, {}),
    ).toEqual({
      "비타민 K": 3,
      "오메가-3": 3,
      칼슘: 3,
      "비타민 D": 3,
      "비타민 C": 3,
    });

    for (const example of personalizedSafetyExamples) {
      const response = await POST(
        new Request("http://local/api/personalized-safety", {
          method: "POST",
          body: JSON.stringify(example.input),
        }),
      );
      const body = await response.json();

      expect(response.status, example.title).toBe(200);
      expect(body.question_id, example.title).toBe(
        expectedQuestionByIngredient[example.input.ingredient],
      );
      expect(body.ingredient, example.title).toBe(example.input.ingredient);
      expect(body.assessment.context, example.title).toContain(
        example.input.ingredient,
      );
      expect(body.assessment.context, example.title).toContain(
        "복용하고 계시네요",
      );
      expect(body.narrative_assessment.context, example.title).toBe(
        body.assessment.context,
      );
      expect(body.assessment.context, example.title).not.toMatch(
        /복용 중입니다|현재 불편한 증상은 없습니다|반영했습니다/,
      );
      expect(
        `${body.assessment.verdict} ${body.assessment.dose}`,
        example.title,
      ).toContain(expectedVerdictById[example.id]);
      expect(body.assessment.dose, example.title).toMatch(/[가-힣]/);
      expect(body.assessment.watch, example.title).toMatch(/[가-힣]/);
      expect(body.evidence.length, example.title).toBeGreaterThan(0);
      expect(body.evidence.length, example.title).toBeLessThanOrEqual(5);
      expect(body.evidence.length, example.title).toBe(
        Math.min(5, body.all_evidence.length),
      );
    }
  });

  it.each([
    ["비타민 K", "A1", "100 mcg/day"],
    ["오메가-3", "A2", "2000 mg/day"],
    ["칼슘", "B1", "600 mg/day"],
    ["비타민 D", "B2", "4000 IU/day"],
    ["비타민 C", "B3", "1000 mg/day"],
  ])(
    "returns a concise Korean evidence-linked fallback for %s",
    async (ingredient, q, dose) => {
      delete process.env.OPENAI_API_KEY;
      const response = await POST(
        new Request("http://local/api/personalized-safety", {
          method: "POST",
          body: JSON.stringify({
            ingredient,
            dose,
            condition: "검토 대상 병력",
            labs: "검사값 3.1",
          }),
        }),
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.question_id).toBe(q);
      expect(body.ai_summary).toContain(dose);
      expect(body.ai_summary).toContain("3.1");
      expect(body.ai_summary).not.toMatch(/종합하면|핵심은|상담 전에는/);
      expect(body.ai_summary.length).toBeLessThanOrEqual(700);
      expect(body.ai_summary).toContain("그래서 지금 볼 것은");
      expect(body.evidence.length).toBeGreaterThan(0);
      expect(body.evidence.length).toBe(Math.min(5, body.all_evidence.length));
      expect(body.all_evidence.length).toBeGreaterThanOrEqual(body.evidence.length);
      expect(body.evidence_selection.selected).toBe(body.evidence.length);
      expect(body.evidence_selection.total_candidates).toBe(body.all_evidence.length);
      expect(body.evidence[0].selection_reason).toBeTruthy();
      expect(body.evidence[0].selection_reason).not.toContain(" · ");
      expect(body.evidence[0].selection_reason).toMatch(/(?:입니다|습니다)\.$/);
      expect(body.evidence[0].key_finding).toBeTruthy();
      expect(body.evidence[0].key_finding_ko).toBeTruthy();
      expect(body.evidence[0].locator).toMatch(/^ABSTRACT_SENTENCE_\d+: /);
      expect(
        body.evidence.every(
          (item: { key_finding: string; locator: string }) =>
            item.key_finding.trim().length > 0 &&
            /^ABSTRACT_SENTENCE_\d+: /.test(item.locator) &&
            item.locator.endsWith(item.key_finding),
        ),
      ).toBe(true);
      expect(body.evidence_lineage.track).toBe("v3.0_full_ai_autonomy");
      expect(body.evidence_lineage.source_question_id).toMatch(/^HRS[1-5]_/);
      expect(
        body.all_evidence.every((item: { record_id: string }) =>
          item.record_id.startsWith("pubmed:"),
        ),
      ).toBe(true);
      expect(body.evidence_selection.method).toBe(
        "연구 설계와 입력한 약·증상·병력·검사 결과·용량을 문헌의 대상과 결과에 대조해 관련도가 높은 순서로 배치했습니다.",
      );
      expect(body.ai_summary).not.toMatch(
        /supplement dose|kidney stone|dietary calcium/,
      );
    },
  );
  it("splits the profile into short natural sentences", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "칼슘",
          dose: "600 mg/day",
          condition: "칼슘옥살산 신장결석 병력",
          labs: "24시간 요중 칼슘 280 mg/day",
        }),
      }),
    );
    const body = await response.json();
    expect(body.ai_summary).toContain(
      "말씀해 주신 내용을 보면, 칼슘을 600 mg/day 복용하고 계십니다.",
    );
    expect(body.ai_summary).toContain("칼슘옥살산 신장결석 병력도 있으시고요.");
    expect(body.ai_summary).toContain(
      "최근 검사에서는 24시간 요중 칼슘 280 mg/day가 확인됐고요.",
    );
    expect(body.ai_summary).toContain("그래서 지금 볼 것은 제품 라벨의 원소 칼슘");
    expect(body.ai_summary).toContain(
      "현재 연결된 문헌만으로 600 mg/day의 개인별 안전 여부를 단정할 수는 없습니다",
    );
    expect(body.ai_summary).not.toMatch(/확인받으세요|보여 주세요|상의하세요/);
    expect(body.ai_summary).not.toMatch(
      /입력(?:되|하|된)|입력값|대상자|사용자|프로필|검사값|현재 입력한 조건|종합하면|핵심은|상담 전에는|이시군요|살펴볼게요|적어주셨네요/,
    );
    expect(body.assessment.verdict).toContain("줄이는 편이 낫습니다");
    expect(body.assessment.context).toContain(
      "칼슘옥살산 신장결석 병력이 있다고 하셨어요.",
    );
    expect(body.assessment.context).not.toContain("병력도 함께 있습니다");
    expect(body.assessment.dose).toContain("2,000–2,500 mg/day");
    expect(body.assessment.interaction).toContain("레보티록신");
    expect(body.assessment.watch).toContain("280 mg/day");
    expect(body.assessment.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "NIH 기준" }),
        expect.objectContaining({ label: "논문 1" }),
      ]),
    );
  });

  it("includes Korean findings in sentence-level evidence references", async () => {
    const { body } = await requestAssessment({
      ingredient: "비타민 D",
      dose: "100 μg/day",
      medication: "티아지드 이뇨제",
      condition: "칼슘 수치가 높다고 들음",
      labs: "혈청 칼슘 10.7 mg/dL",
    });
    const paperReferences = body.assessment.references.filter(
      (item: { label: string }) => item.label.startsWith("논문"),
    );

    expect(paperReferences).toHaveLength(2);
    expect(paperReferences[0].summary_ko).toBe(body.evidence[0].key_finding_ko);
    expect(paperReferences[1].summary_ko).toBe(body.evidence[1].key_finding_ko);
    expect(body.assessment.references[0].summary_ko).toMatch(/[가-힣]/);
  });

  it("reflects the entered profile in a conversational counseling tone", async () => {
    const { body } = await requestAssessment({
      ingredient: "칼슘",
      dose: "500 mg/day",
      medication: "레보티록신(성분명 알려지지 않음)",
      condition: "특별한 증상 없음",
    });
    const expectedContext =
      "칼슘을 복용하고 계시네요. 제품 라벨에는 하루 500 mg/day로 적혀 있다고 하셨고요. 레보티록신(성분명 알려지지 않음)도 함께 복용하고 계시고요. 현재 불편한 증상은 없다고 하셨어요.";

    expect(body.assessment.context).toBe(expectedContext);
    expect(body.narrative_assessment.context).toBe(expectedContext);
    expect(expectedContext).not.toMatch(/복용 중이에요|섭취량은 .*이에요/);
  });
  it("combines the omega-3 profile with quantitative findings and directness limits", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "오메가-3",
          dose: "EPA+DHA 2000 mg/day",
          medication: "아픽사반",
          condition: "코피가 자주 남",
        }),
      }),
    );
    const body = await response.json();
    // 연구 서술은 이번 응답이 실제로 선택한 v3.0 문헌에서만 나와야 한다.
    const selectedFinding = String(
      body.evidence[0].key_finding_ko ?? body.evidence[0].key_finding,
    )
      .replace(/\s+/g, " ")
      .trim();
    expect(body.ai_summary).toContain(
      `연결된 문헌은 ${body.evidence.length}건입니다`,
    );
    // 인용문은 반드시 선택된 근거 원문 안에 그대로 존재해야 한다.
    const quoted = body.ai_summary.match(/핵심 소견은 “([^”]+)”/)?.[1];
    expect(quoted).toBeTruthy();
    expect(selectedFinding).toContain(quoted);
    // v3.0 근거 집합에 없는 선행 트랙 서술이 되살아나면 안 된다.
    for (const stale of ["어유 3–6 g/day", "오메가-3 카복실산 4 g", "INR 8.06"])
      expect(body.ai_summary).not.toContain(stale);
    // 직접성 한계는 상수가 아니라 실제 근거에서 계산돼야 한다.
    expect(body.evidence_selection.direct_medication_matches).toBe(0);
    expect(body.ai_summary).toContain(
      "아픽사반을 직접 다룬 연구는 이 가운데 없습니다",
    );
    expect(body.ai_summary).toContain(
      "EPA+DHA 2000 mg/day가 안전하다고 단정할 수 없습니다",
    );
    expect(body.assessment.verdict).toContain("일반 성인 기준으로는 안전 범위 안");
    expect(body.assessment.interaction).toContain("아픽사반과 오메가-3");
    expect(body.assessment.context).toContain(
      "현재 코피가 자주 난다고 하셨어요.",
    );
    expect(body.assessment.context).not.toContain("코피가 자주 남도 함께 있습니다");
    expect(body.evidence_selection.total_candidates).toBe(body.all_evidence.length);
    expect(body.evidence_selection.direct_medication_matches).toBe(0);
  });
  it("uses the medicine actually entered in omega-3 results", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "오메가-3",
          dose: "2000 mg/day",
          medication: "와파린",
          condition: "특별한 증상 없음",
        }),
      }),
    );
    const body = await response.json();
    expect(body.assessment.interaction).toContain("와파린과 오메가-3");
    expect(body.assessment.interaction).not.toContain("아픽사반");
    expect(body.assessment.context).toContain(
      "현재 불편한 증상은 없다고 하셨어요.",
    );
  });

  it("matches Korean medicine names to the exact English medicine in evidence", async () => {
    const vitaminK = await requestAssessment({
      ingredient: "비타민 K",
      dose: "100 mcg/day",
      medication: "와파린",
      condition: "항응고 치료 중",
      labs: "INR 3.1",
    });
    const aspirin = await requestAssessment({
      ingredient: "오메가-3",
      dose: "EPA+DHA 1000 mg/day",
      medication: "아스피린",
      condition: "특별한 증상 없음",
    });

    expect(vitaminK.body.evidence_selection.direct_medication_matches).toBeGreaterThan(0);
    expect(
      vitaminK.body.evidence.some((item: { selection_reason: string }) =>
        item.selection_reason.includes("입력한 약을 직접 다룬 문헌입니다"),
      ),
    ).toBe(true);
    // v3.0 오메가-3 별칭 근거에는 아스피린을 직접 연구한 문헌이 없다.
    // 따라서 직접 일치 0건이면 어떤 근거도 직접 일치를 주장하지 않아야 한다.
    expect(aspirin.body.evidence_selection.direct_medication_matches).toBe(0);
    expect(aspirin.body.evidence[0].record_id).toMatch(/^pubmed:/);
    expect(
      aspirin.body.evidence.every((item: { selection_reason: string }) =>
        !item.selection_reason.includes("입력한 약을 직접 다룬 문헌입니다"),
      ),
    ).toBe(true);
  });

  it("keeps apixaban evidence explicitly indirect", async () => {
    const { body } = await requestAssessment({
      ingredient: "오메가-3",
      dose: "EPA+DHA 2000 mg/day",
      medication: "아픽사반",
      condition: "코피가 자주 남",
    });

    expect(body.evidence_selection.direct_medication_matches).toBe(0);
    expect(
      body.evidence.every((item: { selection_reason: string }) =>
        !item.selection_reason.includes("입력한 약을 직접 다룬 문헌입니다"),
      ),
    ).toBe(true);
  });

  it.each([
    [
      "thiazide and high serum calcium",
      {
        ingredient: "비타민 D",
        dose: "100 μg/day",
        medication: "티아지드 이뇨제",
        condition: "칼슘 수치가 높다고 들음",
        labs: "혈청 칼슘 10.7 mg/dL",
      },
      ["같은 약물 계열이나 관련 안전성 결과를 다뤘습니다", "혈중 칼슘"],
    ],
    [
      "warfarin and 6 g omega-3",
      {
        ingredient: "오메가-3",
        dose: "EPA+DHA 6000 mg/day",
        medication: "와파린",
        condition: "멍이 잘 듦",
      },
      ["입력한 약을 직접 다룬 문헌입니다", "출혈·응고"],
    ],
    [
      "reduced kidney function and 2 g vitamin C",
      {
        ingredient: "비타민 C",
        dose: "2000 mg/day",
        condition: "신장기능 저하",
        labs: "eGFR 48 mL/min/1.73m²",
      },
      ["신장기능"],
    ],
    [
      "calcium stone history and high urine calcium",
      {
        ingredient: "칼슘",
        dose: "600 mg/day",
        condition: "칼슘옥살산 신장결석 병력",
        labs: "24시간 요중 칼슘 280 mg/day",
      },
      ["체계적 문헌고찰"],
    ],
    [
      "vitamin D upper limit with stone history",
      {
        ingredient: "비타민 D",
        dose: "4000 IU/day",
        condition: "신장결석 및 고칼슘뇨 병력",
        labs: "25(OH)D 48 ng/mL",
      },
      ["체계적 문헌고찰"],
    ],
    [
      "vitamin D without a risk modifier",
      {
        ingredient: "비타민 D",
        dose: "2000 IU/day",
        medication: "복용 약 없음",
        condition: "특별한 증상 없음",
        labs: "25(OH)D 28 ng/mL",
      },
      ["체계적 문헌고찰"],
    ],
  ])(
    "puts the most directly relevant paper first for %s",
    async (_name, input, expectedReasons) => {
      const { body } = await requestAssessment(input);

      // v3.0 트랙에서는 고정된 v2 PMID 순위를 요구하지 않는다.
      // 대신 선두 근거가 v3 코퍼스에서 왔고 직접 관련 사유를 갖는지 검증한다.
      expect(body.evidence[0].record_id).toMatch(/^pubmed:/);
      expect(body.evidence_lineage.track).toBe("v3.0_full_ai_autonomy");
      for (const reason of expectedReasons) {
        expect(body.evidence[0].selection_reason).toContain(reason);
      }
    },
  );

  it("does not mistake parathyroid text for levothyroxine evidence", async () => {
    const { body } = await requestAssessment({
      ingredient: "칼슘",
      dose: "500 mg/day",
      medication: "레보티록신",
      condition: "특별한 증상 없음",
    });

    expect(body.evidence_selection.direct_medication_matches).toBe(0);
    expect(
      body.evidence.every((item: { selection_reason: string }) =>
        !item.selection_reason.includes("같은 약물 계열"),
      ),
    ).toBe(true);
  });

  it("does not treat co-medication doses as the omega-3 dose", async () => {
    const lowDose = await requestAssessment({
      ingredient: "오메가-3",
      dose: "40 mg/day",
      medication: "와파린",
      condition: "특별한 증상 없음",
    });
    const omegaDose = await requestAssessment({
      ingredient: "오메가-3",
      dose: "4000 mg/day",
      medication: "와파린",
      condition: "특별한 증상 없음",
    });
    // 병용약(와파린) 용량이 아니라 입력한 오메가-3 용량이 그대로 파싱돼야 한다.
    expect(lowDose.body.assessment.dose).toContain("40 mg/day");
    expect(omegaDose.body.assessment.dose).toContain("4,000 mg/day");
    expect(lowDose.body.assessment.dose).not.toContain("4,000 mg/day");
  });

  it("matches an unknown medicine as a whole phrase instead of generic tokens", async () => {
    const { body } = await requestAssessment({
      ingredient: "칼슘",
      dose: "500 mg/day",
      medication: "calcium channel blocker",
      condition: "특별한 증상 없음",
    });

    expect(body.evidence_selection.direct_medication_matches).toBe(0);
    expect(
      body.evidence.every((item: { selection_reason: string }) =>
        !item.selection_reason.includes("입력한 약을 직접 다룬 문헌입니다"),
      ),
    ).toBe(true);
  });

  it.each([
    ["spaced thousands", "600000 IU/day"],
    ["lower range endpoint", "4000 IU/day"],
  ])(
    "matches vitamin D doses written with %s",
    async (_name, dose) => {
      const { body } = await requestAssessment({
        ingredient: "비타민 D",
        dose,
        condition: "신장결석 병력",
      });

      // v3.0 별칭 근거의 핵심소견에는 용량 문자열이 없어 용량 근거 문구가 붙지 않는다.
      // 대신 두 표기 형태가 모두 입력 그대로 파싱돼 요약에 반영되는지 검증한다.
      expect(body.ai_summary).toContain(dose);
      expect(body.evidence_selection.total_candidates).toBe(
        body.all_evidence.length,
      );
    },
  );
  it("describes multiple medicines and symptoms without collapsing them", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "오메가-3",
          dose: "2000 mg/day",
          medication: "와파린 · 아스피린",
          condition: "코피가 남 · 멍이 잘 듦",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.assessment.context).toContain(
      "와파린·아스피린도 함께 복용하고 계시고요.",
    );
    expect(body.assessment.context).toContain("현재 코피가 난다고 하셨어요.");
    expect(body.assessment.context).toContain(
      "현재 멍이 잘 든다고 하셨어요.",
    );
    expect(body.assessment.interaction).toContain(
      "와파린·아스피린과 오메가-3",
    );
    expect(body.ai_summary).not.toContain("멍이 잘 듦도 확인되고요");
  });
  it.each([
    [
      "비타민 K",
      "100 mcg/day",
      "항생제 · 올리스타트",
      [
        "장내 비타민 K 생성이 줄어 비타민 K 상태를 낮출 수",
        "비타민 K 흡수를 낮출 수",
      ],
    ],
    [
      "칼슘",
      "500 mg/day",
      "갑상선약 · 리튬",
      ["레보티록신의 흡수를 떨어뜨릴 수", "혈중 칼슘을 높일 수"],
    ],
    [
      "비타민 D",
      "2000 IU/day",
      "스테로이드 · 스타틴",
      ["비타민 D 대사에 영향을 줄 수", "일부 스타틴의 작용에 영향을 줄 수"],
    ],
  ])(
    "explains each selected medicine for %s",
    async (ingredient, dose, medication, expectedPhrases) => {
      delete process.env.OPENAI_API_KEY;
      const response = await POST(
        new Request("http://local/api/personalized-safety", {
          method: "POST",
          body: JSON.stringify({
            ingredient,
            dose,
            medication,
            condition: "특별한 증상 없음",
          }),
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      for (const phrase of expectedPhrases) {
        expect(body.assessment.interaction).toContain(phrase);
      }
    },
  );
  it("prioritizes abdominal-pain triage for an anticoagulant user", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "오메가-3",
          dose: "EPA+DHA 2000 mg/day",
          medication: "아픽사반",
          condition: "배가 아파요",
        }),
      }),
    );
    const body = await response.json();
    expect(body.ai_summary).toContain("배가 아픈 증상은 오메가-3 근거와 별도로 봐야 합니다");
    expect(body.ai_summary).toContain("검은변·혈변·토혈");
    expect(body.ai_summary).toContain("바로 진료가 필요한 신호입니다");
    expect(body.ai_summary).not.toMatch(/119|응급실|가급적 오늘/);
  });
  it("sends severe abdominal-pain red flags directly to emergency care", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "오메가-3",
          dose: "EPA+DHA 2000 mg/day",
          medication: "아픽사반",
          condition: "갑자기 심한 복통과 검은변",
        }),
      }),
    );
    const body = await response.json();
    expect(body.ai_summary).toContain("바로 진료받으세요");
  });
  it("accepts a consumer who does not know the dose", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "칼슘",
          dose: "잘 모르겠어요",
          medication: "복용 약 없음",
          condition: "특별한 증상 없음",
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.assessment.context).toContain(
      "하루 양은 아직 모르겠다고 하셨고요",
    );
    expect(body.assessment.verdict).toContain("복용량을 모르면");
    expect(body.assessment.context).not.toContain("복용 약 없음도");
  });
  it("converts vitamin D micrograms before comparing the upper limit", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "비타민 D",
          dose: "100 μg",
          condition: "신장결석 병력",
        }),
      }),
    );
    const body = await response.json();
    expect(body.assessment.verdict).toContain("성인 상한 4,000 IU/day");
  });
  it("gives a direct vitamin C decision when urine oxalate is elevated and dose is unknown", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "비타민 C",
          dose: "잘 모르겠어요",
          condition: "특별한 증상 없음",
          labs: "요중 옥살산 상승",
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.assessment.verdict).toContain(
      "고용량 비타민 C를 유지하지 않는 쪽이 맞습니다",
    );
    expect(body.assessment.watch).toContain(
      "제품 라벨에서 하루 총량을 확인해야 합니다",
    );
    expect(body.assessment.watch).not.toContain("불리한 조건입니다");
  });
  it("rejects unsupported ingredients", async () => {
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({ ingredient: "마그네슘" }),
      }),
    );
    expect(response.status).toBe(400);
  });
  it.each([
    ["malformed JSON", "{"],
    [
      "oversized health text",
      JSON.stringify({ ingredient: "칼슘", condition: "가".repeat(201) }),
    ],
    [
      "non-string field",
      JSON.stringify({ ingredient: "칼슘", labs: { value: 3.1 } }),
    ],
  ])("rejects %s", async (_caseName, body) => {
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body,
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([
    [
      "invented numeric threshold",
      "입력 상태를 확인했습니다. 하루 5000 mg까지 안전합니다. 그대로 복용하세요.",
    ],
    [
      "direct medication instruction",
      "입력 상태를 확인했습니다. 지금 복용을 중단하세요.",
    ],
    [
      "robotic input acknowledgement",
      "복용량 600 mg/day, 병력 신장결석이 입력되었습니다.",
    ],
  ])("falls back when AI returns %s", async (_caseName, output_text) => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output_text }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "칼슘",
          dose: "600 mg/day",
          condition: "신장결석 병력",
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ai_summary).toContain("600 mg/day");
    expect(body.ai_summary).not.toContain("5000");
    expect(body.ai_summary).not.toContain("복용을 중단하세요");
  });
  it("sets an upstream timeout and falls back when the model call fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const mocked = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({ ingredient: "칼슘", dose: "600 mg/day" }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ai_summary).toContain("600 mg/day");
    expect(mocked).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it("uses a grounded AI interpretation before applying evidence rules", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body ?? "{}"));
      if (
        request.text?.format?.name === "supplement_input_interpretation"
      ) {
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              dose: "EPA+DHA 2,000 mg/day",
              medication: "엘리퀴스(아픽사반) · 아스피린",
              condition: "코피 빈발",
              labs: "",
            }),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new DOMException("timed out", "TimeoutError");
    });
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "오메가-3",
          dose: "EPA랑 DHA 합쳐서 2,000 mg",
          medication: "엘리퀴스랑 아스피린",
          condition: "요즘 코피가 자주 나요",
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.input_interpretation).toEqual({
      ai_used: true,
      changed: true,
    });
    expect(body.assessment.context).toContain("아픽사반");
    expect(body.assessment.context).toContain(
      "현재 코피가 자주 난다고 하셨어요.",
    );
    expect(body.assessment.context).toContain("2,000 mg/day");
  });
  it("writes the displayed assessment from the full interpreted context", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    let narrativeRequest: Record<string, unknown> | null = null;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body ?? "{}"));
      const formatName = request.text?.format?.name;
      if (formatName === "supplement_input_interpretation") {
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              dose: "잘 모르겠어요",
              medication: "",
              condition: "배가 아픔",
              labs: "비타민 D 수치가 낮았다고 들음",
            }),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (formatName === "personalized_safety_narrative") {
        narrativeRequest = JSON.parse(request.input[1].content);
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              conclusion:
                "하루 섭취량을 모르는 상태라 지금 복용량을 유지해도 되는지는 판단할 수 없습니다. 제품 라벨에서 비타민 C 총량을 먼저 확인해야 합니다.",
              context:
                "비타민 C를 복용 중이고 현재 배가 아픕니다. 최근 검사에서는 비타민 D 수치가 낮다는 설명을 들었습니다.",
              explanation:
                "성인 비타민 C 상한은 2,000 mg/day이지만, 이 수치만으로 현재 복용량의 안전성을 판단할 수는 없습니다. 철 과다증이 있다면 비타민 C가 철 흡수를 늘릴 수 있습니다.",
              next:
                "복통은 비타민 C 근거와 별도로 살펴야 합니다. 요중 옥살산 상승, 칼슘옥살산 결석 또는 신장기능 저하가 확인되면 고용량을 유지하지 않는 편이 낫습니다.",
            }),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`unexpected model request: ${formatName}`);
    });

    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "비타민 C",
          dose: "잘 모르겠어요",
          condition: "배가 아프다.",
          labs: "비타민D가 낮다고했던거같아요",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(narrativeRequest).toEqual(
      expect.objectContaining({
        submitted_input: expect.objectContaining({
          condition: "배가 아프다.",
          labs: "비타민D가 낮다고했던거같아요",
        }),
        interpreted_input: expect.objectContaining({
          condition: "배가 아픔",
          labs: "비타민 D 수치가 낮았다고 들음",
        }),
        rule_assessment: expect.objectContaining({
          verdict: expect.stringContaining("판단할 수 없습니다"),
        }),
      }),
    );
    expect(body.narrative_assessment.ai_used).toBe(true);
    expect(body.narrative_assessment.context).toBe(
      "비타민 C를 복용하고 계시네요. 제품 라벨의 하루 양은 아직 모르겠다고 하셨고요. 현재 배가 아프다고 하셨어요. 최근 검사와 관련해서는 “비타민 D 수치가 낮았다고 들음”이라는 내용도 말씀하셨어요.",
    );
    expect(JSON.stringify(body.narrative_assessment)).not.toContain(
      "낮다고했던거같아요입니다",
    );
  });
  it("rejects a narrative that invents symptoms or emergency guidance", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body ?? "{}"));
      const formatName = request.text?.format?.name;
      if (formatName === "supplement_input_interpretation") {
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              dose: "잘 모르겠어요",
              medication: "",
              condition: "배가 아픔",
              labs: "비타민 D 수치가 낮았다고 들음",
            }),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            conclusion:
              "하루 섭취량을 몰라 현재 용량을 유지해도 되는지는 판단할 수 없습니다.",
            context:
              "비타민 C를 복용 중이고 배가 아프며 비타민 D 수치가 낮았다는 설명을 들었습니다.",
            explanation:
              "성인 비타민 C 상한은 2,000 mg/day이지만 결석 위험군의 안전선이라는 뜻은 아닙니다. 철 과다증에서는 철 흡수를 늘릴 수 있습니다.",
            next:
              "혈뇨·고열·오심이 나타나면 즉시 응급실로 가야 합니다. 요중 옥살산 상승도 살펴야 합니다.",
          }),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "비타민 C",
          dose: "잘 모르겠어요",
          condition: "배가 아프다.",
          labs: "비타민D가 낮다고했던거같아요",
        }),
      }),
    );
    const body = await response.json();

    expect(body.narrative_assessment.ai_used).toBe(false);
    expect(JSON.stringify(body.narrative_assessment)).not.toMatch(
      /혈뇨|고열|오심|응급실/,
    );
  });
  it("rejects an AI interpretation that adds a number", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body ?? "{}"));
      if (
        request.text?.format?.name === "supplement_input_interpretation"
      ) {
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              dose: "600 mg/day",
              medication: "",
              condition: "",
              labs: "요중 칼슘 280 · 안전 기준 300",
            }),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new DOMException("timed out", "TimeoutError");
    });
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "칼슘",
          dose: "600 mg/day",
          labs: "요중 칼슘 280",
        }),
      }),
    );
    const body = await response.json();
    expect(body.input_interpretation).toEqual({
      ai_used: false,
      changed: false,
    });
    expect(body.assessment.context).toContain(
      "요중 칼슘 280이라고 하셨어요",
    );
    expect(body.assessment.context).not.toContain("300");
  });
  it("rejects an AI interpretation that changes a medicine concept", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body ?? "{}"));
      if (
        request.text?.format?.name === "supplement_input_interpretation"
      ) {
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              dose: "2,000 mg/day",
              medication: "엘리퀴스(와파린)",
              condition: "",
              labs: "",
            }),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new DOMException("timed out", "TimeoutError");
    });
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "오메가-3",
          dose: "2,000 mg/day",
          medication: "엘리퀴스",
        }),
      }),
    );
    const body = await response.json();
    expect(body.input_interpretation.ai_used).toBe(false);
    expect(body.assessment.context).toContain("엘리퀴스");
    expect(body.assessment.context).not.toContain("와파린");
  });
  it("applies the urine-calcium threshold only to a urine-calcium result", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(
      new Request("http://local/api/personalized-safety", {
        method: "POST",
        body: JSON.stringify({
          ingredient: "칼슘",
          dose: "600 mg/day",
          labs: "비타민 D 280",
        }),
      }),
    );
    const body = await response.json();
    expect(body.assessment.verdict).toContain("성인 총섭취 상한보다 낮습니다");
    expect(body.assessment.verdict).not.toContain("요중 칼슘");
  });
  it.each([
    [
      "missing input number",
      "신장결석 병력이 있어 섭취원과 검사 결과를 함께 살펴야 합니다. 식이 칼슘과 보충제 칼슘을 구분해 확인하세요.",
    ],
    ["overlong paragraph", `600 mg/day ${"긴 설명 ".repeat(80)}`],
  ])(
    "rejects %s and returns a concise fallback",
    async (_caseName, output_text) => {
      process.env.OPENAI_API_KEY = "test-key";
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ output_text }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      const response = await POST(
        new Request("http://local/api/personalized-safety", {
          method: "POST",
          body: JSON.stringify({
            ingredient: "칼슘",
            dose: "600 mg/day",
            labs: "24시간 요중 칼슘 280 mg/day",
          }),
        }),
      );
      const body = await response.json();
      expect(body.ai_summary).toContain("600 mg/day");
      expect(body.ai_summary).toContain("280 mg/day");
      expect(body.ai_summary.length).toBeLessThanOrEqual(700);
      expect(body.ai_summary).not.toContain("긴 설명");
    },
  );
});
