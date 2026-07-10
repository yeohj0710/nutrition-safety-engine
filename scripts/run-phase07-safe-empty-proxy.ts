import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { runThesisEngine } from "../src/engine/run-thesis-engine";

const root = process.cwd();
const questions = ["A1", "A2", "B1", "B2", "B3"] as const;
const ingredients = ["vitamin K", "omega-3 EPA", "calcium", "vitamin D", "vitamin C"];
const medications = ["warfarin", "apixaban", "", "thiazide", ""];
const conditions = ["bleeding symptom", "atrial fibrillation", "calcium oxalate stone", "hypercalciuria", "hyperoxaluria"];

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const fileSha = (path: string) => sha(readFileSync(resolve(root, path)));

const scenarios = Array.from({ length: 120 }, (_, index) => {
  const questionIndex = index % questions.length;
  return {
    scenarioId: `SYNTH-${String(index + 1).padStart(3, "0")}`,
    questionId: questions[questionIndex],
    input: {
      profile: {
        age: index % 7 === 0 ? null : 18 + (index % 73),
        sex: index % 3 === 0 ? null : index % 2 === 0 ? "female" : "male",
        medications: medications[questionIndex] ? [medications[questionIndex]] : [],
        conditions: [conditions[questionIndex]],
        allergies: [],
        jurisdiction: "KR",
      },
      candidateItems: [{
        name: ingredients[questionIndex],
        dailyIntakeValue: index % 11 === 0 ? 0 : 100 + index,
        dailyIntakeUnit: index % 4 === 0 ? "IU" : "mg",
      }],
    },
  };
});

let deterministic = 0;
let legacyLeakage = 0;
let nonemptyOutputs = 0;
const scenarioResults = scenarios.map((scenario) => {
  const outputs = Array.from({ length: 3 }, () => runThesisEngine(scenario.input));
  const serialized = outputs.map((output) => JSON.stringify(output));
  const same = serialized.every((value) => value === serialized[0]);
  if (same) deterministic += 1;
  if (serialized.some((value) => value.includes("legacy_unverified"))) legacyLeakage += 1;
  if (outputs.some((output) => output.actions.length || output.matched_rules.length || output.evidence_claims.length)) {
    nonemptyOutputs += 1;
  }
  return {
    scenario_id: scenario.scenarioId,
    question_id: scenario.questionId,
    input_sha256: sha(JSON.stringify(scenario.input)),
    output_sha256: sha(serialized[0]),
    deterministic: same,
  };
});

const report = {
  schema_version: "1.0.0",
  status: "synthetic_safe_empty_proxy_not_independent_gold",
  clinical_performance_claim_allowed: false,
  scenario_count: scenarios.length,
  repeats_per_scenario: 3,
  executions: scenarios.length * 3,
  deterministic_scenarios: deterministic,
  legacy_leakage_scenarios: legacyLeakage,
  nonempty_output_scenarios: nonemptyOutputs,
  validated_claims: 0,
  validated_rules: 0,
  independent_gold_scenarios: 0,
  expert_reviews: 0,
  source_hashes: {
    runner: fileSha("scripts/run-phase07-safe-empty-proxy.ts"),
    engine: fileSha("src/engine/run-thesis-engine.ts"),
    thesis_bundle: fileSha("src/generated/thesis-bundle.json"),
  },
  scenarios: scenarioResults,
};

const output = resolve(root, "research/validation/safe_empty_proxy_report.json");
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: report.status,
  scenarios: report.scenario_count,
  executions: report.executions,
  deterministic: report.deterministic_scenarios,
  legacy_leakage: report.legacy_leakage_scenarios,
  nonempty_outputs: report.nonempty_output_scenarios,
}));

if (deterministic !== 120 || legacyLeakage !== 0 || nonemptyOutputs !== 0) process.exit(1);
