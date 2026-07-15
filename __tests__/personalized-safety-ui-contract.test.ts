import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  "src/components/personalized-safety-query.tsx",
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

  it("rotates only the chevron owned by an open disclosure", () => {
    expect(styles).toContain(
      "details[open] > summary .collapsible-chevron",
    );
    expect(styles).not.toContain("details[open] .collapsible-chevron");
  });

  it("shows a Korean interpretation and the source sentence for each evidence item", () => {
    expect(component).not.toContain("초록 핵심 문장");
    expect(component).toContain("x.key_finding_ko");
    expect(component).toContain("item.key_finding_ko");
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
      "복용량과 함께 먹는 약, 결석·신장 병력, 검사 결과를 문헌에 보고된 용량과 상호작용 결과와 비교합니다.",
    );
    expect(component).toContain(
      "제품 라벨에 적힌 숫자와 단위를 그대로 적습니다.",
    );
    expect(component).toContain("근거 문헌을 확인하고 있습니다");
    expect(component).toContain("판단 기준과 추가 확인 사항");
    expect(component).toContain("결과에 사용한 문헌");
    expect(component).toContain("검색된 후보 문헌");
  });
});
