import { NextResponse } from "next/server";

import { GATE_COOKIE, GATE_MAX_AGE, GATE_TOKEN, hashGatePassword, safeNextPath } from "@/src/lib/site-gate";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNextPath(String(form.get("next") ?? "/"));
  const ok = (await hashGatePassword(password)) === GATE_TOKEN;
  const target = new URL(ok ? next : `/gate?error=1&next=${encodeURIComponent(next)}`, request.url);
  const res = NextResponse.redirect(target, 303);
  if (ok) {
    res.cookies.set(GATE_COOKIE, GATE_TOKEN, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: GATE_MAX_AGE,
    });
  }
  return res;
}
