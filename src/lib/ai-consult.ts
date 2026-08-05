import "server-only";

// 이 파일만 외부 모델을 부른다. 근거 조회(app/api/personalized-safety)는 지금도
// 외부 호출이 전혀 없는 결정론 경로다. 논문이 주장하는 "같은 입력에 같은 근거"는
// 축 조합 → 근거 목록 단계의 성질이고, 여기서 모델이 하는 일은 두 가지뿐이다.
//
//   1. 사람이 문장으로 쓴 상황을 다섯 입력칸으로 옮긴다(해석).
//   2. 이미 고른 문헌만 가지고 상담 어조 문단을 쓴다(작성).
//
// 어느 쪽도 어떤 문헌이 뽑히는지에 관여하지 않는다. 모델이 고른 축은 화면에
// 그대로 보여주고 사용자가 고칠 수 있으며, 작성 결과는 consult-referee 가
// 검사해서 한 군데라도 걸리면 결정론 문단으로 되돌린다.

const ENDPOINT = "https://api.openai.com/v1/responses";

/** 2026-07-30 인하로 입력 $0.20 / 출력 $1.20 per 1M. 이 용도에 sol·terra 는 과하다. */
export const CONSULT_MODEL = process.env.OPENAI_CONSULT_MODEL ?? "gpt-5.6-luna";
const CONSULT_EFFORT = process.env.OPENAI_CONSULT_EFFORT ?? "low";

/**
 * 기본 제한 시간. 부르는 쪽에서 늘릴 수 있다.
 *
 * 12초로 두고 있었는데 프로덕션 상담문 실측이 10.9초였다. 1초 남기고 자르는
 * 설정이라 조금만 느려지면 폴백으로 떨어지고, 화면은 왜 떨어졌는지 말하지
 * 않으니 "AI 가 안 붙었다"로만 보인다. 글이 길수록 오래 걸리므로 부르는 쪽이
 * 자기 길이에 맞는 값을 준다.
 */
const TIMEOUT_MS = Number(process.env.OPENAI_CONSULT_TIMEOUT_MS ?? 15_000);

export type LunaFailure =
  | "no_key"
  | "timeout"
  | "http_error"
  | "incomplete"
  | "empty"
  | "bad_json";

export type LunaResult<T> =
  | { ok: true; value: T; usage: { input: number; output: number } }
  | { ok: false; reason: LunaFailure; detail?: string };

export function hasConsultKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

type JsonSchema = Record<string, unknown>;

/**
 * Responses API 한 번 호출하고 strict json_schema 로 받은 객체를 돌려준다.
 *
 * 함정 셋(pharmassist 에서 실측):
 * - 추론 모델은 max_output_tokens 가 작으면 추론에 예산을 다 쓰고 메시지 없이
 *   status=incomplete 로 끝난다. 2,000 이상 두고, 미완료는 실패로 처리한다.
 * - strict 스키마에서 anyOf[enum, null] 은 제약 디코딩이 null 로 쏠린다.
 *   "없음" 을 표현해야 하면 enum 에 센티널 문자열을 넣는다.
 * - minItems/maxItems 는 strict 모드가 안 받는다. 개수는 여기서 안 걸고
 *   호출한 쪽에서 자른다.
 */
export async function callLuna<T>({
  developer,
  user,
  schemaName,
  schema,
  maxOutputTokens = 2400,
  timeoutMs = TIMEOUT_MS,
}: {
  developer: string;
  user: string;
  schemaName: string;
  schema: JsonSchema;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<LunaResult<T>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, reason: "no_key" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: CONSULT_MODEL,
        // 고정 지시문을 먼저 두면 프롬프트 캐시 prefix 가 안정된다.
        input: [
          { role: "developer", content: developer },
          { role: "user", content: user },
        ],
        reasoning: { effort: CONSULT_EFFORT },
        max_output_tokens: maxOutputTokens,
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: "http_error",
        detail: `${response.status}`,
      };
    }

    const body = (await response.json()) as {
      status?: string;
      output?: {
        type?: string;
        content?: { type?: string; text?: string }[];
      }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    if (body.status === "incomplete") return { ok: false, reason: "incomplete" };

    const text = (body.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) return { ok: false, reason: "empty" };

    try {
      return {
        ok: true,
        value: JSON.parse(text) as T,
        usage: {
          input: body.usage?.input_tokens ?? 0,
          output: body.usage?.output_tokens ?? 0,
        },
      };
    } catch {
      return { ok: false, reason: "bad_json" };
    }
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }
    return {
      ok: false,
      reason: "http_error",
      detail: caught instanceof Error ? caught.message : "unknown",
    };
  } finally {
    clearTimeout(timer);
  }
}
