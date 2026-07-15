import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  "src/components/personalized-safety-query.tsx",
  "utf8",
);
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
});
