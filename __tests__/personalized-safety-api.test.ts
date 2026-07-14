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
      expect(body.ai_summary).toContain("그래서 지금은");
      expect(body.evidence).toHaveLength(5);
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
    expect(body.ai_summary).toContain(
      "제품 라벨에서 원소 칼슘이 하루에 실제로 얼마인지 확인하고",
    );
    expect(body.ai_summary).toContain(
      "결석 성분 결과와 이번 24시간 소변검사를 비뇨의학과나 처방기관에 가져가",
    );
    expect(body.ai_summary).not.toMatch(
      /입력(?:되|하|된)|입력값|대상자|사용자|프로필|검사값|현재 입력한 조건|종합하면|핵심은|상담 전에는|이시군요|살펴볼게요|적어주셨네요/,
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
