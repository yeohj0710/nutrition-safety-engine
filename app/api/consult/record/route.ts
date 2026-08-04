import { NextResponse } from "next/server";
import { callLuna, hasConsultKey } from "@/src/lib/ai-consult";
import { refereeRecordLine } from "@/src/lib/consult-referee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 기록 한 건만 한국어 한 줄로 옮긴다. 확장 근거는 한국어 번역이 없어 영어 원문
// 문장만 보이는데(임신·용량 조건에서 15건 중 7건이 그렇다), 그 문장이 무엇을
// 말하는지 한 줄로 짚어 준다.
//
// 어떤 문헌이 뽑히는지는 여기서 바뀌지 않는다. 이미 뽑힌 기록 하나를 받아 그
// 기록이 담은 말만 옮긴다. 심판이 그 기록 밖의 숫자와 복용 지시를 막는다.

const DEVELOPER = `너는 문헌 조회 화면에서 논문 한 편의 결과 문장을 한국어 한 줄로 옮긴다.

- 주어진 문장이 보고한 내용만 옮긴다. 다른 논문이나 일반론을 덧붙이지 않는다.
- 주어진 자료에 없는 숫자를 쓰지 않는다. 용량·상한·기간을 지어내지 않는다.
- 복용을 시작·중단·조절하라고 쓰지 않는다. 안전하다·위험하다고 단정하지 않는다.
  너에게는 그 판단 권한이 없다. 이 화면은 근거를 연결해 보여주기만 한다.
- 개인에게 일어날 일로 쓰지 않는다. 연구가 무엇을 관찰했는지로 쓴다.
- 되묻지 않는다. 물음표를 쓰지 않는다.
- 입으로 쓰는 말로, 한 문장 70자 안팎으로 쓴다.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["line"],
  properties: { line: { type: "string" } },
} as const;

const str = (v: unknown, n = 400) => (typeof v === "string" ? v.slice(0, n) : "");

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const sentence = str(body?.source_sentence);
  if (!sentence) {
    return NextResponse.json({ ok: false, reason: "no_sentence" }, { status: 400 });
  }
  if (!hasConsultKey()) return NextResponse.json({ ok: false, reason: "no_key" });

  const source = [
    `제목: ${str(body?.title, 240)}`,
    `연도: ${str(String(body?.year ?? ""), 10)}`,
    `연구유형: ${str(String(body?.publication_types ?? "").split("|")[0], 60)}`,
    `결과 문장: ${sentence}`,
  ].join("\n");

  const result = await callLuna<{ line: unknown }>({
    developer: DEVELOPER,
    user: source,
    schemaName: "record_line",
    schema: SCHEMA,
    maxOutputTokens: 1600,
  });

  if (!result.ok) return NextResponse.json({ ok: false, reason: result.reason });

  const verdict = refereeRecordLine({ line: result.value.line, allowedText: source });
  if (!verdict.ok) return NextResponse.json({ ok: false, reason: verdict.reason });

  return NextResponse.json({ ok: true, line: verdict.line });
}
