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
