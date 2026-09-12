import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMPOSE_ROLES, splitNdjson, type ConsultStreamEvent } from "@/src/lib/consult-compose";

// 상담문 라우트가 문단 셋을 동시에 시키고, 끝나는 대로 그 자리만 바꿔 내보내고,
// 한 자리가 실패해도 나머지 문단을 버리지 않는지 본다. 모델 호출만 대역으로 바꾼다.

type LunaCall = { developer: string; user: string; signal?: AbortSignal };
const calls: LunaCall[] = [];
let respond: (call: LunaCall, index: number) => Promise<unknown> = async () => ({
  ok: true,
  value: { text: "이 연구는 수술 전후 환자를 대상으로 했습니다.", recordIds: ["pubmed:41114550"] },
  usage: { input: 10, output: 20 },
});

vi.mock("@/src/lib/ai-consult", async () => {
  const actual = await vi.importActual<typeof import("@/src/lib/ai-consult")>("@/src/lib/ai-consult");
  return {
    ...actual,
    hasConsultKey: () => true,
    callLuna: (options: LunaCall) => {
      const index = calls.length;
      calls.push(options);
      return respond(options, index);
    },
  };
});

const { POST } = await import("@/app/api/consult/compose/route");

const RECORD = "pubmed:41114550";

function request(patientContext: string) {
  return new Request("https://example.test/api/consult/compose", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.9" },
    body: JSON.stringify({
      situation_id: "HRS1_PERIOPERATIVE",
      situation_label: "수술 전후",
      condition_line: "나이",
      patient_context: patientContext,
      evidence: [{ record_id: RECORD }],
    }),
  });
}

async function readStream(response: Response) {
  const events: ConsultStreamEvent[] = [];
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const split = splitNdjson(buffer);
    buffer = split.rest;
    events.push(...split.events);
  }
  events.push(...splitNdjson(`${buffer}\n`).events);
  return events;
}

beforeEach(() => {
  calls.length = 0;
});

describe("상담문 문단 나눠 쓰기", () => {
  it("asks one call per paragraph in parallel and streams each finished paragraph", async () => {
    let started = 0;
    let release: (() => void) | null = null;
    const allStarted = new Promise<void>((resolve) => {
      release = resolve;
    });
    respond = async (call) => {
      started += 1;
      if (started === COMPOSE_ROLES.length) release?.();
      // 셋이 다 출발한 뒤에야 하나라도 끝난다. 순차 호출이면 여기서 멈춘다.
      await allStarted;
      return {
        ok: true,
        value: {
          text: `${call.developer.slice(-20)} 자리의 문단입니다. 수술 전후 환자를 대상으로 한 연구입니다.`,
          recordIds: [RECORD],
        },
        usage: { input: 10, output: 20 },
      };
    };

    const events = await readStream(await POST(request("62세, 심장 수술 예정")));
    expect(calls).toHaveLength(COMPOSE_ROLES.length);
    // 공용 지시문이 앞자락으로 겹쳐야 세 호출의 프롬프트 캐시가 붙는다.
    const shared = calls[0].developer.slice(0, 400);
    for (const call of calls) expect(call.developer.startsWith(shared)).toBe(true);
    expect(new Set(calls.map((call) => call.developer)).size).toBe(COMPOSE_ROLES.length);
    expect(new Set(calls.map((call) => call.user)).size).toBe(1);

    expect(events[0].type).toBe("interim");
    const partials = events.filter((event) => event.type === "partial");
    expect(partials.map((event) => (event as Extract<ConsultStreamEvent, { type: "partial" }>).index).sort()).toEqual([0, 1, 2]);
    const result = events.at(-1) as Extract<ConsultStreamEvent, { type: "result" }>;
    expect(result.type).toBe("result");
    expect(result.source).toBe("ai_written");
    expect(result.reason).toBeUndefined();
    expect(result.paragraphs).toHaveLength(COMPOSE_ROLES.length);
  });

  it("keeps the other paragraphs when one slot fails the referee", async () => {
    respond = async (call, index) =>
      index === 1
        ? { ok: true, value: { text: "근거 없이 9999 mg을 권합니다.", recordIds: [RECORD] }, usage: { input: 1, output: 1 } }
        : { ok: true, value: { text: "수술 전후 환자를 대상으로 한 연구입니다.", recordIds: [RECORD] }, usage: { input: 1, output: 1 } };

    const events = await readStream(await POST(request("48세, 무릎 수술 예정")));
    const result = events.at(-1) as Extract<ConsultStreamEvent, { type: "result" }>;
    expect(result.source).toBe("ai_written");
    expect(result.reason).toBe("partial_fallback:refereed_out");
    expect(result.paragraphs).toHaveLength(COMPOSE_ROLES.length);
    expect(result.paragraphs[0].text).toContain("수술 전후 환자를 대상으로 한 연구");
    // 걸린 자리에는 서버 정리 문단이 들어가고, 다른 자리의 AI 문단은 살아 있다.
    expect(result.paragraphs[1].text).not.toContain("9999");
    expect(result.paragraphs[1].text).toContain("수술 전후");
    expect(result.rejections?.some((item) => item.startsWith("unsupported_number"))).toBe(true);
  });

  it("serves a cached answer without calling the model again", async () => {
    respond = async () => ({
      ok: true,
      value: { text: "수술 전후 환자를 대상으로 한 연구입니다.", recordIds: [RECORD] },
      usage: { input: 1, output: 1 },
    });
    await readStream(await POST(request("55세, 캐시 확인")));
    expect(calls).toHaveLength(COMPOSE_ROLES.length);

    calls.length = 0;
    const again = await POST(request("55세, 캐시 확인"));
    expect(again.headers.get("content-type")).toContain("application/json");
    const body = (await again.json()) as { cached?: boolean; paragraphs: { text: string }[] };
    expect(body.cached).toBe(true);
    expect(body.paragraphs).toHaveLength(COMPOSE_ROLES.length);
    expect(calls).toHaveLength(0);
  });

  it("falls back per slot when the model times out and says so once", async () => {
    respond = async (_call, index) =>
      index === 0 ? { ok: false, reason: "timeout", detail: "deadline" } : { ok: false, reason: "timeout", detail: "deadline" };
    const events = await readStream(await POST(request("71세, 시간 초과 확인")));
    const result = events.at(-1) as Extract<ConsultStreamEvent, { type: "result" }>;
    expect(result.source).toBe("deterministic");
    expect(result.reason).toBe("timeout");
    // 실패해도 문헌별 정리는 그대로 남아 무엇을 근거로 한 자리인지 읽을 수 있다.
    expect(result.paragraphs.length).toBeGreaterThan(0);
    expect(result.paragraphs[0].recordIds).toEqual([RECORD]);
  });
});
