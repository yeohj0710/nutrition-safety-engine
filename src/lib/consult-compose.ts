import type { ComposedParagraph } from "@/src/lib/consult-referee";

// 상담문(compose) 요청을 작게 만들고, 같은 요청을 합치고, 기다리는 동안과 실패했을 때
// 보여줄 근거 있는 문단을 만드는 순수 함수들이다. 모델 호출은 여기 없다.
//
// 시간 초과의 원인 셋을 여기서 줄인다.
//   1. 입력이 컸다. 문헌 15편의 초록 전문(편당 최대 24,000자)을 그대로 보냈다.
//      → 검토 문헌을 앞세워 8편까지, 초록은 문장 경계에서 3,200자까지만 보낸다.
//   2. 같은 요청이 여러 번 갔다. 결과가 바뀔 때마다 새 요청을 보내고, 개발 모드의
//      이중 렌더나 두 번 누르기도 각각 모델을 불렀다. → 같은 키의 요청은 한 호출에 묶는다.
//   3. 기다리는 동안 화면이 비어 있었다. → 서버가 먼저 문헌별 정리를 보내고,
//      심장박동으로 연결을 유지하며, 실패해도 같은 정리를 돌려준다.

export type ComposeSource = {
  recordId: string;
  title: string;
  year: string;
  publicationTypes: string;
  abstract: string;
  finding: string;
  findingKo: string;
  population: string;
  dose: string;
  outcome: string;
  locator: string;
  url: string;
  reviewed: boolean;
};

export const COMPOSE_MAX_SOURCES = 8;
export const COMPOSE_ABSTRACT_CHARS = 3200;
export const COMPOSE_INTERIM_PARAGRAPHS = 3;

/** 검토 문헌(한국어 결과 문장이 있는 핵심 근거)을 앞세우고 초록이 있는 후보를 뒤에 둔다. */
export function selectComposeSources<T extends Pick<ComposeSource, "reviewed" | "abstract" | "finding">>(
  sources: readonly T[],
  limit = COMPOSE_MAX_SOURCES,
): T[] {
  return sources
    .map((source, index) => ({
      source,
      index,
      score: (source.reviewed ? 4 : 0) + (source.abstract ? 2 : 0) + (source.finding ? 1 : 0),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map((item) => item.source);
}

function cutAtSentence(text: string, limit: number) {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit);
  const boundary = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "));
  return boundary > limit * 0.6 ? head.slice(0, boundary + 1) : head;
}

const cut = (text: string, limit: number) => (text.length > limit ? `${text.slice(0, limit)}…` : text);

/** 모델에 보낼 한 편 분량. 초록은 문장 경계에서 자르고 잘렸다는 표시를 남긴다. */
export function trimComposeSource(source: ComposeSource) {
  const abstract = cutAtSentence(source.abstract, COMPOSE_ABSTRACT_CHARS);
  return {
    recordId: source.recordId,
    title: source.title,
    year: source.year,
    publicationTypes: source.publicationTypes.split("|").slice(0, 3).join("|"),
    reviewed: source.reviewed,
    finding: source.finding,
    findingKo: source.findingKo,
    population: cut(source.population, 400),
    dose: cut(source.dose, 160),
    outcome: cut(source.outcome, 300),
    abstract,
    abstractTruncated: abstract.length < source.abstract.length,
    url: source.url,
  };
}

export type ComposeRequest = {
  patientContext: string;
  situationLabel: string;
  conditionLine: string;
  sources: ComposeSource[];
};

/** 모델 입력 문자열. 같은 입력이면 같은 문자열이라 캐시 키로도 쓴다. */
export function buildComposeUser(request: ComposeRequest) {
  return JSON.stringify({
    patient_context: request.patientContext || "구체적인 환자 정보는 입력하지 않았습니다.",
    situation: request.situationLabel,
    selected_topics: request.conditionLine,
    sources: selectComposeSources(request.sources).map(trimComposeSource),
  });
}

/**
 * 같은 키의 호출을 한 번으로 합친다.
 *
 * 먼저 온 요청의 취소가 뒤에 온 요청까지 죽이지 않도록, 구독자가 전부 취소했을 때만
 * 실제 호출을 중단한다. 끝난 항목은 지운다(결과 캐시는 호출한 쪽이 따로 둔다).
 */
export class InflightCoalescer<T> {
  private readonly entries = new Map<string, { promise: Promise<T>; controller: AbortController; subscribers: number }>();

  get size() {
    return this.entries.size;
  }

  has(key: string) {
    return this.entries.has(key);
  }

  run(key: string, factory: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    let entry = this.entries.get(key);
    if (!entry) {
      const controller = new AbortController();
      const created = { promise: Promise.resolve() as unknown as Promise<T>, controller, subscribers: 0 };
      created.promise = factory(controller.signal).finally(() => {
        if (this.entries.get(key) === created) this.entries.delete(key);
      });
      // 아무도 결과를 받지 않아도 거부가 처리되지 않은 약속으로 남지 않게 한다.
      created.promise.catch(() => undefined);
      this.entries.set(key, created);
      entry = created;
    }
    entry.subscribers += 1;
    const current = entry;
    signal?.addEventListener(
      "abort",
      () => {
        current.subscribers -= 1;
        if (current.subscribers <= 0) current.controller.abort();
      },
      { once: true },
    );
    return current.promise;
  }
}

/** 화면에 자주 나오는 약어. 처음 나올 때 한 번만 뜻을 붙인다. */
const GLOSSARY: [RegExp, string][] = [
  [/\beGFR\b/, "콩팥 여과 기능 지표"],
  [/\bGFR\b/, "사구체 여과율"],
  [/\bUACR\b/, "소변 알부민 지표"],
  [/\bCKD\b/, "만성콩팥병"],
  [/\bESRD\b/, "말기 신부전"],
  [/\bAKI\b/, "급성 콩팥 손상"],
  [/\bHD\b/, "혈액투석"],
  [/\bPD\b/, "복막투석"],
  [/\bINR\b/, "혈액 응고 지표"],
  [/\baPTT\b/, "부분 트롬보플라스틴 시간"],
  [/\bPT\b/, "프로트롬빈 시간"],
  [/\bHgb\b|\bHb\b/, "혈색소"],
  [/\bPTH\b/, "부갑상선호르몬"],
  [/\bLDL\b/, "저밀도 콜레스테롤"],
  [/\bHDL\b/, "고밀도 콜레스테롤"],
  [/\bTG\b/, "중성지방"],
  [/\bALT\b/, "간효소 ALT"],
  [/\bAST\b/, "간효소 AST"],
  [/\bBMI\b/, "체질량지수"],
  [/\bRCT\b/, "무작위 대조시험"],
  [/\bVTE\b/, "정맥혈전색전증"],
  [/\bDVT\b/, "심부정맥혈전증"],
  [/\bCRP\b/, "염증 지표"],
  [/\bHbA1c\b/, "당화혈색소"],
  [/\bIU\b/, "국제단위"],
  [/\bFPC\b/, "피로인산철 제제"],
  [/\bIV\b/, "정맥주사"],
  [/\bNSAIDs?\b/, "소염진통제"],
];

/** 결과 문장 속 통계 괄호. 방향과 수치는 남기고 p값과 신뢰구간 나열만 걷어낸다. */
const STATISTIC_PARENTHESIS =
  /\s*\((?=[^()]*(?:\bP\s*[<=>]|\bp\s*[<=>]|95\s*%|\bCI\b|신뢰구간|wHR|\bHR\b|\bOR\b|\bRR\b))[^()]*\)/g;

/** 약어에 뜻을 붙이고 통계 괄호를 걷어낸 문장. 숫자와 단위는 그대로 둔다. */
export function plainLanguage(text: string) {
  let result = text.replace(STATISTIC_PARENTHESIS, "");
  for (const [pattern, meaning] of GLOSSARY) {
    result = result.replace(pattern, (match) => (result.includes(`${match}(`) ? match : `${match}(${meaning})`));
  }
  return result.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
}

const excerpt = (text: string, limit: number) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit).trim()}…` : clean;
};

/**
 * 모델이 쓰기 전과 실패했을 때 보여주는 문단. 문헌 한 편에 한 문단씩, 입력한 상황과
 * 그 문헌의 대상, 사용량, 결과가 어떻게 이어지는지를 서버 원자료로 적는다.
 * 사람이 읽을 수 있는 말로 쓰되 원자료 밖의 수치는 만들지 않는다.
 */
export function groundedFallback(
  sources: readonly ComposeSource[],
  situationLabel: string,
  options: { conditionLine?: string; patientContext?: string; limit?: number } = {},
): ComposedParagraph[] {
  const selected = selectComposeSources(sources, options.limit ?? COMPOSE_INTERIM_PARAGRAPHS);
  const situation = situationLabel || "이 상황";
  const condition = options.conditionLine?.trim();
  const patient = options.patientContext?.trim();
  if (!selected.length) {
    return [
      {
        text: `${situation} 상황${condition ? `과 ${condition} 조건` : ""}으로 찾은 문헌 가운데 결과 문장을 연결할 수 있는 것이 없습니다. 조건을 하나 빼고 다시 찾으면 문헌이 늘어날 수 있고, 아래 목록의 원문 링크에서 초록을 직접 볼 수 있습니다.`,
        recordIds: [],
      },
    ];
  }
  return selected.map((source, index) => {
    const status = source.reviewed
      ? "검토한 핵심 문헌"
      : "추가 후보 문헌(주제와 요약을 사람이 하나하나 검토하지 않은 자료)";
    const lead =
      index === 0
        ? `${patient ? `적어주신 상황(${excerpt(patient, 80)})과 ` : ""}${situation}${condition ? `, ${condition}` : ""} 조건으로 찾은 ${status}입니다.`
        : `같은 조건으로 찾은 ${status}입니다.`;
    const finding = source.findingKo
      ? `이 연구가 보고한 결과: ${plainLanguage(source.findingKo)}`
      : source.finding
        ? `결과 문장은 아직 한국어로 옮기지 않아 원문 그대로입니다: ${excerpt(source.finding, 220)}`
        : `제목만 있어 결과 문장을 읽을 수 없습니다: ${excerpt(source.title, 160)}`;
    const dose = source.dose ? ` 연구에서 쓴 양: ${excerpt(source.dose, 120)}.` : "";
    const population = source.population
      ? ` 연구 대상은 원문에 "${excerpt(source.population, 140)}"로 적혀 있습니다.`
      : "";
    const relation = ` 입력하신 나이, 약, 용량 값과 이 연구 대상이 같은지는 여기서 대조하지 않았습니다. 어떤 사람에게 어떤 양을 얼마나 오래 주었는지는 위 대상과 양 설명이 기준입니다.`;
    return {
      text: `${lead} ${finding}${dose}${population}${relation}`.replace(/\s{2,}/g, " ").trim(),
      recordIds: [source.recordId],
    };
  });
}

export type ConsultStreamEvent =
  | { type: "interim"; paragraphs: ComposedParagraph[]; reason: "generating" }
  | { type: "heartbeat"; elapsedMs: number }
  | {
      type: "result";
      paragraphs: ComposedParagraph[];
      source: "ai_written" | "deterministic";
      reason?: string;
      cached?: boolean;
      model?: string;
      effort?: string;
      usage?: { input: number; output: number };
      rejections?: string[];
      elapsedMs?: number;
    };

/** NDJSON 한 덩어리를 줄 단위 사건으로 나눈다. 마지막에 잘린 줄은 남겨서 돌려준다. */
export function splitNdjson(buffer: string): { events: ConsultStreamEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: ConsultStreamEvent[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as ConsultStreamEvent;
      if (parsed && typeof parsed === "object" && "type" in parsed) events.push(parsed);
    } catch {
      // 깨진 줄은 버린다. 결과 줄은 서버가 마지막에 한 번만 보낸다.
    }
  }
  return { events, rest };
}
