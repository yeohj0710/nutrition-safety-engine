import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { refereeConsult } from "@/src/lib/consult-referee";

// 상담문 심판은 이 사이트에서 모델이 쓴 문장이 화면에 닿기 전에 통과해야 하는
// 유일한 관문이다. 규칙 파일이 decision_authority=none 으로 못 박은 권한을
// 프롬프트가 아니라 코드로 지킨다. 여기가 느슨해지면 논문 계약이 조용히 깨진다.

// 시스템이 계산한 사실 기록. 어느 문단이든 쓸 수 있는 값이다.
const sharedText = [
  "연결된 문헌은 15편입니다. 연구유형은 체계적 문헌고찰 6편, 무작위 대조시험 4편입니다.",
  "2022년부터 2025년 사이에 나왔습니다.",
].join("\n");

// 기록별 원문. 문단은 자기가 인용한 기록 안의 숫자만 쓸 수 있다.
const recordText: Record<string, string> = {
  "PMID-1": "2025 Systematic Review 엽산 800 µg 을 보고했습니다.",
  "PMID-2": "2024 Randomized Controlled Trial 철분 65 mg 을 보고했습니다.",
};

const okParagraphs = [
  { text: "임신 중 상황에서 용량 관련 표현을 조건으로 걸어 찾았습니다.", recordIds: [] },
  { text: "연결된 문헌은 15편이고 2022년부터 2025년 사이에 나왔습니다.", recordIds: [] },
  { text: "이 문헌들은 개인별 안전 상한을 정하지 않았습니다.", recordIds: [] },
  { text: "아래 문헌 목록에서 각 기록의 출처 문장을 확인하실 수 있습니다.", recordIds: [] },
];

describe("consult referee", () => {
  it("passes paragraphs that only restate the supplied evidence", () => {
    const verdict = refereeConsult({ paragraphs: okParagraphs, recordText, sharedText });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.paragraphs).toHaveLength(4);
  });

  it.each([
    ["복용을 중단하시는 편이 좋겠습니다.", "direction"],
    ["엽산을 하루 한 알 드세요.", "direction"],
    ["용량을 줄이시면 됩니다.", "direction"],
    ["이 조합은 안전합니다.", "direction"],
    ["이 조합은 위험합니다.", "direction"],
    ["철분제를 권장합니다.", "direction"],
    ["복용을 피하세요.", "direction"],
  ])("rejects clinical direction: %s", (sentence) => {
    const verdict = refereeConsult({
      paragraphs: [...okParagraphs.slice(0, 3), { text: sentence, recordIds: [] }],
      recordText, sharedText,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.rejections.some((item) => item.startsWith("direction"))).toBe(true);
    }
  });

  it("rejects numbers that the supplied evidence never mentions", () => {
    const verdict = refereeConsult({
      paragraphs: [{ text: "하루 5000 µg 까지 보고된 기록이 있습니다.", recordIds: [] }],
      recordText, sharedText,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(
        verdict.rejections.some((item) => item.startsWith("unsupported_number")),
      ).toBe(true);
    }
  });

  it("accepts a number once the paragraph cites the record that reports it", () => {
    const verdict = refereeConsult({
      paragraphs: [
        {
          text: "엽산 800 µg 을 보고한 기록이 15편 가운데 있습니다.",
          recordIds: ["PMID-1"],
        },
      ],
      recordText,
      sharedText,
    });
    expect(verdict.ok).toBe(true);
  });

  it("rejects a number that lives in a record the paragraph did not cite", () => {
    // 예전 심판은 payload 전체를 뭉쳐 봐서 이런 문장을 통과시켰다. 값이 어딘가
    // 있다는 것과 이 문장이 근거로 든 기록에 있다는 것은 다르다.
    const verdict = refereeConsult({
      paragraphs: [
        { text: "이 연구는 철분 65 mg 을 보고했습니다.", recordIds: ["PMID-1"] },
      ],
      recordText,
      sharedText,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(
        verdict.rejections.some((item) => item.startsWith("unsupported_number")),
      ).toBe(true);
    }
  });

  it("rejects a paragraph that points at everything", () => {
    // 전부를 가리키는 출처는 아무것도 가리키지 않는 것과 같다.
    const verdict = refereeConsult({
      paragraphs: [
        {
          text: "여러 연구가 보고했습니다.",
          recordIds: ["PMID-1", "PMID-2", "PMID-1", "PMID-2"],
        },
      ],
      recordText,
      sharedText,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.rejections.some((item) => item.startsWith("too_many_refs"))).toBe(
        true,
      );
    }
  });

  it("rejects a paragraph that cites a record the lookup never returned", () => {
    const verdict = refereeConsult({
      paragraphs: [{ text: "한 연구가 그렇게 보고했습니다.", recordIds: ["PMID-GHOST"] }],
      recordText,
      sharedText,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.rejections.some((item) => item.startsWith("unknown_record"))).toBe(
        true,
      );
    }
  });

  it("rejects questions because the screen has nowhere to put an answer", () => {
    const verdict = refereeConsult({
      paragraphs: [{ text: "혹시 다른 약도 함께 드시나요", recordIds: [] }],
      recordText, sharedText,
    });
    expect(verdict.ok).toBe(true);
    const withMark = refereeConsult({
      paragraphs: [{ text: "혹시 다른 약도 함께 드시나요?", recordIds: [] }],
      recordText, sharedText,
    });
    expect(withMark.ok).toBe(false);
  });

  it("rejects verdicts aimed at the reader instead of the literature", () => {
    const verdict = refereeConsult({
      paragraphs: [{ text: "당신의 경우에는 문제가 없습니다.", recordIds: [] }],
      recordText, sharedText,
    });
    expect(verdict.ok).toBe(false);
  });

  it("rejects malformed or oversized output", () => {
    expect(refereeConsult({ paragraphs: "문단", recordText, sharedText }).ok).toBe(false);
    expect(refereeConsult({ paragraphs: [], recordText, sharedText }).ok).toBe(false);
    expect(
      refereeConsult({
        paragraphs: [okParagraphs[0], okParagraphs[1], okParagraphs[2], okParagraphs[3], okParagraphs[0]],
        recordText, sharedText,
      }).ok,
    ).toBe(false);
    expect(
      refereeConsult({ paragraphs: [{ text: "가".repeat(400), recordIds: [] }], recordText, sharedText }).ok,
    ).toBe(false);
  });
});

describe("ai layer boundary", () => {
  const root = process.cwd();
  const lookupRoute = readFileSync(
    path.join(root, "app", "api", "personalized-safety", "route.ts"),
    "utf8",
  );
  const interpretRoute = readFileSync(
    path.join(root, "app", "api", "consult", "interpret", "route.ts"),
    "utf8",
  );
  const composeRoute = readFileSync(
    path.join(root, "app", "api", "consult", "compose", "route.ts"),
    "utf8",
  );

  it("keeps the evidence lookup free of any model call", () => {
    // 논문이 주장하는 "같은 입력에 같은 근거"는 이 라우트의 성질이다.
    // 모델 호출이 여기 들어오면 그 주장이 깨진다.
    expect(lookupRoute).not.toMatch(/api\.openai\.com|callLuna|ai-consult/);
  });

  it("never lets the interpreter choose evidence, only axis switches", () => {
    // 해석기는 규칙 파일이나 근거 목록을 아예 읽지 않는다.
    expect(interpretRoute).not.toMatch(/personalized_rules|core_manifest|all_evidence/);
    expect(interpretRoute).toContain("axisCoverage");
  });

  it("runs every composed paragraph through the referee", () => {
    expect(composeRoute).toContain("refereeConsult");
    expect(composeRoute).toContain("source: \"deterministic\"");
    // 심판이 걸러 낸 경우에도 화면에 보여줄 문단이 있어야 한다.
    expect(composeRoute).toContain("refereed_out");
  });

  it("falls back instead of failing when the key or model is unavailable", () => {
    expect(composeRoute).toContain("hasConsultKey");
    expect(composeRoute).toMatch(/no_key_or_evidence/);
  });

  it("sends only the situation and axis switches to the lookup", () => {
    // 자유 문장이 조회 요청에 실려 가면 "값으로 문헌을 골랐다"는 오해가 생긴다.
    // 문장은 해석 라우트까지만 가고, 조회는 켜진 축만 본다.
    const component = readFileSync(
      path.join(root, "src", "components", "personalized-safety-query.tsx"),
      "utf8",
    );
    // 조회 호출이 여러 곳에서 일어난다(조회 실행, 조건 빼기 미리보기).
    // 첫 한 곳만 보면 나중에 늘어난 호출이 검사에서 빠진다. 전부 본다.
    const calls: string[] = [];
    for (let at = 0; ; ) {
      const start = component.indexOf('fetch("/api/personalized-safety"', at);
      if (start === -1) break;
      calls.push(component.slice(start, start + 400));
      at = start + 1;
    }
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      // 자유 문장은 어느 조회 요청에도 실리지 않는다.
      expect(call).not.toMatch(/sentence|age:|medication:|dose:|condition:/);
      // 보내는 것은 상황과 축뿐이다.
      expect(call).toMatch(/situation|\.\.\.values/);
    }
    expect(component).toContain("JSON.stringify({ ...values, ...extra })");
    // 화면은 상담문의 출처를 항상 밝힌다.
    expect(component).toContain('consult.source === "ai_written" ? "AI 작성" : "자동 생성"');
  });
});
