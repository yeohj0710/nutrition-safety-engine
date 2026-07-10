import { createHash } from "node:crypto";

import {
  THESIS_SCOPE,
  thesisEngineResponseSchema,
  thesisQuerySchema,
  type ThesisEngineResponse,
  type ThesisQuery,
} from "@/src/domain/thesis";
import { loadThesisBundle } from "@/src/evidence/load-thesis-bundle";

function sortStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right, "en"),
  );
}

function normalizeInput(query: ThesisQuery): Record<string, unknown> {
  const profile = query.profile;
  const candidateItems = query.candidateItems
    .map((item) => ({
      name: item.name.trim(),
      ingredient_id: item.ingredientId ?? null,
      form: item.form ?? null,
      daily_intake_value: item.dailyIntakeValue ?? null,
      daily_intake_unit: item.dailyIntakeUnit ?? null,
    }))
    .sort((left, right) =>
      `${left.name}\u0000${left.form ?? ""}`.localeCompare(
        `${right.name}\u0000${right.form ?? ""}`,
        "en",
      ),
    );

  return {
    profile: {
      age: profile.age ?? null,
      sex: profile.sex ?? null,
      pregnancy_status: profile.pregnancyStatus ?? null,
      lactation_status: profile.lactationStatus ?? null,
      smoker_status: profile.smokerStatus ?? null,
      medications: sortStrings(profile.medications),
      conditions: sortStrings(profile.conditions),
      allergies: sortStrings(profile.allergies),
      jurisdiction: profile.jurisdiction,
    },
    candidate_items: candidateItems,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function runThesisEngine(input: unknown): ThesisEngineResponse {
  const query = thesisQuerySchema.parse(input);
  const bundle = loadThesisBundle();
  const normalizedInput = normalizeInput(query);
  const digest = createHash("sha256")
    .update(`${bundle.meta.bundleVersion}\n${stableJson(normalizedInput)}`)
    .digest("hex")
    .slice(0, 24);

  if (bundle.rules.length > 0) {
    throw new Error(
      "Validated rules exist but the Phase 07 matcher has not been released.",
    );
  }

  return thesisEngineResponseSchema.parse({
    request_id: `req_${digest}`,
    bundle_version: bundle.meta.bundleVersion,
    engine_commit: bundle.meta.engineCommit,
    normalized_input: normalizedInput,
    actions: [],
    missing_information: [],
    matched_rules: [],
    evidence_claims: [],
    limitations: [
      "검증 완료된 근거 주장과 규칙이 아직 없어 개인별 판단을 제공하지 않습니다.",
      "현재 응답은 Phase 01 격리 상태를 보여 주며 의료적 판단이나 복약 지시가 아닙니다.",
    ],
    scope: THESIS_SCOPE,
  });
}
