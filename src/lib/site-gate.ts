// 지도교수 검토 전까지 연구 누리집을 비밀번호로 닫아 둔다 (2026-11-07 연구자 요청).
// 비밀번호 원문은 저장소에 두지 않고 해시만 둔다. 쿠키에는 같은 해시를 담는다.
export const GATE_COOKIE = "nse_gate";
export const GATE_TOKEN =
  "469ca158e4ccebc0150600d80b2ce6667de3b9121cbed29d672d2eca94eed55f";
export const GATE_MAX_AGE = 60 * 60 * 24 * 30;

export async function hashGatePassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`nse-gate:${password.trim()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/gate")) {
    return "/";
  }
  return next;
}
