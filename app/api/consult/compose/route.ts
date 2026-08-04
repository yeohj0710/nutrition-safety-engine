import { NextResponse } from "next/server";
import { callLuna, hasConsultKey } from "@/src/lib/ai-consult";
import { refereeConsult } from "@/src/lib/consult-referee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 이미 고른 문헌만 가지고 상담 어조 문단을 쓴다. 어떤 문헌이 뽑히는지는 여기서
// 하나도 바뀌지 않는다 — 근거 목록은 결정론 라우트가 이미 확정해 보낸 것이고,
// 이 라우트는 그 목록 밖의 사실을 말할 수단이 없다.
//
// 심판(consult-referee)이 지시 표현·되묻기·근거에 없는 숫자를 하나라도 잡으면
// 이 응답은 결정론 문단을 그대로 돌려준다. 그래서 모델이 어떻게 나가든 화면이
// 규칙 파일의 decision_authority=none 을 벗어나지 않는다.

const DEVELOPER = `너는 임상약학 연구실이 만든 문헌 조회 화면의 상담문 작성기다.
아래에 이번 조회가 실제로 고른 문헌과, 시스템이 계산해 둔 사실 기록이 주어진다.
그 사실을 상담하듯 읽히는 한국어 문단으로 다시 쓴다.

문단 네 개, 각각 두세 문장. 순서는 이렇게 한다.
1. 어떤 조건으로 찾았는지 되짚는다.
2. 연결된 문헌이 무엇을 보고했는지 말한다. 연구유형과 연도 구성을 함께 적는다.
3. 이 문헌들이 말하지 않는 것을 적는다.
4. 화면에서 지금 무엇을 보면 되는지 안내한다.

절대 규칙:
- 복용을 시작·중단·조절하라고 쓰지 마라. 안전하다·위험하다고 단정하지 마라.
  너에게는 그 판단 권한이 없고, 이 화면은 근거를 연결해 보여주기만 한다.
- 주어진 자료에 없는 숫자를 쓰지 마라. 용량·상한·기간을 지어내지 마라.
- 되묻지 마라. 물음표를 쓰지 마라. 답을 받을 자리가 없다.
- "적어주신 값과 논문 내용을 대조했다"고 쓰지 마라. 이 도구는 값을 대조하지
  않고, 그 종류의 표현이 초록에 있는 기록만 남긴다.
- 아래 "사실 기록"은 사실의 목록이지 네가 다듬을 문구가 아니다. 표현은 새로
  쓰되 없는 사실을 더하지 마라.
- 입니다체를 쓴다. 문단마다 같은 어미로 끝내지 마라.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["paragraphs"],
  properties: {
    // strict 모드는 minItems/maxItems 를 안 받는다. 개수는 심판에서 자른다.
    paragraphs: { type: "array", items: { type: "string" } },
  },
} as const;

type ComposePayload = {
  situation_label?: unknown;
  condition_line?: unknown;
  narrative?: unknown;
  evidence?: unknown;
};

type Brief = {
  title: string;
  year: number | string;
  kind: string;
  finding: string;
};

function readBriefs(value: unknown): Brief[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 15)
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        title: String(row.title ?? "").slice(0, 240),
        year: typeof row.year === "number" ? row.year : String(row.year ?? ""),
        kind: String(row.publication_types ?? "").split("|")[0] ?? "",
        finding: String(row.key_finding_ko || row.source_sentence || "").slice(0, 400),
      };
    })
    .filter((row) => row.title || row.finding);
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as ComposePayload | null;

  const narrative = Array.isArray(payload?.narrative)
    ? payload.narrative.filter((line): line is string => typeof line === "string")
    : [];
  const briefs = readBriefs(payload?.evidence);
  const situationLabel = String(payload?.situation_label ?? "").slice(0, 80);
  const conditionLine = String(payload?.condition_line ?? "").slice(0, 200);

  // 결정론 문단이 없으면 되돌아갈 곳이 없다. 그때는 아예 부르지 않는다.
  if (!narrative.length) {
    return NextResponse.json(
      { error: "되돌아갈 결정론 문단이 없어 상담문을 만들지 않았습니다." },
      { status: 400 },
    );
  }

  const fallback = {
    paragraphs: narrative,
    source: "deterministic" as const,
  };

  if (!hasConsultKey() || !briefs.length) {
    return NextResponse.json({ ...fallback, reason: "no_key_or_evidence" });
  }

  const evidenceBlock = briefs
    .map(
      (row, index) =>
        `[${index + 1}] ${row.year} · ${row.kind || "연구유형 미표시"}\n제목: ${row.title}\n보고 내용: ${row.finding}`,
    )
    .join("\n\n");

  const user = [
    `상황: ${situationLabel}`,
    conditionLine ? `조건: ${conditionLine}` : "",
    "",
    "사실 기록(시스템이 계산한 것):",
    ...narrative.map((line) => `- ${line}`),
    "",
    // 발췌 목록의 개수를 알려 주면 그 수를 화면 표시 건수인 양 문단에 쓴다.
    // 건수는 위 "사실 기록"에만 있고, 아래 목록은 내용 참고용이다.
    "아래는 연결된 문헌의 제목과 보고 내용이다. 이 목록의 항목 수는 화면에 표시된",
    "건수가 아니므로 세지 말고, 건수는 위 사실 기록에 적힌 숫자만 쓴다.",
    evidenceBlock,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callLuna<{ paragraphs: unknown }>({
    developer: DEVELOPER,
    user,
    schemaName: "consult_paragraphs",
    schema: SCHEMA,
    maxOutputTokens: 2600,
  });

  if (!result.ok) {
    return NextResponse.json({ ...fallback, reason: result.reason });
  }

  // 심판이 보는 허용 목록: 이번 응답이 실제로 고른 문헌 문자열 + 결정론 문단.
  // 여기 없는 숫자가 문단에 나오면 그 문단은 근거 없는 문장이다.
  const allowedText = [user, narrative.join("\n")].join("\n");
  const verdict = refereeConsult({
    paragraphs: result.value.paragraphs,
    allowedText,
  });

  if (!verdict.ok) {
    return NextResponse.json({
      ...fallback,
      reason: "refereed_out",
      rejections: verdict.rejections.slice(0, 6),
    });
  }

  return NextResponse.json({
    paragraphs: verdict.paragraphs,
    source: "ai_written" as const,
  });
}
