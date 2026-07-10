import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { runThesisEngine } from "@/src/engine/run-thesis-engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const response = runThesisEngine(await request.json());
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof ZodError
        ? "입력 형식이 올바르지 않습니다."
        : error instanceof Error
          ? error.message
          : "요청을 처리하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
