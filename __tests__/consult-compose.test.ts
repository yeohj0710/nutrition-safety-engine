import { describe, expect, it } from "vitest";
import {
  COMPOSE_ABSTRACT_CHARS,
  COMPOSE_MAX_SOURCES,
  InflightCoalescer,
  buildComposeUser,
  groundedFallback,
  plainLanguage,
  selectComposeSources,
  splitNdjson,
  trimComposeSource,
  type ComposeSource,
} from "@/src/lib/consult-compose";

function source(overrides: Partial<ComposeSource> & { recordId: string }): ComposeSource {
  return {
    title: "Vitamin D in hemodialysis",
    year: "2015",
    publicationTypes: "Journal Article|Randomized Controlled Trial|Multicenter Study|Research Support",
    abstract: "BACKGROUND: Something. METHODS: Something else. RESULTS: Hgb rose 0.4 g/dL. CONCLUSIONS: Done.",
    finding: "RESULTS: Hgb rose 0.4 g/dL.",
    findingKo: "혈액투석 환자에서 Hgb가 0.4 g/dL 올랐습니다(P<0.001; 95% 신뢰구간 0.2~0.6).",
    population: "599 iron-replete chronic hemodialysis patients",
    dose: "2000 IU daily",
    outcome: "Hemoglobin maintained",
    locator: "ABSTRACT_SENTENCE_8",
    url: "https://pubmed.ncbi.nlm.nih.gov/1/",
    reviewed: true,
    ...overrides,
  };
}

describe("상담문 입력 축소", () => {
  it("puts reviewed sources first and caps the list", () => {
    const sources = [
      ...Array.from({ length: 6 }, (_, index) => source({ recordId: `cand${index}`, reviewed: false, findingKo: "" })),
      source({ recordId: "core1" }),
      source({ recordId: "core2" }),
      source({ recordId: "titleOnly", reviewed: false, abstract: "", finding: "", findingKo: "" }),
    ];
    const selected = selectComposeSources(sources);
    expect(selected).toHaveLength(COMPOSE_MAX_SOURCES);
    expect(selected.slice(0, 2).map((item) => item.recordId)).toEqual(["core1", "core2"]);
    expect(selected.some((item) => item.recordId === "titleOnly")).toBe(false);
  });

  it("cuts long abstracts at a sentence boundary and flags the cut", () => {
    const long = source({ recordId: "long", abstract: `${"A sentence about kidneys. ".repeat(300)}` });
    const trimmed = trimComposeSource(long);
    expect(trimmed.abstract.length).toBeLessThanOrEqual(COMPOSE_ABSTRACT_CHARS);
    expect(trimmed.abstract.endsWith(".")).toBe(true);
    expect(trimmed.abstractTruncated).toBe(true);
    expect(trimComposeSource(source({ recordId: "short" })).abstractTruncated).toBe(false);
    expect(trimmed.publicationTypes.split("|")).toHaveLength(3);
  });

  it("builds the same model input for the same request", () => {
    const request = { patientContext: "68세 투석", situationLabel: "신질환·투석", conditionLine: "함께 먹는 약", sources: [source({ recordId: "a" })] };
    expect(buildComposeUser(request)).toBe(buildComposeUser({ ...request }));
    expect(buildComposeUser(request)).not.toBe(buildComposeUser({ ...request, patientContext: "다른 환자" }));
    expect(JSON.parse(buildComposeUser(request)).sources[0].abstractTruncated).toBe(false);
  });
});

describe("같은 요청 합치기", () => {
  it("shares one in-flight call between identical requests and aborts only when everyone leaves", async () => {
    const coalescer = new InflightCoalescer<string>();
    let calls = 0;
    let observed: AbortSignal | null = null;
    const factory = (signal: AbortSignal) => {
      calls += 1;
      observed = signal;
      return new Promise<string>((resolve) => setTimeout(() => resolve("done"), 20));
    };
    const first = new AbortController();
    const second = new AbortController();
    const a = coalescer.run("k", factory, first.signal);
    const b = coalescer.run("k", factory, second.signal);
    expect(calls).toBe(1);
    first.abort();
    expect(observed!.aborted).toBe(false);
    second.abort();
    expect(observed!.aborted).toBe(true);
    expect(await Promise.all([a, b])).toEqual(["done", "done"]);
    expect(coalescer.size).toBe(0);
    await coalescer.run("other", factory);
    expect(calls).toBe(2);
  });
});

describe("근거 있는 대체 문단", () => {
  it("expands abbreviations once and removes statistic parentheses while keeping the numbers", () => {
    const text = plainLanguage("eGFR이 5 mL/min 내려갔고 Hgb는 0.4 g/dL 올랐습니다(P<0.001; 95% 신뢰구간 0.2~0.6). eGFR 재측정.");
    expect(text).toContain("eGFR(콩팥 여과 기능 지표)이 5 mL/min");
    expect(text).toContain("Hgb(혈색소)는 0.4 g/dL");
    expect(text).not.toContain("P<0.001");
    expect(text.match(/eGFR\(/g)).toHaveLength(1);
  });

  it("relates each source to the situation, keeps one record per paragraph, and names the review status", () => {
    const paragraphs = groundedFallback(
      [source({ recordId: "core" }), source({ recordId: "cand", reviewed: false, findingKo: "" })],
      "신질환·투석",
      { conditionLine: "함께 먹는 약", patientContext: "68세 남성, 혈액투석 중이고 와파린을 먹어요" },
    );
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].recordIds).toEqual(["core"]);
    expect(paragraphs[0].text).toContain("신질환·투석");
    expect(paragraphs[0].text).toContain("검토한 핵심 문헌");
    expect(paragraphs[0].text).toContain("Hgb(혈색소)");
    expect(paragraphs[0].text).toContain("연구에서 쓴 양: 2000 IU");
    expect(paragraphs[0].text).toContain("대조하지 않았습니다");
    expect(paragraphs[1].text).toContain("추가 후보 문헌");
    expect(paragraphs[1].text).toContain("원문 그대로");
    for (const paragraph of paragraphs) {
      expect(paragraph.text).not.toMatch(/복용하세요|드세요|안전합니다|위험합니다/);
    }
  });

  it("explains an empty list instead of showing nothing", () => {
    const [paragraph] = groundedFallback([], "임신·수유", { conditionLine: "나이" });
    expect(paragraph.recordIds).toEqual([]);
    expect(paragraph.text).toContain("임신·수유");
    expect(paragraph.text).toContain("조건을 하나 빼고");
  });
});

describe("스트림 줄 나누기", () => {
  it("keeps a partial trailing line and skips broken ones", () => {
    const { events, rest } = splitNdjson('{"type":"interim","paragraphs":[],"reason":"generating"}\n{"type":"heartbeat","elapsedMs":8000}\nnot json\n{"type":"res');
    expect(events.map((event) => event.type)).toEqual(["interim", "heartbeat"]);
    expect(rest).toBe('{"type":"res');
  });
});
