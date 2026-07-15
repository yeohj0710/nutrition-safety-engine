import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/personalized-safety/route";
import { personalizedSafetyExamples } from "@/src/lib/personalized-safety-examples";
const original = process.env.OPENAI_API_KEY;
afterEach(() => {
  vi.restoreAllMocks();
  if (original) process.env.OPENAI_API_KEY = original;
  else delete process.env.OPENAI_API_KEY;
});
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
      "omega3-apixaban-nosebleed": "출혈 증상을 먼저 봐야",
      "omega3-warfarin-high-dose": "일반 기준 5,000 mg/day보다 높습니다",
      "omega3-aspirin-no-symptoms": "안전 범위 안",
      "calcium-stone-high-urine-calcium": "줄이는 편이 낫습니다",
      "calcium-levothyroxine": "성인 총섭취 상한보다 낮습니다",
      "calcium-unknown-antibiotic": "복용량을 모르면",
      "vitamin-d-upper-limit-stone": "성인 상한 4,000 IU/day와 같습니다",
      "vitamin-d-microgram-thiazide": "성인 상한 4,000 IU/day와 같습니다",
      "vitamin-d-moderate-no-risk": "성인 상한 아래",
      "vitamin-c-high-oxalate": "줄이는 쪽이 맞습니다",
      "vitamin-c-kidney-function": "줄이는 쪽이 맞습니다",
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
      expect(
        `${body.assessment.verdict} ${body.assessment.dose}`,
        example.title,
      ).toContain(expectedVerdictById[example.id]);
      expect(body.assessment.dose, example.title).toMatch(/[가-힣]/);
      expect(body.assessment.watch, example.title).toMatch(/[가-힣]/);
      expect(body.evidence, example.title).toHaveLength(5);
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
      expect(body.evidence).toHaveLength(5);
      expect(body.all_evidence.length).toBeGreaterThanOrEqual(body.evidence.length);
      expect(body.evidence_selection.selected).toBe(5);
      expect(body.evidence_selection.total_candidates).toBe(body.all_evidence.length);
      expect(body.evidence[0].selection_reason).toBeTruthy();
      expect(body.evidence[0].selection_reason).not.toContain(" · ");
      expect(body.evidence[0].selection_reason).toMatch(/(?:입니다|습니다)\.$/);
      expect(body.evidence[0].key_finding).toBeTruthy();
      expect(body.evidence[0].key_finding_ko).toBeTruthy();
      expect(body.evidence[0].key_finding.length).toBeLessThanOrEqual(280);
      expect(body.evidence_selection.method).toBe(
        "체계적 문헌고찰·메타분석·임상시험을 먼저 보고, 복용 중인 약과 병력·증상을 직접 다룬 문헌을 위에 배치했습니다.",
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
    expect(body.ai_summary).toContain("600 mg/day라는 숫자만으로 많고 적음을 정할 수는 없습니다");
    expect(body.ai_summary).not.toMatch(/확인받으세요|보여 주세요|상의하세요/);
    expect(body.ai_summary).not.toMatch(
      /입력(?:되|하|된)|입력값|대상자|사용자|프로필|검사값|현재 입력한 조건|종합하면|핵심은|상담 전에는|이시군요|살펴볼게요|적어주셨네요/,
    );
    expect(body.assessment.verdict).toContain("줄이는 편이 낫습니다");
    expect(body.assessment.context).toContain(
      "칼슘옥살산 신장결석 병력이 있습니다.",
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
    expect(body.ai_summary).toContain("어유 3–6 g/day");
    expect(body.ai_summary).toContain("오메가-3 카복실산 4 g");
    expect(body.ai_summary).toContain("INR 8.06");
    expect(body.ai_summary).toContain("아픽사반 복용자에게 안전한 EPA+DHA 상한을 직접 정하지 않았으므로");
    expect(body.assessment.verdict).toContain("일반 성인 기준으로는 안전 범위 안");
    expect(body.assessment.interaction).toContain("아픽사반과 오메가-3");
    expect(body.assessment.context).toContain("현재 코피가 자주 납니다.");
    expect(body.assessment.context).not.toContain("코피가 자주 남도 함께 있습니다");
    expect(body.evidence_selection.total_candidates).toBe(5);
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
    expect(body.assessment.context).toContain("현재 불편한 증상은 없습니다.");
  });
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
      "와파린·아스피린을 함께 복용 중입니다.",
    );
    expect(body.assessment.context).toContain("현재 코피가 납니다.");
    expect(body.assessment.context).toContain("현재 멍이 잘 듭니다.");
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
    expect(body.assessment.context).toContain("하루 양은 아직 모릅니다");
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
    expect(body.assessment.context).toContain("현재 코피가 자주 납니다.");
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
      "비타민 C를 복용 중이고 현재 배가 아픕니다. 최근 검사에서는 비타민 D 수치가 낮다는 설명을 들었습니다.",
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
    expect(body.assessment.context).toContain("요중 칼슘 280입니다");
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
