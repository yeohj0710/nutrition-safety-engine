import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { GATE_COOKIE, GATE_TOKEN } from "@/src/lib/site-gate";

// 비밀번호를 넣기 전에는 모든 화면과 API를 막고 입력 화면으로 보낸다.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/gate" || pathname === "/api/gate") {
    return NextResponse.next();
  }
  if (request.cookies.get(GATE_COOKIE)?.value === GATE_TOKEN) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "비밀번호가 필요합니다." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|yonsei-logo.svg|icon|apple-icon|manifest.webmanifest).*)",
  ],
};
