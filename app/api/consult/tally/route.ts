import { NextResponse, after } from "next/server";
import { createHash } from "node:crypto";
import { callLuna, hasConsultKey, CONSULT_MODEL } from "@/src/lib/ai-consult";
import { clientKey, rateLimit, tooManyRequests } from "@/src/lib/rate-limit";
import { loadConsultSources, sourceText } from "@/src/lib/consult-evidence";
import { InflightCoalescer } from "@/src/lib/consult-compose";
import {
  TALLY_SCHEMA,
  buildTallyDeveloper,
  buildTallyUser,
  cleanTallyRow,
  type TallyRow,
} from "@/src/lib/consult-tally";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 목록에 나온 연구를 한 편씩 읽어 결과 방향과 부작용을 칸으로 뽑는다(src/lib/consult-tally.ts).
// 목록과 순서는 바꾸지 않는다. 연구 한 편 = 모델 호출 한 번이고, 같은 연구와 같은 성분이면
// 캐시를 쓴다. 브라우저가 끊겨도 호출은 끝까지 마쳐 캐시에 넣으므로 다시 요청하면 바로 받는다.

const TALLY_EFFORT = "high" as const;
const cache = new Map<string, TallyRow>();
const CACHE_MAX = 2000;
const inflight = new InflightCoalescer<TallyRow | null>();

function remember(key: string, row: TallyRow) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, row);
}

const strings = (value: unknown, limit: number) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 40)).filter(Boolean).slice(0, limit) : [];

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const situation = typeof payload?.situation_id === "string" ? payload.situation_id.slice(0, 80) : "";
  const ids = strings(payload?.record_ids, 15);
  const ingredients = strings(payload?.ingredients, 4);
  if (!hasConsultKey()) return NextResponse.json({ rows: [], reason: "no_key" });
  const sources = await loadConsultSources(situation, ids).catch(() => []);
  if (!sources.length) return NextResponse.json({ rows: [], reason: "no_evidence" });

  const developer = buildTallyDeveloper(ingredients);
  const jobs = sources.map((source) => {
    const user = buildTallyUser(source);
    const key = createHash("sha256").update([CONSULT_MODEL, TALLY_EFFORT, developer, user].join("\n")).digest("hex");
    return { source, user, key };
  });

  if (jobs.some((job) => !cache.has(job.key) && !inflight.has(job.key))) {
    const gate = rateLimit(`tally:${clientKey(req)}`, { capacity: 30, windowMs: 60_000 });
    if (!gate.ok) return tooManyRequests(gate.retryAfterSeconds);
  }

  const started = Date.now();
  const work = Promise.all(
    jobs.map(async (job): Promise<TallyRow | null> => {
      const hit = cache.get(job.key);
      if (hit) return hit;
      return inflight
        .run(job.key, (signal) =>
          callLuna<Record<string, unknown>>({
            developer,
            user: job.user,
            schemaName: "study_tally",
            schema: TALLY_SCHEMA as unknown as Record<string, unknown>,
            // 정해진 칸을 고르는 분류라 high 로 둔다. 같은 초록에서 max 와 같은 분류를 냈고,
            // max 로 15편을 동시에 읽히면 3분이 걸렸다(high 는 한 편 6초 안팎).
            effort: TALLY_EFFORT,
            maxOutputTokens: 32_000,
            timeoutMs: 200_000,
            signal,
          }).then((result) => {
            if (!result.ok) {
              console.warn("[consult/tally] failed", { record: job.source.recordId, reason: result.reason, elapsedMs: Date.now() - started });
              return null;
            }
            const row = cleanTallyRow(job.source.recordId, result.value, sourceText(job.source));
            remember(job.key, row);
            return row;
          }),
        )
        .catch(() => null);
    }),
  );
  // 응답이 끊겨도 함수가 호출을 마칠 때까지 살아 있게 한다. 요청 밖(테스트)에서는 건너뛴다.
  try {
    after(() => work.catch(() => undefined));
  } catch {
    // 요청 범위가 없다.
  }
  const rows = await work;
  const done = rows.filter((row): row is TallyRow => Boolean(row));
  return NextResponse.json({
    rows: done,
    failed: rows.length - done.length,
    model: CONSULT_MODEL,
    effort: TALLY_EFFORT,
    elapsedMs: Date.now() - started,
  });
}
