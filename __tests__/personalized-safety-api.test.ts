import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/personalized-safety/route";
const original = process.env.OPENAI_API_KEY;
afterEach(() => {
  vi.restoreAllMocks();
  if (original) process.env.OPENAI_API_KEY = original;
  else delete process.env.OPENAI_API_KEY;
});
describe("personalized safety API", () => {
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
