#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "..");
const queryRoot = path.join(repo, "research", "searches", "search_strategy_drafts");
const questionArg = process.argv.find((value) => value.startsWith("--question="))?.split("=")[1] ?? "all";
const allQuestions = ["A1", "A2", "B1", "B2", "B3"];
const questions = questionArg === "all" ? allQuestions : [questionArg.toUpperCase()];
if (questions.some((question) => !allQuestions.includes(question))) {
  throw new Error(`Unsupported question: ${questionArg}`);
}

const runDate = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fileExists = async (filePath) => {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
};

async function request(url, options = {}, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      await delay(425);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(750 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

async function esearch(term, { retmax = 0, mindate, maxdate } = {}) {
  const url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  const params = {
    db: "pubmed",
    retmode: "json",
    retmax: String(retmax),
    tool: "nutrition_safety_thesis_reboot",
    term,
  };
  if (mindate !== undefined && maxdate !== undefined) {
    params.datetype = "pdat";
    params.mindate = String(mindate);
    params.maxdate = String(maxdate);
  }
  url.search = new URLSearchParams(params).toString();
  const payload = await (await request(url, { headers: { accept: "application/json" } })).json();
  if (!payload.esearchresult) throw new Error(`Unexpected ESearch response: ${JSON.stringify(payload)}`);
  return payload.esearchresult;
}

async function idsForQuery(query) {
  const base = await esearch(query);
  const total = Number(base.count);
  if (total <= 9999) {
    const result = await esearch(query, { retmax: total });
    if (result.idlist.length !== total) {
      throw new Error(`ESearch count/export mismatch: expected ${total}, got ${result.idlist.length}`);
    }
    return { total, ids: result.idlist, query_translation: base.querytranslation, partitions: [] };
  }

  const currentYear = new Date().getUTCFullYear();
  const ranges = [{ start: 1700, end: 1899 }];
  for (let start = 1900; start <= currentYear; start += 10) {
    ranges.push({ start, end: Math.min(start + 9, currentYear) });
  }
  const ids = [];
  const partitions = [];
  for (const range of ranges) {
    const result = await esearch(query, {
      retmax: 9999,
      mindate: range.start,
      maxdate: range.end,
    });
    const count = Number(result.count);
    if (count > 9999) {
      throw new Error(`Partition still exceeds PubMed cap: ${range.start}-${range.end} count=${count}`);
    }
    if (result.idlist.length !== count) {
      throw new Error(
        `Partition count/export mismatch: ${range.start}-${range.end} expected=${count} got=${result.idlist.length}`,
      );
    }
    ids.push(...result.idlist);
    partitions.push({ ...range, count });
  }
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== total) {
    throw new Error(`Partition sum mismatch: reported=${total} unique_exported=${uniqueIds.length}`);
  }
  return { total, ids: uniqueIds, query_translation: base.querytranslation, partitions };
}

async function efetch(ids) {
  const body = new URLSearchParams({
    db: "pubmed",
    retmode: "xml",
    tool: "nutrition_safety_thesis_reboot",
    id: ids.join(","),
  });
  return (
    await request("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi", {
      method: "POST",
      headers: {
        accept: "application/xml",
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    })
  ).text();
}

for (const questionId of questions) {
  const queryFile = path.join(queryRoot, `${questionId}_pubmed.txt`);
  const query = (await readFile(queryFile, "utf8")).trim();
  const runId = `pubmed_${questionId.toLowerCase()}_designpilot_${runDate}`;
  const outputDir = path.join(repo, "research", "searches", questionId, "pubmed", runId);
  await mkdir(outputDir, { recursive: true });

  const search = await idsForQuery(query);
  await writeFile(path.join(outputDir, "query.txt"), `${query}\n`, "utf8");
  await writeFile(path.join(outputDir, "ids.txt"), `${search.ids.join("\n")}\n`, "utf8");
  await writeFile(
    path.join(outputDir, "esearch.json"),
    `${JSON.stringify(
      {
        database: "PubMed",
        endpoint: "NCBI E-utilities ESearch",
        status: "design_pilot_full_export_not_final_search",
        total_hits_reported: search.total,
        pmids_exported: search.ids.length,
        query_translation: search.query_translation,
        partitions: search.partitions,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  let batchNumber = 0;
  for (let offset = 0; offset < search.ids.length; offset += 200) {
    batchNumber += 1;
    const batchPath = path.join(
      outputDir,
      `efetch_${String(batchNumber).padStart(3, "0")}.xml`,
    );
    if (await fileExists(batchPath)) continue;
    const xml = await efetch(search.ids.slice(offset, offset + 200));
    await writeFile(batchPath, xml, "utf8");
  }

  const metadata = {
    schema_version: "1.0.0",
    run_id: runId,
    question_id: questionId,
    database: "PubMed",
    platform: "NCBI E-utilities",
    search_datetime_iso: new Date().toISOString(),
    timezone: "UTC",
    status: "design_pilot_full_export_not_final_search",
    peer_review_status: "pending_external_human_review",
    protocol_status: "pending_human_approval",
    query_sha256: sha256(`${query}\n`),
    total_hits_reported: search.total,
    records_exported: search.ids.length,
    top_n_truncation: false,
    partition_count: search.partitions.length,
    efetch_batch_count: batchNumber,
    notes: "Full public-source design-pilot export; prohibited from PRISMA/final-result use.",
  };
  await writeFile(
    path.join(outputDir, "response_metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  const files = (await readdir(outputDir)).filter((name) => name !== "checksum.sha256").sort();
  const checksums = [];
  for (const name of files) {
    const contents = await readFile(path.join(outputDir, name));
    checksums.push(`${sha256(contents)}  ${name}`);
  }
  await writeFile(path.join(outputDir, "checksum.sha256"), `${checksums.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ question_id: questionId, ...metadata }));
}
