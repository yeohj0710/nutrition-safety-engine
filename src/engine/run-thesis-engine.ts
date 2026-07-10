import { createHash } from "node:crypto";

import { THESIS_SCOPE, thesisEngineResponseSchema, thesisQuerySchema,
  thesisRuleConditionsSchema, type ThesisBundle, type ThesisEngineResponse,
  type ThesisQuery } from "@/src/domain/thesis";
import { loadThesisBundle } from "@/src/evidence/load-thesis-bundle";

function sortStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en"));
}

function normalizeInput(query: ThesisQuery): Record<string, unknown> {
  return {
    profile: { age: query.profile.age ?? null, sex: query.profile.sex ?? null,
      pregnancy_status: query.profile.pregnancyStatus ?? null,
      lactation_status: query.profile.lactationStatus ?? null,
      smoker_status: query.profile.smokerStatus ?? null,
      medications: sortStrings(query.profile.medications), conditions: sortStrings(query.profile.conditions),
      allergies: sortStrings(query.profile.allergies), jurisdiction: query.profile.jurisdiction },
    candidate_items: query.candidateItems.map((item) => ({ name: item.name.trim(),
      ingredient_id: item.ingredientId ?? null, form: item.form ?? null,
      daily_intake_value: item.dailyIntakeValue ?? null, daily_intake_unit: item.dailyIntakeUnit ?? null }))
      .sort((a, b) => `${a.name}\0${a.form ?? ""}`.localeCompare(`${b.name}\0${b.form ?? ""}`, "en")),
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const priority: Record<string, number> = { urgent_referral: 0, avoid_until_review: 1,
  pharmacist_review: 2, monitor_or_consistency: 3, information_only: 4, insufficient_evidence: 5 };
const norm = (value: string) => value.trim().toLocaleLowerCase("en-US");

export function runThesisEngineWithBundle(input: unknown, bundle: ThesisBundle): ThesisEngineResponse {
  const query = thesisQuerySchema.parse(input);
  const normalizedInput = normalizeInput(query);
  const digest = createHash("sha256").update(`${bundle.meta.bundleVersion}\n${stableJson(normalizedInput)}`).digest("hex").slice(0, 24);
  const names = new Set(query.candidateItems.map((item) => norm(item.name)));
  const medications = new Set(query.profile.medications.map(norm));
  const conditions = new Set(query.profile.conditions.map(norm));
  const jurisdiction = norm(query.profile.jurisdiction);
  const claimsById = new Map(bundle.claims.map((claim) => [String(claim.claim_id), claim]));
  const matches = bundle.rules.filter((rule) => {
    const c = thesisRuleConditionsSchema.parse(rule.conditions);
    if (c.candidate_item_names_any && !c.candidate_item_names_any.some((v) => names.has(norm(v)))) return false;
    if (c.medications_any && !c.medications_any.some((v) => medications.has(norm(v)))) return false;
    if (c.conditions_any && !c.conditions_any.some((v) => conditions.has(norm(v)))) return false;
    if (c.jurisdictions_any && !c.jurisdictions_any.some((v) => jurisdiction === norm(v))) return false;
    if (c.min_age !== undefined && (query.profile.age == null || query.profile.age < c.min_age)) return false;
    if (c.max_age !== undefined && (query.profile.age == null || query.profile.age > c.max_age)) return false;
    return true;
  }).sort((a, b) => (priority[String(a.action_class)] ?? 99) - (priority[String(b.action_class)] ?? 99)
    || String(a.rule_id).localeCompare(String(b.rule_id), "en"));
  const claimIds = [...new Set(matches.flatMap((rule) => Array.isArray(rule.claim_ids) ? rule.claim_ids.map(String) : []))].sort();
  const evidenceClaims = claimIds.map((id) => claimsById.get(id)).filter((claim) => claim !== undefined);
  return thesisEngineResponseSchema.parse({ request_id: `req_${digest}`,
    bundle_version: bundle.meta.bundleVersion, engine_commit: bundle.meta.engineCommit,
    normalized_input: normalizedInput,
    actions: matches.map((rule) => ({ rule_id: rule.rule_id, action_class: rule.action_class,
      severity: rule.severity ?? null, message: rule.message_template, claim_ids: rule.claim_ids })),
    missing_information: [],
    matched_rules: matches.map((rule) => ({ rule_id: rule.rule_id, question_id: rule.question_id,
      action_class: rule.action_class, claim_ids: rule.claim_ids })),
    evidence_claims: evidenceClaims,
    limitations: matches.length ? [] : ["검증 완료된 근거 주장과 규칙이 아직 없어 개인별 판단을 제공하지 않습니다."],
    scope: THESIS_SCOPE });
}

export function runThesisEngine(input: unknown): ThesisEngineResponse {
  return runThesisEngineWithBundle(input, loadThesisBundle());
}
