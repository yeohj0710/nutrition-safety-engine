#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "..");
const queryRoot = path.join(repo, "research", "searches", "search_strategy_drafts");
const outputPath = path.join(repo, "research", "searches", "pubmed_pilot_20260710.json");
const questions = ["A1", "A2", "B1", "B2", "B3"];
const sentinelCsv = await readFile(
  path.join(repo, "research", "searches", "sentinel_set.csv"),
  "utf8",
);

const sentinelByQuestion = Object.fromEntries(questions.map((question) => [question, []]));
for (const line of sentinelCsv.trim().split(/\r?\n/).slice(1)) {
  const [questionId, pmid] = line.split(",", 2);
  if (sentinelByQuestion[questionId]) sentinelByQuestion[questionId].push(pmid);
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function esearch(term) {
  const url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  url.search = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    retmax: "0",
    tool: "nutrition_safety_thesis_reboot",
    term,
  }).toString();
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`PubMed ESearch failed: ${response.status} ${url}`);
  const payload = await response.json();
  if (payload?.error || !payload?.esearchresult) {
    throw new Error(`Unexpected PubMed response: ${JSON.stringify(payload)}`);
  }
  await sleep(400);
  return payload.esearchresult;
}

const runs = [];
for (const questionId of questions) {
  const queryPath = path.join(queryRoot, `${questionId}_pubmed.txt`);
  const query = (await readFile(queryPath, "utf8")).trim();
  const result = await esearch(query);
  const sentinelChecks = [];
  for (const pmid of sentinelByQuestion[questionId]) {
    const check = await esearch(`(${query}) AND ${pmid}[pmid]`);
    sentinelChecks.push({ pmid, retrieved: Number(check.count) === 1 });
  }
  runs.push({
    question_id: questionId,
    database: "PubMed",
    platform: "NCBI E-utilities ESearch",
    status: "design_pilot_not_final_search",
    query_file: path.relative(repo, queryPath).replaceAll("\\", "/"),
    query_sha256: sha256(`${query}\n`),
    hit_count_at_access: Number(result.count),
    query_translation: result.querytranslation,
    sentinel_checks: sentinelChecks,
  });
}

const artifact = {
  schema_version: "1.0.0",
  accessed_at: new Date().toISOString(),
  time_zone: "UTC",
  endpoint: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
  status: "design_pilot_not_final_search",
  limitation: "Counts are workload estimates before human protocol/PRESS approval and are not PRISMA results.",
  request_rate: "<= 2.5 requests/second; no API key",
  runs,
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    runs.map((run) => ({
      question_id: run.question_id,
      count: run.hit_count_at_access,
      sentinel_ok: run.sentinel_checks.every((check) => check.retrieved),
    })),
  ),
);
