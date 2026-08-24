import "server-only";

/**
 * 모델을 부르는 라우트 앞에 두는 요청 제한.
 *
 * 세 라우트(consult/interpret, consult/record, consult/compose)는 로그인이 없는
 * 공개 엔드포인트다. 제한이 없으면 누가 반복해서 POST 하는 만큼 그대로 과금된다.
 * 조회 라우트(personalized-safety)는 외부 호출이 없으므로 여기 걸지 않는다.
 *
 * **서버리스 인스턴스 안에서만 산다.** 인스턴스가 여러 개 뜨면 그만큼 한도가
 * 늘어나므로 이것은 단단한 방어가 아니라 명백한 반복 호출을 끊는 장치다.
 * 진짜 상한이 필요하면 외부 저장소를 붙여야 하는데, 지금 규모에서 그것까지
 * 둘 일은 아니다.
 */

type Bucket = { tokens: number; refilledAt: number };

const buckets = new Map<string, Bucket>();
/** 인스턴스가 오래 살면서 IP 키가 무한히 쌓이는 것을 막는다. */
const MAX_KEYS = 5_000;

export type RateLimitVerdict =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number };

/**
 * 프록시 뒤라서 소켓 주소가 아니라 헤더를 본다. Vercel 이 붙이는
 * `x-forwarded-for` 의 첫 항목이 실제 클라이언트다. 헤더가 없으면 한 덩어리로
 * 묶는다. 그 경우 제한이 전체 공유가 되지만, 없는 것보다 낫다.
 */
export function clientKey(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

/**
 * 토큰 버킷. `capacity` 개를 담고 `windowMs` 마다 가득 채운다.
 *
 * 한 번 조회하면 record 가 최대 12건, compose 가 1건, interpret 이 1건 나간다.
 * 그래서 라우트마다 한도를 다르게 준다.
 */
export function rateLimit(
  key: string,
  { capacity, windowMs }: { capacity: number; windowMs: number },
): RateLimitVerdict {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now - bucket.refilledAt >= windowMs) {
    bucket = { tokens: capacity, refilledAt: now };
    if (buckets.size >= MAX_KEYS) {
      buckets.delete(buckets.keys().next().value as string);
    }
    buckets.set(key, bucket);
  }

  if (bucket.tokens <= 0) {
    const waitMs = windowMs - (now - bucket.refilledAt);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)) };
  }

  bucket.tokens -= 1;
  return { ok: true, remaining: bucket.tokens };
}

/** 한도에 걸렸을 때 화면이 사람 말로 옮길 수 있게 이유를 담아 돌려준다. */
export function tooManyRequests(retryAfterSeconds: number) {
  return Response.json(
    {
      ok: false,
      reason: "rate_limited",
      retry_after_seconds: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "retry-after": String(retryAfterSeconds),
        "cache-control": "no-store",
      },
    },
  );
}
