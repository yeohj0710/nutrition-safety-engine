import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  "src/components/personalized-safety-query.tsx",
  "utf8",
);
const animatedDetails = readFileSync(
  "src/components/animated-details.tsx",
  "utf8",
);
const page = readFileSync("app/page.tsx", "utf8");
const frame = readFileSync("src/components/site-frame.tsx", "utf8");
const styles = readFileSync("app/globals.css", "utf8");

describe("personalized safety UI contract", () => {
  it("keeps the research form concise", () => {
    for (const removedCopy of [
      "아는 내용만 골라도 충분해요",
      "예시를 고르면 결과가 바로 나옵니다",
      "제품 이름부터",
      "모르면 그대로",
      "결론부터 확인",
      "제품 앞면에 적힌 이름과 같은 것을 고르면 됩니다",
      "아는 것만 고르면 됩니다",
    ]) {
      expect(component).not.toContain(removedCopy);
    }
  });

  it("groups fifteen public examples by supplement", () => {
    expect(component).toContain("personalizedSafetyExamples");
    expect(component).toContain("examplesByIngredient");
    expect(component).not.toContain("const examples = [");
  });

  it("uses one page surface instead of nested form and example cards", () => {
    expect(component).toContain(
      'className="mt-7 border-t border-stone-200 pt-7"',
    );
    expect(component).not.toContain(
      'className="mt-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8"',
    );
    expect(component).toContain("sm:grid-cols-[5.5rem_minmax(0,1fr)]");
    expect(component).not.toContain(
      'className="rounded-xl border border-stone-200 bg-white p-3 text-left',
    );
  });

  it("gives every free-text input an accessible name", () => {
    for (const name of [
      "제품 라벨의 하루 섭취량",
      "함께 먹는 약 이름",
      "병력 또는 현재 증상",
      "최근 검사 결과",
    ]) {
      expect(component).toContain(`aria-label="${name}"`);
    }
  });

  it("explains AI interpretation without presenting it as the safety rule", () => {
    expect(component).toContain("자유 입력을 구조화하는 AI");
    expect(component).toContain("정해진 형식이나 순서 없이 적어도 돼요.");
    expect(component).toContain("AI 해석 엔진이 약");
    expect(component).toContain("검사 수치를 자동으로 구조화하고");
    expect(component).toContain("검증된");
    expect(component).toMatch(/기준과 근거 문헌에\s+연결해/);
    expect(component).toMatch(/문헌에\s+연결해 안전성 결과를 정리해요\./);
    expect(component).toContain("AI 해석 적용");
    expect(component).toContain("result.input_interpretation.ai_used");
  });

  it("renders the AI-written narrative instead of inserting raw fields into templates", () => {
    expect(component).toContain("result.narrative_assessment.conclusion");
    expect(component).toContain("result.narrative_assessment.context");
    expect(component).toContain("result.narrative_assessment.explanation");
    expect(component).toContain("result.narrative_assessment.next");
    expect(component).not.toContain("{result.assessment.context}</p>");
  });

  it("shows lab results as the fifth optional field instead of a nested card", () => {
    expect(component).toContain("5. 최근 검사 결과");
    expect(component).toContain("<textarea");
    expect(component).toContain("단위가 빠지거나 표현이");
    expect(component).not.toContain(
      '<details className="rounded-2xl border border-stone-200 bg-stone-50/70">',
    );
  });

  it("allows multiple medicine and condition choices", () => {
    expect(component).toContain("toggleMultiValue");
    expect(component).toContain("hasMultiValue");
    expect(component).toContain("aria-pressed");
    expect(component).toContain("여러 개를 고를 수 있어요.");
    expect(component).toContain("리바록사반");
    expect(component).toContain("돌루테그라비르");
    expect(component).toContain("검은변 또는 혈변");
    expect(component).toContain("철 과다증");
  });

  it("animates both directions without rotating nested chevrons", () => {
    expect(styles).toContain(
      '.animated-details[data-open="true"] > summary .collapsible-chevron',
    );
    expect(styles).not.toContain("details[open]");
    expect(animatedDetails).toContain("forwardRef<");
    expect(animatedDetails).toContain("aria-expanded={expanded}");
    expect(animatedDetails).toContain("summaryRef.current?.focus()");
    expect(component).toContain("examplesRef.current?.close()");
    expect(styles).toContain(".motion-enter");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("shows a Korean interpretation and the source sentence for each evidence item", () => {
    expect(component).not.toContain("초록 핵심 문장");
    expect(component).toContain("toHaeyoStyle(x.key_finding_ko)");
    expect(component).toContain("toHaeyoStyle(item.key_finding_ko)");
    expect(component).toContain("toHaeyoStyle(x.selection_reason)");
    expect(component).toContain("toHaeyoStyle(item.selection_reason)");
    expect(component).toContain("x.key_finding");
    expect(component).toContain("item.key_finding");
  });

  it("separates evidence popovers from the sentence without breaking the hover bridge", () => {
    expect(component).toContain("bottom-[calc(100%+0.375rem)]");
    expect(component).toContain("after:h-2");
  });

  it("uses a calm blue text-selection color", () => {
    const selectionRule = styles.match(/::selection\s*\{[^}]+\}/)?.[0] ?? "";
    expect(selectionRule).toContain("#dbeafe");
    expect(selectionRule).not.toContain("var(--accent-soft)");
  });

  it("uses concrete public copy instead of internal process language", () => {
    for (const removedCopy of [
      "근거 문헌의 확인 항목과 연결합니다",
      "입력 정보와 근거 문헌을 대조하고 있습니다",
      "입력 내용 확인",
      "근거 문헌 연결",
      "확인할 내용과 다음 단계",
      "핵심 근거와 전체 후보 보기",
      "논문 연구 시스템",
    ]) {
      expect(`${page}\n${component}\n${frame}`).not.toContain(removedCopy);
    }

    expect(page).toContain(
      "복용량과 함께 먹는 약, 결석·신장 병력, 검사 결과를 문헌에 보고된 용량과 상호작용 결과와 비교해요.",
    );
    expect(component).toContain(
      "라벨 문구를 그대로 적으세요. 숫자와 단위를 정리해",
    );
    expect(component).toContain("입력 내용을 해석하고 있어요");
    expect(component).toContain("판단 기준과 추가 확인 사항");
    expect(component).toContain("결과에 사용한 문헌");
    expect(component).toContain("검색된 후보 문헌");
  });
});
