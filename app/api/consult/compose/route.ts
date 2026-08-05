import { NextResponse } from "next/server";
import { callLuna, hasConsultKey } from "@/src/lib/ai-consult";
import { refereeConsult } from "@/src/lib/consult-referee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 네 문단을 쓰는 호출이라 실측 10.9초가 나온다. 이 값을 안 두면 플랫폼 기본
// 상한에 먼저 걸려, 모델이 답을 쓰고 있는 중에 함수가 끊긴다.
export const maxDuration = 60;

// 이미 고른 문헌만 가지고 상담 어조 문단을 쓴다. 어떤 문헌이 뽑히는지는 여기서
// 하나도 바뀌지 않는다 — 근거 목록은 결정론 라우트가 이미 확정해 보낸 것이고,
// 이 라우트는 그 목록 밖의 사실을 말할 수단이 없다.
//
// 문단마다 근거로 삼은 기록 번호를 같이 받는다. 그래야 심판이 "이 값이 어딘가
// 있다"가 아니라 "이 문장이 근거로 든 기록 안에 있다"를 볼 수 있고, 화면도
// 문단 옆에 출처를 표시할 수 있다.

const DEVELOPER = `너는 임상약학 연구실이 만든 문헌 조회 화면의 상담문 작성기다.
아래에 이번 조회가 실제로 고른 문헌과, 시스템이 계산해 둔 사실 기록이 주어진다.
그 사실을 상담하듯 읽히는 한국어 문단으로 다시 쓴다.

문단 네 개, 각각 두세 문장. 순서는 이렇게 한다.
1. 어떤 조건으로 찾았는지 되짚는다.
2. 연결된 문헌이 무엇을 보고했는지 말한다. 연구유형과 연도 구성을 함께 적는다.
3. 이 문헌들이 말하지 않는 것을 적는다.
4. 화면에서 지금 무엇을 보면 되는지 안내한다.

각 문단에는 recordIds 를 함께 낸다. 그 문단이 실제로 내용을 가져온 문헌만,
아래 목록의 [id] 그대로, 최대 3개까지 적는다. 전체를 요약하는 문단이나 화면
사용법을 안내하는 문단처럼 특정 문헌을 짚지 않는 문단은 빈 배열로 둔다.
문헌을 많이 적을수록 좋은 것이 아니다. 전부를 가리키면 아무것도 가리키지 않는
것과 같다.
문단에 쓰는 숫자는 그 문단이 인용한 문헌이나 사실 기록에 있는 값만 쓴다.

절대 규칙:
- 복용을 시작·중단·조절하라고 쓰지 마라. 안전하다·위험하다고 단정하지 마라.
  너에게는 그 판단 권한이 없고, 이 화면은 근거를 연결해 보여주기만 한다.
- 주어진 자료에 없는 숫자를 쓰지 마라. 용량·상한·기간을 지어내지 마라.
- 되묻지 마라. 물음표를 쓰지 마라. 답을 받을 자리가 없다.
- "적어주신 값과 논문 내용을 대조했다"고 쓰지 마라. 이 도구는 값을 대조하지
  않고, 그 종류의 표현이 초록에 있는 기록만 남긴다.
- 아래 "사실 기록"은 사실의 목록이지 네가 다듬을 문구가 아니다. 표현은 새로
  쓰되 없는 사실을 더하지 마라.
- 입니다체를 쓴다. 문단마다 같은 어미로 끝내지 마라.

문체:
- 능동형으로 쓴다. "설정되었습니다·확인됩니다·보여집니다" 대신 "골랐습니다·
  확인합니다·보여드립니다"로 쓴다. "~게 되다"도 쓰지 마라.
- 무엇을 말하는지 목적어를 밝힌다. "집계해서 보여줍니다"가 아니라 "연결된
  문헌을 연구유형별로 나눠 보여줍니다"로 쓴다.
- 입으로 쓰는 말을 쓴다. 섭취·유의·권장 대신 먹다·보다·권하다를 쓴다.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["paragraphs"],
  properties: {
    // strict 모드는 minItems/maxItems 를 안 받는다. 개수는 심판에서 자른다.
    paragraphs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "recordIds"],
        properties: {
          text: { type: "string" },
          recordIds: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

type ComposePayload = {
  situation_label?: unknown;
  condition_line?: unknown;
  narrative?: unknown;
  evidence?: unknown;
};

type Brief = {
  recordId: string;
  title: string;
  year: number | string;
  kind: string;
  finding: string;
};

function readBriefs(value: unknown): Brief[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 15)
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      return {
        recordId: String(row.record_id ?? `R${index + 1}`).slice(0, 40),
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
    paragraphs: narrative.map((text) => ({ text, recordIds: [] as string[] })),
    source: "deterministic" as const,
  };

  // 폴백은 화면에서 티가 안 난다. 왜 떨어졌는지 여기서 갈라 두어야 화면이
  // 사람 말로 옮길 수 있고, 로그로도 원인이 남는다.
  if (!hasConsultKey()) {
    console.warn("[consult/compose] fallback", { reason: "no_key" });
    return NextResponse.json({ ...fallback, reason: "no_key" });
  }
  if (!briefs.length) {
    console.warn("[consult/compose] fallback", { reason: "no_evidence" });
    return NextResponse.json({ ...fallback, reason: "no_evidence" });
  }

  const evidenceBlock = briefs
    .map(
      (row) =>
        `[${row.recordId}] ${row.year} · ${row.kind || "연구유형 미표시"}\n제목: ${row.title}\n보고 내용: ${row.finding}`,
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
    "각 문단의 recordIds 에는 아래 대괄호 안의 id 를 그대로 적는다.",
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
    timeoutMs: 35_000,
  });

  if (!result.ok) {
    console.warn("[consult/compose] fallback", {
      reason: result.reason,
      detail: result.detail,
    });
    return NextResponse.json({ ...fallback, reason: result.reason });
  }

  // 문단이 인용한 기록 안에서만 숫자를 허용한다. 공용으로 쓸 수 있는 값은
  // 시스템이 계산한 결정론 문단과 조건 줄뿐이다.
  const recordText = Object.fromEntries(
    briefs.map((row) => [
      row.recordId,
      `${row.year} ${row.kind} ${row.title} ${row.finding}`,
    ]),
  );
  const sharedText = [situationLabel, conditionLine, narrative.join("\n")].join("\n");

  const verdict = refereeConsult({
    paragraphs: result.value.paragraphs,
    recordText,
    sharedText,
  });

  if (!verdict.ok) {
    console.warn("[consult/compose] refereed out", {
      rejections: verdict.rejections.slice(0, 6),
    });
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
