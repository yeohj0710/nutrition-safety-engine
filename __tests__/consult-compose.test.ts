import { describe, expect, it } from "vitest";
import {
  COMPOSE_ABSTRACT_CHARS,
  COMPOSE_MAX_SOURCES,
  COMPOSE_ROLES,
  COMPOSE_SHARED_DEVELOPER,
  InflightCoalescer,
  buildComposeUser,
  buildRoleDeveloper,
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

describe("문단별 지시문", () => {
  it("shares one prefix across roles and names only this paragraph's job", () => {
    const developers = COMPOSE_ROLES.map((role) => buildRoleDeveloper(role));
    for (const developer of developers) {
      expect(developer.startsWith(COMPOSE_SHARED_DEVELOPER)).toBe(true);
      expect(developer).toContain("문단 하나만 쓴다");
    }
    expect(new Set(developers).size).toBe(COMPOSE_ROLES.length);
    // 문단마다 자기 일만 받고, 다른 문단이 맡은 것은 되풀이하지 말라고 적는다.
    const [first] = developers;
    expect(first).toContain(COMPOSE_ROLES[0].taskKo);
    expect(first).not.toContain(COMPOSE_ROLES[1].taskKo);
    expect(first).toContain(COMPOSE_ROLES[1].labelKo);
    expect(first).toContain("1번째");
  });

  it("keeps three roles so one slow paragraph does not hold the other two", () => {
    expect(COMPOSE_ROLES).toHaveLength(3);
    expect(COMPOSE_ROLES.map((role) => role.id)).toEqual(["situation", "study", "gap"]);
    for (const role of COMPOSE_ROLES) expect(role.labelKo).toMatch(/[가-힣]/);
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
    // dose 는 초록에서 모은 "숫자 + 단위" 목록이라 연구가 준 용량이 아닐 수 있다.
    // 그렇게 밝히지 않고 "연구에서 쓴 양" 이라고 적으면 없는 사실을 만든다.
    expect(paragraphs[0].text).toContain("초록에 나온 양 표기는 2000 IU daily입니다");
    expect(paragraphs[0].text).toContain("연구가 준 용량인지는 초록만으로 확인하지 못했습니다");
    expect(paragraphs[0].text).toContain("초록이 밝힌 대상: 599 iron-replete chronic hemodialysis patients");
    expect(paragraphs[0].text).toContain("대조하지 않았습니다");
    expect(paragraphs[1].text).toContain("추가 후보 문헌");
    expect(paragraphs[1].text).toContain("원문 그대로");
    for (const paragraph of paragraphs) {
      expect(paragraph.text).not.toMatch(/복용하세요|드세요|안전합니다|위험합니다/);
    }
  });

  it("strips abstract section labels and the pipe joiner from what it quotes", () => {
    // 저장한 필드는 초록에서 뽑아 온 것이라 "RESULTS:" 같은 절 이름과 " | " 이음쇠가
    // 그대로 들어 있다. 화면에 그대로 내보내면 사람이 읽는 글이 아니게 된다.
    const [paragraph] = groundedFallback(
      [
        source({
          recordId: "raw",
          findingKo: "",
          finding: "RESULTS: Serum phosphate fell. | CONCLUSIONS: The two arms were similar.",
          population: "BACKGROUND: Hyperphosphatemia is common. | METHODS: We enrolled 217 adults on hemodialysis.",
          dose: "0.59 mmol | 0.56 mmol | 1.5 mmol | 2 mmol",
        }),
      ],
      "신질환·투석",
    );
    expect(paragraph.text).not.toContain("RESULTS:");
    expect(paragraph.text).not.toContain("BACKGROUND:");
    expect(paragraph.text).not.toContain(" | ");
    expect(paragraph.text).toContain("Serum phosphate fell. The two arms were similar.");
    expect(paragraph.text).toContain("We enrolled 217 adults on hemodialysis");
    // 양 표기가 길면 앞의 셋만 보이고 나머지는 개수로 접는다.
    expect(paragraph.text).toContain("0.59 mmol, 0.56 mmol, 1.5 mmol 외 1개");
  });

  it("drops Korean section labels and percentages that are not a dose", () => {
    const [paragraph] = groundedFallback(
      [source({ recordId: "ko", findingKo: "결론: 프리바이오틱은 간효소에 영향을 주지 않았다.", dose: "95% | 99%", population: "" })],
      "간질환·간독성",
    );
    expect(paragraph.text).not.toContain("결론:");
    expect(paragraph.text).toContain("프리바이오틱은 간효소에 영향을 주지 않았다");
    expect(paragraph.text).not.toContain("양 표기");
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

  it("reads a finished paragraph line with its slot number", () => {
    const { events } = splitNdjson('{"type":"partial","index":1,"paragraph":{"text":"t","recordIds":["a"]},"source":"ai_written","elapsedMs":21000}\n');
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event.type).toBe("partial");
    if (event.type === "partial") {
      expect(event.index).toBe(1);
      expect(event.paragraph.recordIds).toEqual(["a"]);
    }
  });
});
