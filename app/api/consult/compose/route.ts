import { NextResponse } from "next/server";
import { callLuna, hasConsultKey } from "@/src/lib/ai-consult";
import { clientKey, rateLimit, tooManyRequests } from "@/src/lib/rate-limit";
import { refereeConsult, type ComposedParagraph } from "@/src/lib/consult-referee";

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

const DEVELOPER = `너는 약국 상담 창구에 앉은 약사다. 앞에 앉은 사람이 방금 찾아 본
문헌을 같이 들여다보며, 그 문헌들이 실제로 무엇을 보고했는지를 말로 풀어 준다.

아래 "문헌"에 초록에서 뽑은 문장이 그대로 들어 있다. 그 문장이 네 글의 재료다.
문장을 읽고 내용을 말해라. 몇 편이 나왔고 연구 종류가 어떻게 섞였는지는 화면이
이미 보여 주고 있으니 네가 다시 말할 것이 아니다.

문단 세 개, 각각 두세 문장.
1. 이 문헌들이 무엇을 보고했는지. 어떤 대상에게 무엇을 얼마나 주었더니 무엇이
   어떻게 달라졌다고 했는지를 문헌에 적힌 그대로 짚어 쓴다. 같은 이야기를 한
   문헌은 묶고, 성분 이름과 결과 이름을 그대로 부른다.
2. 문헌끼리 갈리는 자리, 또는 조건이 붙는 자리. 대상이 다르거나 결과가 엇갈리면
   엇갈린 대로 쓴다. 갈리는 자리가 없으면 가장 구체적인 문헌 하나를 더 자세히
   짚는다.
3. 이 문헌들이 다루지 않은 것. 목록을 실제로 훑어서 없는 것만 쓴다.

각 문단에 recordIds 를 함께 낸다. 그 문단이 내용을 가져온 문헌만, 아래 목록의
[id] 그대로, 최대 5개까지 적는다. 1번과 2번 문단은 비워 두지 마라.

**문단에 숫자를 하나라도 썼으면 그 숫자가 적힌 문헌을 recordIds 에 반드시
넣어라.** 인용하지 않은 문헌의 수치를 쓰면 그 문단은 검사에서 걸리고, 상담문
전체가 버려진다. 다섯 개로 모자라면 수치를 줄여서 쓰고, 인용을 늘리지 못한
문헌의 숫자는 아예 쓰지 마라.

한 문단은 300자 안팎으로 쓴다. 380자를 넘으면 검사에서 걸린다.

절대 규칙:
- 뭉뚱그리지 마라. "일부 연구는 좋아졌다고 했습니다"는 아무것도 말하지 않은
  문장이다. 무슨 성분이 누구에게 무엇을 얼마나 바꿨는지까지 적어라.
- 문헌 편수, 연구 종류 구성, 연도 범위를 문단에 쓰지 마라. 화면에 이미 있다.
- 문헌에 없는 숫자를 쓰지 마라. 용량, 상한, 기간을 지어내지 마라.
- 복용을 시작하거나 끊거나 양을 바꾸라고 쓰지 마라. 안전하다, 위험하다고
  단정하지 마라. 너에게는 그 판단 권한이 없다.
- "적어주신 값과 논문 내용을 대조했다"고 쓰지 마라. 이 도구는 값을 대조하지
  않고, 그 종류의 이야기가 초록에 나온 기록만 남긴다.
- 되묻지 마라. 물음표를 쓰지 마라. 답을 받을 자리가 없다.
- 가운뎃점(·)을 쓰지 마라. 나열은 쉼표로 한다. "나트륨·인·칼슘" 이 아니라
  "나트륨, 인, 칼슘" 이다. 화면 글에 가운뎃점을 쓰지 않기로 정해 두었다.
- 입니다체를 쓴다. 문단마다 같은 어미로 끝내지 마라.

이렇게 쓰지 마라 → 이렇게 써라:
- "찾은 문헌은 15편이고 무작위 대조시험과 메타분석이 섞여 있습니다."
  → "칼슘 폴리스티렌설폰산을 쓴 연구는 혈청 칼륨이 내려갔다고 했고, 황기를 쓴
    연구는 eGFR 이 떨어지는 속도가 대조군보다 느렸다고 했습니다."
- "일부 연구는 콩팥 기능 감소가 더 느렸다고 보고했습니다."
  → "황기 추출물을 쓴 비투석 만성콩팥병 환자에서 eGFR 감소 속도가 대조군보다
    느렸다고 했습니다."
- "이 문헌들은 개인에게 그대로 적용할 수 있는지 말해 주지 않습니다."
  → "투석을 받는 사람만 본 연구가 대부분이라, 투석 전 단계에서 같은 결과가
    나오는지는 이 목록에 없습니다."

문체:
- 능동형으로 쓴다. "설정되었습니다, 확인됩니다, 보여집니다" 대신 "골랐습니다,
  확인합니다, 보여드립니다"로 쓴다. "~게 되다"도 쓰지 마라.
- 무엇을 말하는지 목적어를 밝힌다.
- 입으로 쓰는 말을 쓴다. 섭취, 유의, 권장, 해당 대신 먹다, 보다, 권하다, 그를
  쓴다.
- 도구 안쪽에서 쓰는 이름을 그대로 옮기지 마라. 필터, 축, 메타데이터, 레코드,
  매칭, 스코프는 화면에 없는 말이다.`;

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
  original: string;
  population: string;
  dose: string;
  outcome: string;
};

const composeCache = new Map<string, ComposedParagraph[]>();
const COMPOSE_CACHE_MAX = 200;

function readBriefs(value: unknown): Brief[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 15)
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      const ko = String(row.key_finding_ko ?? "").slice(0, 700);
      const raw = String(row.source_sentence ?? "").slice(0, 700);
      return {
        recordId: String(row.record_id ?? `R${index + 1}`).slice(0, 40),
        title: String(row.title ?? "").slice(0, 240),
        year: typeof row.year === "number" ? row.year : String(row.year ?? ""),
        kind: String(row.publication_types ?? "").split("|")[0] ?? "",
        finding: ko,
        // 번역이 없는 기록이 절반 넘는다. 원문 문장을 같이 보내야 모델이 읽을
        // 내용이 생기고, 번역이 있어도 원문에만 남은 수치를 놓치지 않는다.
        original: raw && raw !== ko ? raw : "",
        population: String(row.population ?? "").slice(0, 200),
        dose: String(row.dose ?? "").slice(0, 120),
        outcome: String(row.outcome ?? "").slice(0, 200),
      };
    })
    .filter((row) => row.title || row.finding || row.original);
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

  /**
   * 같은 조회는 같은 문헌 묶음을 낸다. 조회 경로가 결정론이므로 상황과 조건이
   * 같으면 문헌 15편이 그대로 같고, 그러면 상담문을 다시 살 이유가 없다.
   *
   * 이 사이트에서 값이 붙는 자리는 여기 하나뿐이고 호출당 약 0.003달러다.
   * 캐시가 없으면 같은 상황을 누르는 방문자마다 같은 문단을 다시 산다. 상황이
   * 다섯 개뿐이라 조건 조합까지 합쳐도 캐시가 곧 다 맞는다.
   *
   * 부수 효과가 하나 더 있다. 같은 조건을 다시 조회했을 때 문단이 매번 달라지지
   * 않는다. 근거지도로서는 그게 맞는 성질이다.
   */
  const cacheKey = [
    situationLabel,
    conditionLine,
    briefs.map((row) => row.recordId).join(","),
  ].join("|");
  const cachedParagraphs = composeCache.get(cacheKey);
  if (cachedParagraphs) {
    return NextResponse.json({
      paragraphs: cachedParagraphs,
      source: "ai_written" as const,
      cached: true,
    });
  }

  // 캐시가 빗나간 뒤에 한도를 본다. 캐시가 맞는 요청은 값이 안 들므로 세지 않는다.
  const gate = rateLimit(`compose:${clientKey(req)}`, {
    capacity: 60,
    windowMs: 60_000,
  });
  if (!gate.ok) {
    console.warn("[consult/compose] rate limited", { retry: gate.retryAfterSeconds });
    return tooManyRequests(gate.retryAfterSeconds);
  }

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
    .map((row) =>
      [
        `[${row.recordId}] ${row.year}, ${row.kind || "연구유형 미표시"}`,
        `제목: ${row.title}`,
        row.population ? `대상: ${row.population}` : "",
        row.dose ? `먹은 양: ${row.dose}` : "",
        row.outcome ? `본 결과: ${row.outcome}` : "",
        row.finding ? `초록에서 뽑은 문장: ${row.finding}` : "",
        row.original ? `원문 문장: ${row.original}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");

  // 문헌을 맨 앞에 둔다. 계산해 둔 문장을 먼저 보여 주면 모델이 그 어투를
  // 이어받아 "몇 편이 나왔습니다" 밖으로 못 나간다.
  const user = [
    `상황: ${situationLabel}`,
    conditionLine ? `조건: ${conditionLine}` : "",
    "",
    "문헌 — 이 내용을 읽고 쓴다. 대괄호 안의 id 를 recordIds 에 그대로 적는다.",
    evidenceBlock,
    "",
    "화면이 이미 보여 주고 있는 것 — 다시 쓰지 마라. 편수, 연구 종류 구성,",
    "연도 범위는 아래에 있으므로 네 문단에 옮기지 않는다.",
    ...narrative.map((line) => `- ${line}`),
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callLuna<{ paragraphs: unknown }>({
    developer: DEVELOPER,
    user,
    schemaName: "consult_paragraphs",
    schema: SCHEMA,
    // effort 를 올리면 추론 토큰이 이 예산에서 먼저 나간다. high + 3,200 으로
    // 두었더니 추론에 다 쓰고 메시지 없이 status=incomplete 로 끝나 매 요청이
    // 폴백이었다(프로덕션 실측). 예산은 추론 몫까지 잡아 둔다.
    maxOutputTokens: 8000,
    timeoutMs: 45_000,
    // 문헌 15편의 문장을 읽고 갈리는 자리까지 찾아야 한다. low 로 두면 읽지
    // 않고 목록을 요약해 버린다. 값이 붙는 자리는 여기 하나뿐이고, 축 해석과
    // 한 줄 요약은 low 그대로 둔다.
    effort: process.env.OPENAI_CONSULT_COMPOSE_EFFORT ?? "medium",
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
      [
        row.year,
        row.kind,
        row.title,
        row.population,
        row.dose,
        row.outcome,
        row.finding,
        row.original,
      ].join(" "),
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

  // 이 라우트가 이 사이트에서 값이 붙는 유일한 자리다. 응답에 사용량을 실어
  // 두면 값이 얼마나 드는지 브라우저 네트워크 탭에서 바로 센다.
  if (composeCache.size >= COMPOSE_CACHE_MAX) {
    composeCache.delete(composeCache.keys().next().value as string);
  }
  composeCache.set(cacheKey, verdict.paragraphs);

  return NextResponse.json({
    paragraphs: verdict.paragraphs,
    source: "ai_written" as const,
    usage: result.usage,
  });
}
