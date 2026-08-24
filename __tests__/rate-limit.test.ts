import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clientKey, rateLimit } from "@/src/lib/rate-limit";

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("요청 제한", () => {
  it("한도까지 통과시키고 그 뒤로 막는다", () => {
    const key = `test-${Math.random()}`;
    const opts = { capacity: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit(key, opts).ok, `${i + 1}번째`).toBe(true);
    }
    const blocked = rateLimit(key, opts);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("창이 지나면 다시 채운다", () => {
    const key = `test-${Math.random()}`;
    // windowMs 를 0 으로 두면 매 호출이 새 창이라 언제나 통과한다.
    for (let i = 0; i < 5; i += 1) {
      expect(rateLimit(key, { capacity: 1, windowMs: 0 }).ok).toBe(true);
    }
  });

  it("키가 다르면 서로 영향을 주지 않는다", () => {
    const opts = { capacity: 1, windowMs: 60_000 };
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, opts).ok).toBe(true);
    expect(rateLimit(a, opts).ok).toBe(false);
    expect(rateLimit(b, opts).ok).toBe(true);
  });

  it("프록시 헤더의 첫 주소를 클라이언트로 본다", () => {
    const req = new Request("https://example.test/", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    expect(clientKey(req)).toBe("1.2.3.4");
    expect(clientKey(new Request("https://example.test/"))).toBe("unknown");
  });

  it("모델을 부르는 세 라우트에만 걸고, 조회 라우트에는 걸지 않는다", () => {
    // 조회 라우트는 외부 호출이 없으므로 값이 안 든다. 거기까지 막으면 결정론
    // 조회가 429 로 끊겨 화면만 망가진다.
    for (const rel of [
      "app/api/consult/compose/route.ts",
      "app/api/consult/interpret/route.ts",
      "app/api/consult/record/route.ts",
    ]) {
      expect(read(rel), rel).toContain("rateLimit(");
      expect(read(rel), rel).toContain("tooManyRequests(");
    }
    expect(read("app/api/personalized-safety/route.ts")).not.toContain(
      "rateLimit(",
    );
  });

  it("캐시가 맞은 요청은 한도를 깎지 않는다", () => {
    // 한 화면이 record 를 12건 부르므로, 캐시 적중까지 세면 두 번째 조회부터
    // 429 가 난다. 캐시 조회가 rateLimit 보다 먼저 와야 한다.
    const record = read("app/api/consult/record/route.ts");
    expect(record.indexOf("lineCache.get(")).toBeLessThan(
      record.indexOf("rateLimit("),
    );
    const compose = read("app/api/consult/compose/route.ts");
    expect(compose.indexOf("composeCache.get(")).toBeLessThan(
      compose.indexOf("rateLimit("),
    );
  });
});
