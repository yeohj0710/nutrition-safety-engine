import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import rules from "@/research/systematic_review_v40/personalized_rules.json";
import {
  axes,
  evidenceOnlyDisclaimer,
  situationIds,
  situations,
} from "@/src/lib/clinical-situations";
import { publicInputExamples } from "@/src/lib/personalized-safety-examples";

const root = process.cwd();
const componentSource = readFileSync(
  path.join(root, "src", "components", "personalized-safety-query.tsx"),
  "utf8",
);
const pageSource = readFileSync(path.join(root, "app", "page.tsx"), "utf8");
const notFoundSource = readFileSync(
  path.join(root, "app", "not-found.tsx"),
  "utf8",
);
const globalCss = readFileSync(path.join(root, "app", "globals.css"), "utf8");
const errorSource = readFileSync(path.join(root, "app", "error.tsx"), "utf8");
const globalErrorSource = readFileSync(
  path.join(root, "app", "global-error.tsx"),
  "utf8",
);
const loadingSource = readFileSync(
  path.join(root, "app", "loading.tsx"),
  "utf8",
);
const infoTipSource = readFileSync(
  path.join(root, "src", "components", "info-tip.tsx"),
  "utf8",
);

type Rule = { question_id: string; personalization_axis: string };
const allRules = rules as unknown as Rule[];

describe("personalized safety UI contract", () => {
  it("offers exactly the five situations the research covers", () => {
    expect(situations).toHaveLength(5);
    for (const situation of situations) {
      expect(situation.label, situation.id).toMatch(/[가-힣]/);
      expect(situation.question, situation.id).toMatch(/[가-힣]/);
    }
  });

  it("never tells the reader what to take", () => {
    // 이 사이트는 근거를 연결해 보여줄 뿐 복용을 지시하지 않는다.
    // 규칙 파일이 decision_authority=none 으로 못 박고 있으므로 화면도 같아야 한다.
    expect(componentSource).not.toMatch(
      /복용을 (?:중단|시작)하|용량을 (?:줄|늘)이|드시지 마세요|끊으세요|안전합니다|위험합니다/,
    );
  });

  it("always renders the evidence-only disclaimer", () => {
    expect(componentSource).toContain("evidenceOnlyDisclaimer");
    expect(evidenceOnlyDisclaimer).toMatch(/지시하지 않으며/);
    expect(evidenceOnlyDisclaimer).toMatch(/진료를 대신하지 않습니다/);
  });

  it("links every paper out to its source instead of only quoting it", () => {
    expect(componentSource).toContain('target="_blank"');
    expect(componentSource).toContain("item.url");
    expect(componentSource).toContain("locator");
  });

  it("uses only axis fields that exist in the rules data", () => {
    for (const axis of axes) {
      const situationsWithAxis = situationIds.filter((situation) =>
        allRules.some(
          (rule) =>
            rule.question_id === situation &&
            rule.personalization_axis === axis.id,
        ),
      );
      expect(situationsWithAxis.length, axis.id).toBeGreaterThan(0);
    }
  });

  it("keeps every example pointed at a real situation", () => {
    for (const example of publicInputExamples) {
      expect(situationIds, example.id).toContain(example.input.situation);
    }
    // 다섯 상황을 예시가 모두 덮어야 한 화면에서 전체를 둘러볼 수 있다.
    const covered = new Set(
      publicInputExamples.map((example) => example.input.situation),
    );
    expect([...covered].sort()).toEqual([...situationIds].sort());
  });

  it("keeps the numbered citation structure in the result view", () => {
    // 문헌별 결과 번호와 아래 상세 출처의 번호가 짝을 이뤄야 번호를 눌렀을 때
    // 실제로 그 결과를 보고한 문헌으로 이동한다.
    expect(componentSource).toContain("EvidenceFinding");
    expect(componentSource).toContain("#result-ref-");
    expect(componentSource).toContain("id={`result-ref-${number}`}");
    expect(componentSource).toContain("scroll-mt-24");
    expect(componentSource).toContain("splitEvidenceSentences");
    expect(componentSource).toContain("sentenceIndex");
    expect(componentSource).toContain("min-h-11");
  });

  it("uses native radios and checkboxes for metadata filtering", () => {
    expect(componentSource).toContain('type="radio"');
    expect(componentSource).toContain('type="checkbox"');
    expect(componentSource).toContain('name="situation"');
    expect(componentSource).toContain('name="evidence-axis"');
    expect(componentSource).toContain("값 자체를 대조하지 않습니다");
    expect(componentSource).not.toContain("placeholder={axis.placeholder}");
    expect(componentSource).toContain("firstSituationRef");
    expect(componentSource).toContain("disabled={!form.situation || unavailable}");
    expect(componentSource).toContain("sticky bottom-3");
  });

  it("labels AI extraction, AI translation, source scope, and unique titles", () => {
    expect(componentSource).toContain("AI 자동 추출");
    expect(componentSource).toContain("AI 자동 번역");
    expect(componentSource).toContain("제목 기준 고유 문헌");
    expect(componentSource).toContain("source_scope");
    expect(componentSource).not.toContain("문헌별 핵심 결과");
  });

  it("cancels stale requests and keeps a submitted query snapshot", () => {
    expect(componentSource).toContain("AbortController");
    expect(componentSource).toContain("query_snapshot");
    expect(componentSource).toContain("요청 당시 조건");
    expect(componentSource).toContain("prefers-reduced-motion");
  });

  it("uses a 4px spacing scale, aligned shell, and 48px controls", () => {
    expect(globalCss).toContain("--space-1: 0.25rem");
    expect(globalCss).toContain("--space-2: 0.5rem");
    expect(globalCss).toContain("--page-shell-max: 54rem");
    expect(globalCss).toContain("--measure-readable: 54ch");
    expect(componentSource).toContain("min-h-12");
  });

  it("labels core, filtered, and expanded counts by their actual scope", () => {
    expect(componentSource).toContain("result.expanded");
    expect(componentSource).toContain('result.filter_mode === "metadata_axis_presence"');
    expect(componentSource).toContain("핵심 근거");
    expect(componentSource).toContain("표현 필터 뒤");
    expect(componentSource).toContain("확장 근거 전체");
    expect(componentSource).toContain("title_derived_records");
  });

  it("says the axis filter also applies beyond the core in expanded mode", () => {
    // 확장 보기에도 축 색인이 있으므로 "적용하지 않았습니다" 문구가 남아 있으면 안 된다.
    expect(componentSource).not.toContain("표현 필터를 적용하지 않았습니다");
    expect(componentSource).toContain("확장 목록에도 같은 표현 필터를 걸었습니다");
    expect(componentSource).toContain("extended_pool_total");
    // 값 대조를 하지 않는다는 단서는 확장 보기에서도 유지한다.
    expect(componentSource).toContain("실제 값과 논문 내용을 대조하지는 않습니다");
  });

  it("recovers a zero result from the submitted query snapshot", () => {
    expect(componentSource).toContain("result.query_snapshot.requested_axes.slice");
    expect(componentSource).not.toContain("form.axes.slice(0, -1)");
  });

  it("keeps help and citation targets at least 44px and overlays unclipped", () => {
    expect(componentSource).toContain("min-h-11");
    expect(infoTipSource).toContain("min-h-11");
    expect(infoTipSource).toContain("min-w-11");
    expect(infoTipSource).toContain("fixed inset-x-4 bottom-4");
    expect(infoTipSource).toContain("max-h-[calc(100dvh-2rem)]");
    // 이 테스트 이름이 "unclipped" 인데 정작 잘리는 경로를 못 잡고 있었다.
    // sm 이상에서 팁의 오른쪽 끝에 288px 말풍선을 붙이던 시절, 팁이 왼쪽에서
    // 304px 안쪽이면 화면 밖으로 나갔다(768px 에서 -19px·-56px 실측, 640~1090px
    // 구간 전체). 팁마다 필요한 방향이 반대라 정적인 정렬로는 못 고친다.
    // 화면 기준으로 두는 한 팁 위치와 무관하게 안 잘린다.
    expect(infoTipSource).not.toMatch(/sm:(absolute|right-0|left-0|top-7|inset-x-auto)/);
    expect(infoTipSource).toContain("mx-auto");
    expect(infoTipSource).toContain("max-w-sm");
    expect(globalCss).toContain(".animated-details");
    expect(globalCss).toContain("overflow: visible");
    expect(globalCss).not.toContain(
      "animation: rise-in var(--duration-expand) var(--ease-emphasized) both",
    );
  });

  it("does not link the not-found screen to a missing source route", () => {
    expect(notFoundSource).not.toContain('href="/sources"');
    expect(notFoundSource).not.toContain("출처 브라우저");
  });

  it("puts the honest lookup purpose before research statistics", () => {
    // 통계 숫자를 먼저 읽으면 이 화면이 무엇을 하는 도구인지 오해한다.
    // 어떤 배치를 쓰든 한계 문장이 숫자보다 위에 있어야 한다.
    expect(pageSource.indexOf("입력값과 논문 내용을 대조하는 도구가 아닙니다")).toBeLessThan(
      pageSource.indexOf("stats.map"),
    );
    expect(pageSource).toContain("<PersonalizedSafetyQuery />");
  });

  it("gives loading and error states a usable accessibility contract", () => {
    expect(loadingSource).toContain('role="status"');
    expect(loadingSource).not.toContain("min-h-screen");
    expect(errorSource).not.toContain("선택한 조건은 화면에 그대로 남아 있습니다");
    expect(errorSource).not.toContain("min-h-screen");
    expect(globalErrorSource).toContain('role="alert"');
    expect(globalErrorSource).toContain("headingRef.current?.focus()");
  });

  it("uses one live region and announces expanded pagination ranges", () => {
    expect(componentSource.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(componentSource).toContain("expanded_offset + 1");
    expect(componentSource).toContain("번째 기록을 표시했습니다");
    expect(componentSource).toMatch(
      /pending\s*\?\s*"문헌 결과를 불러오는 중입니다\."\s*:\s*error\s*\?\s*error\s*:\s*result/,
    );
  });

  it("binds each summarized finding to exactly one numbered paper", () => {
    // 한 문헌의 결과 문장 뒤에 현재 목록의 번호를 전부 붙이면 15편이 같은 결과를
    // 보고한 것처럼 읽힌다. 요약 영역도 문헌별 항목과 그 문헌 번호를 일대일로 묶는다.
    expect(componentSource).toContain("function EvidenceFinding");
    expect(componentSource).toContain("flattenTranslatedFindings");
    expect(componentSource).toContain("number={finding.paperNumber}");
    expect(componentSource).toContain("sentence={finding.sentence}");
    expect(componentSource).not.toContain(
      "<CitationMarks items={result.evidence}",
    );
    expect(componentSource).not.toContain(
      "<EvidenceSentence\n                          items={result.evidence}",
    );
  });

  it("shows a short result summary before the full paper list", () => {
    // 첫 화면에 핵심 문헌 15편을 전부 펼치면 요약과 상세 목록이 중복된다.
    // 문헌 수가 아니라 문장 수를 먼저 평탄화한 뒤 정확히 세 문장만 펼친다.
    expect(componentSource).toContain("const SUMMARY_SENTENCE_LIMIT = 3");
    expect(componentSource).toMatch(
      /findingSentences\s*\.slice\(0, SUMMARY_SENTENCE_LIMIT\)/,
    );
    expect(componentSource).not.toMatch(
      /result\.evidence\s*\.slice\(0, SUMMARY_SENTENCE_LIMIT\)/,
    );
    expect(componentSource).toContain("나머지");
    expect(componentSource).toContain("자동 추출 문장 보기");
    expect(componentSource).toContain('id="evidence-query-form"');
    expect(componentSource).toContain('id="evidence-list"');
    expect(componentSource).toContain('href="#evidence-list"');
    expect(componentSource).toContain('href="#evidence-query-form"');
  });

  it("does not describe an unfiltered expanded request as an ignored filter", () => {
    expect(componentSource).toContain(
      "result.query_snapshot.requested_axes.length",
    );
    expect(componentSource).toContain("이 상황의 전체 후보 기록입니다");
  });

  it("focuses updated result headings without moving pagination scroll", () => {
    expect(componentSource).toContain("focus({ preventScroll: true })");
    expect(componentSource).toContain("{ scroll: false }");
  });

  it("never ships a bare validated / gold-standard claim", () => {
    // AGENTS.md 명명 규칙: 사람 참조표준이 0건이므로 배포되는 산출물에 맨
    // validated·gold_standard·accuracy·민감도를 쓰지 않는다. 비교 상대를 이름에
    // 넣은 형태(_vs_ai_reference)만 허용한다. 예전에 <main> 의
    // data-scope 가 "validated_thesis_scope" 로 배포돼 있었다.
    const shipped = [
      path.join(root, "app", "page.tsx"),
      path.join(root, "app", "api", "personalized-safety", "route.ts"),
      path.join(root, "src", "lib", "clinical-situations.ts"),
      path.join(root, "src", "components", "personalized-safety-query.tsx"),
    ].map((file) => [file, readFileSync(file, "utf8")] as const);

    for (const [file, source] of shipped) {
      const stripped = source.replace(/_vs_ai_reference/g, "");
      expect(stripped, file).not.toMatch(
        /validated|gold_standard|민감도|특이도/,
      );
    }
  });
});
