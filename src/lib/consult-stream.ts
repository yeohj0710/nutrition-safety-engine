import { splitNdjson, type ConsultStreamEvent } from "@/src/lib/consult-compose";

// 브라우저 쪽에서 상담문 응답을 읽는다. 서버는 두 가지 모양으로 답한다.
//   - application/json        : 키가 없거나 문헌이 없거나 캐시가 맞은 경우. 한 번에 끝.
//   - application/x-ndjson    : 모델을 부르는 경우. 문헌별 정리(interim) → 심장박동 →
//                               결과(result) 순으로 줄마다 하나씩 온다.
// 어느 쪽이든 마지막에는 result 하나를 넘긴다.

export async function readConsultResponse(
  response: Response,
  onEvent: (event: ConsultStreamEvent) => void,
): Promise<void> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("x-ndjson") || !response.body) {
    const body = (await response.json()) as Omit<Extract<ConsultStreamEvent, { type: "result" }>, "type">;
    onEvent({ type: "result", ...body });
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawResult = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = splitNdjson(buffer);
    buffer = rest;
    for (const event of events) {
      if (event.type === "result") sawResult = true;
      onEvent(event);
    }
  }
  const tail = splitNdjson(`${buffer}${decoder.decode()}\n`);
  for (const event of tail.events) {
    if (event.type === "result") sawResult = true;
    onEvent(event);
  }
  if (!sawResult) throw new Error("consult stream ended without a result");
}

/** 기다린 시간을 사람 말로. "1분 20초째" 처럼 읽힌다. */
export function elapsedLabel(elapsedMs: number) {
  const seconds = Math.max(0, Math.round(elapsedMs / 1000));
  if (seconds < 60) return `${seconds}초째`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}분 ${rest}초째` : `${minutes}분째`;
}
