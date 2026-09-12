import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { callLuna, hasConsultKey, CONSULT_MODEL, CONSULT_EFFORT } from "@/src/lib/ai-consult";
import { clientKey, rateLimit, tooManyRequests } from "@/src/lib/rate-limit";
import { refereeConsult, type ComposedParagraph } from "@/src/lib/consult-referee";
import { loadConsultSources, evidenceFallback, sourceText } from "@/src/lib/consult-evidence";
import {
  COMPOSE_PARAGRAPH_SCHEMA,
  COMPOSE_ROLES,
  InflightCoalescer,
  buildComposeUser,
  buildRoleDeveloper,
  selectComposeSources,
  type ConsultStreamEvent,
} from "@/src/lib/consult-compose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 이미 고른 문헌만 가지고 상담문을 쓴다. 어떤 문헌이 뽑히는지는 여기서 바뀌지 않는다.
//
// 문단 셋을 한 호출로 시키던 것을 역할별 세 호출로 나눠 동시에 보낸다. 실측:
// 한 호출은 149초·출력 14,536토큰(그중 추론 13,700), 문단 하나짜리 호출은
// 21.6초·출력 2,378토큰이었다. 모델(gpt-5.6-luna)과 effort(max)는 그대로다.
// 벽시계는 가장 느린 문단 하나로 줄고, 문단은 끝나는 대로 하나씩 내보낸다.
//
// 응답은 두 모양이다. 모델을 부르지 않는 경우(키 없음, 문헌 없음, 세 문단 모두
// 캐시 적중)는 JSON 한 덩어리로 끝낸다. 부르는 경우는 NDJSON 으로 흘려보낸다:
//   1) interim   문헌별 정리(서버 원자료로 만든 결정론 문단). 기다리는 동안 읽는다.
//   2) partial   문단 하나가 끝날 때마다 그 자리만 바꿔 넣는다.
//   3) heartbeat 8초마다. 중간 장비가 조용한 연결을 끊지 않게 하고 경과 시간을 알린다.
//   4) result    확정된 문단 셋. 실패한 자리에는 같은 정리를 넣는다.

type Outcome = Omit<Extract<ConsultStreamEvent, { type: "result" }>, "type">;
type RoleOutcome = {
  paragraph: ComposedParagraph;
  source: "ai_written" | "deterministic";
  reason?: string;
  usage?: { input: number; output: number };
  rejections?: string[];
};

/** 문단 하나짜리 캐시. 조건을 하나만 바꾸면 안 바뀐 문단은 다시 사지 않는다. */
const cache = new Map<string, ComposedParagraph>();
const CACHE_MAX = 360;
const inflight = new InflightCoalescer<RoleOutcome>();
const HEARTBEAT_MS = 8_000;
const string = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";

function remember(key: string, paragraph: ComposedParagraph) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, paragraph);
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const situation = string(payload?.situation_id, 80);
  const situationLabel = string(payload?.situation_label, 100);
  const conditionLine = string(payload?.condition_line, 300);
  const patientContext = string(payload?.patient_context, 3000);
  const ids = Array.isArray(payload?.evidence) ? payload.evidence.flatMap((r: unknown) => r && typeof r === "object" && "record_id" in r && typeof r.record_id === "string" ? [r.record_id] : []) : [];
  const sources = await loadConsultSources(situation, ids).catch(() => []);
  const interim = evidenceFallback(sources, situationLabel, { conditionLine, patientContext });
  // 모델이 못 쓰면 언제나 이 문단으로 돌아온다. 기다리는 동안 보여주는 것과 같은 문단이다.
  const fallback: Outcome = { paragraphs: interim, source: "deterministic" };
  if (!hasConsultKey()) return NextResponse.json({ ...fallback, reason: "no_key" });
  if (!sources.length) return NextResponse.json({ ...fallback, reason: "no_evidence" });

  const recordText = Object.fromEntries(sources.map((source) => [source.recordId, sourceText(source)]));
  const sharedText = [patientContext, situationLabel, conditionLine].join("\n");
  const slots = COMPOSE_ROLES.map((role, index) => {
    const developer = buildRoleDeveloper(role);
    const user = buildComposeUser({ patientContext, situationLabel, conditionLine, sources }, role.sourceLimit);
    return {
      role,
      developer,
      user,
      // 자리마다 다른 정리 문단으로 되돌아간다. 셋이 같은 문장이면 읽을 것이 하나뿐이다.
      fallbackParagraph: interim[Math.min(index, interim.length - 1)] ?? { text: "", recordIds: [] },
      key: createHash("sha256").update([CONSULT_MODEL, CONSULT_EFFORT, developer, user].join("\n")).digest("hex"),
    };
  });
  const cached = slots.map((slot) => cache.get(slot.key));
  if (cached.every((paragraph): paragraph is ComposedParagraph => Boolean(paragraph))) {
    return NextResponse.json({ paragraphs: cached, source: "ai_written", cached: true, model: CONSULT_MODEL, effort: CONSULT_EFFORT } satisfies Outcome);
  }

  // 캐시가 빗나간 뒤에 한도를 본다. 같은 요청을 합치는 중이면 값이 안 들므로 세지 않는다.
  if (slots.some((slot) => !cache.get(slot.key) && !inflight.has(slot.key))) {
    const gate = rateLimit(`compose:${clientKey(req)}`, { capacity: 60, windowMs: 60_000 });
    if (!gate.ok) return tooManyRequests(gate.retryAfterSeconds);
  }

  const started = Date.now();
  const composeSlot = (slot: (typeof slots)[number]) => (signal: AbortSignal): Promise<RoleOutcome> =>
    callLuna<{ text: unknown; recordIds: unknown }>({
      developer: slot.developer,
      user: slot.user,
      schemaName: "consult_paragraph",
      schema: COMPOSE_PARAGRAPH_SCHEMA as unknown as Record<string, unknown>,
      // 추론까지 함께 쓰는 예산. 문헌을 자리마다 넷~다섯으로 줄이고도 본문 없이
      // 끝나는 일이 없도록 16,000으로 둔다(12,000에서 한 자리가 incomplete 였다).
      maxOutputTokens: 16_000,
      // 함수 상한(300초)보다 짧게 잘라 실패 사유와 대체 문단까지 돌려준다.
      timeoutMs: 210_000,
      signal,
    }).then((result): RoleOutcome => {
      if (!result.ok) {
        console.warn("[consult/compose] fallback", { role: slot.role.id, reason: result.reason, detail: result.detail, elapsedMs: Date.now() - started, sources: selectComposeSources(sources).length });
        return { paragraph: slot.fallbackParagraph, source: "deterministic", reason: result.reason };
      }
      const verdict = refereeConsult({ paragraphs: [result.value], recordText, sharedText });
      if (!verdict.ok) {
        console.warn("[consult/compose] refereed out", { role: slot.role.id, rejections: verdict.rejections });
        return { paragraph: slot.fallbackParagraph, source: "deterministic", reason: "refereed_out", rejections: verdict.rejections, usage: result.usage };
      }
      remember(slot.key, verdict.paragraphs[0]);
      return { paragraph: verdict.paragraphs[0], source: "ai_written", usage: result.usage };
    });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: ConsultStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // 이미 닫힌 연결이다.
        }
      };
      send({ type: "interim", paragraphs: interim, reason: "generating" });
      const heartbeat = setInterval(() => send({ type: "heartbeat", elapsedMs: Date.now() - started }), HEARTBEAT_MS);
      // 브라우저가 연결을 끊으면 모델 호출도 끊는다(같은 요청을 함께 기다리는 사람이 없을 때).
      const abort = new AbortController();
      req.signal?.addEventListener("abort", () => { abort.abort(); finish(); }, { once: true });
      Promise.all(
        slots.map(async (slot, index): Promise<RoleOutcome> => {
          const hit = cache.get(slot.key);
          const outcome = hit
            ? { paragraph: hit, source: "ai_written" as const, reason: "cached" }
            : await inflight.run(slot.key, composeSlot(slot), abort.signal).catch((error: unknown): RoleOutcome => {
                console.warn("[consult/compose] failed", { role: slot.role.id, message: error instanceof Error ? error.message : "unknown" });
                return { paragraph: slot.fallbackParagraph, source: "deterministic", reason: "http_error" };
              });
          send({ type: "partial", index, paragraph: outcome.paragraph, source: outcome.source, reason: outcome.reason, elapsedMs: Date.now() - started });
          return outcome;
        }),
      )
        .then((outcomes) => {
          const written = outcomes.filter((item) => item.source === "ai_written").length;
          const usage = outcomes.reduce(
            (total, item) => ({ input: total.input + (item.usage?.input ?? 0), output: total.output + (item.usage?.output ?? 0) }),
            { input: 0, output: 0 },
          );
          const failed = outcomes.flatMap((item) => (item.source === "ai_written" ? [] : [item.reason ?? "unknown"]));
          send({
            type: "result",
            paragraphs: outcomes.map((item) => item.paragraph),
            source: written > 0 ? "ai_written" : "deterministic",
            // 셋 다 실패하면 하나의 사유로, 일부만 실패하면 어느 자리가 정리로 남았는지 알린다.
            reason: failed.length === outcomes.length ? failed[0] : failed.length ? `partial_fallback:${failed.join(",")}` : undefined,
            rejections: outcomes.flatMap((item) => item.rejections ?? []),
            usage,
            model: CONSULT_MODEL,
            effort: CONSULT_EFFORT,
            elapsedMs: Date.now() - started,
          });
        })
        .catch((error: unknown) => {
          console.warn("[consult/compose] failed", { message: error instanceof Error ? error.message : "unknown" });
          send({ type: "result", ...fallback, reason: "http_error", elapsedMs: Date.now() - started });
        })
        .finally(finish);
    },
    cancel() {
      // 읽는 쪽이 사라졌다. 남은 일은 위의 abort 처리와 코얼레서가 정리한다.
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
