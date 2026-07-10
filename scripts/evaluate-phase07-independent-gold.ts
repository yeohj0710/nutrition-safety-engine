import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runThesisEngine } from "../src/engine/run-thesis-engine";
import { scoreActions, wilson, type ActionKey } from "../src/validation/score-engine-gold";

const root = process.cwd();
const inputPath = path.join(root, "data/curated/independent_gold_scenarios.jsonl");
const outputPath = path.join(root, "research/validation/independent_gold_performance.json");
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const lines = readFileSync(inputPath, "utf8").split(/\r?\n/).filter(Boolean);
const rows = lines.map((line) => JSON.parse(line) as { gold_scenario_id: string; question_id: string;
  thesis_bundle_sha256: string; input: unknown; expected_actions: ActionKey[]; critical_rule_ids: string[] });
const bundleSha = sha(readFileSync(path.join(root, "src/generated/thesis-bundle.json")));
const sourceHashes = { evaluator: sha(readFileSync(path.join(root, "scripts/evaluate-phase07-independent-gold.ts"))),
  engine: sha(readFileSync(path.join(root, "src/engine/run-thesis-engine.ts"))),
  gold: sha(readFileSync(inputPath)), thesis_bundle: bundleSha };

if (rows.length !== 120) {
  const blocked = { status: "blocked_external_incomplete_independent_gold", gold_scenarios: rows.length,
    required_gold_scenarios: 120, metrics: null, thesis_bundle_sha256: bundleSha, source_hashes: sourceHashes };
  writeFileSync(outputPath, `${JSON.stringify(blocked, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(blocked));
  process.exit(0);
}
if (new Set(rows.map((row) => row.gold_scenario_id)).size !== 120 || rows.some((row) => row.thesis_bundle_sha256 !== bundleSha)) {
  throw new Error("independent gold IDs or thesis bundle hash mismatch");
}

let tp = 0, fp = 0, fn = 0, exact = 0, deterministic = 0;
const criticalFailures: { gold_scenario_id: string; rule_id: string }[] = [];
const details = rows.map((row) => {
  const outputs = Array.from({ length: 3 }, () => runThesisEngine(row.input));
  const serialized = outputs.map((value) => JSON.stringify(value));
  const stable = serialized.every((value) => value === serialized[0]);
  if (stable) deterministic += 1;
  const actual = outputs[0].actions.map((item) => ({ rule_id: String(item.rule_id), action_class: String(item.action_class) }));
  const score = scoreActions(row.expected_actions, actual);
  tp += score.tp; fp += score.fp; fn += score.fn; exact += Number(score.exact);
  const actualRules = new Set(actual.map((item) => item.rule_id));
  row.critical_rule_ids.filter((ruleId) => !actualRules.has(ruleId)).forEach((rule_id) => criticalFailures.push({ gold_scenario_id: row.gold_scenario_id, rule_id }));
  return { gold_scenario_id: row.gold_scenario_id, question_id: row.question_id, deterministic: stable,
    expected_actions: row.expected_actions.length, actual_actions: actual.length, tp: score.tp, fp: score.fp, fn: score.fn,
    exact: score.exact, output_sha256: sha(serialized[0]) };
});
const precisionN = tp + fp, recallN = tp + fn;
const report = { status: criticalFailures.length ? "failed_critical_false_negative_release_prohibited" : "complete_candidate_requires_expert_release_review",
  gold_scenarios: rows.length, repeats_per_scenario: 3, thesis_bundle_sha256: bundleSha,
  source_hashes: sourceHashes,
  metrics: { sensitivity: { n: tp, N: recallN, rate: recallN ? tp / recallN : null, wilson95: wilson(tp, recallN) },
    precision: { n: tp, N: precisionN, rate: precisionN ? tp / precisionN : null, wilson95: wilson(tp, precisionN) },
    exact_match: { n: exact, N: rows.length, rate: exact / rows.length, wilson95: wilson(exact, rows.length) },
    determinism: { n: deterministic, N: rows.length, rate: deterministic / rows.length },
    critical_false_negative_count: criticalFailures.length }, critical_failures: criticalFailures, scenarios: details };
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: report.status, gold: rows.length, sensitivity: report.metrics.sensitivity.rate,
  precision: report.metrics.precision.rate, exact: report.metrics.exact_match.rate, critical_fn: criticalFailures.length }));
