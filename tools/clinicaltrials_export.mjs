#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "..");
const runDate = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const queries = {
  A1: { condition: "anticoagulation OR warfarin", intervention: "vitamin K OR phylloquinone" },
  A2: { condition: "anticoagulation OR atrial fibrillation OR venous thromboembolism", intervention: "omega-3 OR fish oil OR EPA OR DHA OR icosapent" },
  B1: { condition: "kidney stone OR nephrolithiasis OR hypercalciuria", intervention: "calcium supplement OR calcium carbonate OR calcium citrate" },
  B2: { condition: "kidney stone OR nephrolithiasis OR hypercalciuria", intervention: "vitamin D OR cholecalciferol OR ergocalciferol" },
  B3: { condition: "kidney stone OR nephrolithiasis OR hyperoxaluria", intervention: "vitamin C OR ascorbic acid" },
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function fetchJson(url, attempts = 4) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw last;
}

for (const [questionId, query] of Object.entries(queries)) {
  const runId = `ctgov_${questionId.toLowerCase()}_designpilot_${runDate}`;
  const outputDir = path.join(repo, "research", "searches", questionId, "clinicaltrials", runId);
  await mkdir(outputDir, { recursive: true });
  const pages = [];
  const studies = [];
  let token;
  let totalCount;
  do {
    const url = new URL("https://clinicaltrials.gov/api/v2/studies");
    const params = {
      "query.cond": query.condition,
      "query.intr": query.intervention,
      pageSize: "1000",
      countTotal: "true",
      format: "json",
    };
    if (token) params.pageToken = token;
    url.search = new URLSearchParams(params).toString();
    const payload = await fetchJson(url);
    totalCount ??= payload.totalCount;
    pages.push({ request_url: url.toString(), studies: payload.studies ?? [], nextPageToken: payload.nextPageToken ?? null });
    studies.push(...(payload.studies ?? []));
    token = payload.nextPageToken;
  } while (token);

  const ids = studies.map((study) => study?.protocolSection?.identificationModule?.nctId).filter(Boolean);
  if (ids.length !== totalCount || new Set(ids).size !== ids.length) {
    throw new Error(`${questionId} count mismatch total=${totalCount} exported=${ids.length} unique=${new Set(ids).size}`);
  }
  const queryText = `condition=${query.condition}\nintervention=${query.intervention}\n`;
  await writeFile(path.join(outputDir, "query.txt"), queryText, "utf8");
  await writeFile(path.join(outputDir, "ids.txt"), `${ids.join("\n")}\n`, "utf8");
  for (let index = 0; index < pages.length; index += 1) {
    await writeFile(path.join(outputDir, `page_${String(index + 1).padStart(3, "0")}.json`), `${JSON.stringify(pages[index], null, 2)}\n`, "utf8");
  }
  const metadata = {
    schema_version: "1.0.0",
    run_id: runId,
    question_id: questionId,
    database: "ClinicalTrials.gov",
    platform: "ClinicalTrials.gov API v2",
    search_datetime_iso: new Date().toISOString(),
    timezone: "UTC",
    status: "design_pilot_full_export_not_final_search",
    peer_review_status: "pending_external_human_review",
    protocol_status: "pending_human_approval",
    query_sha256: sha256(queryText),
    total_hits_reported: totalCount,
    records_exported: ids.length,
    top_n_truncation: false,
    page_count: pages.length,
  };
  await writeFile(path.join(outputDir, "response_metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  const files = (await readdir(outputDir)).filter((name) => name !== "checksum.sha256").sort();
  const checksums = [];
  for (const name of files) checksums.push(`${sha256(await readFile(path.join(outputDir, name)))}  ${name}`);
  await writeFile(path.join(outputDir, "checksum.sha256"), `${checksums.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ question_id: questionId, total: totalCount, exported: ids.length, pages: pages.length }));
}
