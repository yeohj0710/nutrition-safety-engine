import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const observedAt = "2026-07-10";
const root = path.resolve("research/searches/korean_db_split_designpilot_20260710");
const queries = [
  ["A1", "warfarin vitamin K"],
  ["A1", "와파린 비타민 K"],
  ["A1", "warfarin phylloquinone"],
  ["A1", "warfarin menaquinone"],
  ["A2", "warfarin omega-3"],
  ["A2", "warfarin fish oil"],
  ["A2", "anticoagulant omega-3"],
  ["A2", "항응고제 오메가-3"],
  ["B1", "kidney stone calcium supplement"],
  ["B1", "nephrolithiasis calcium supplement"],
  ["B1", "요로결석 칼슘 보충제"],
  ["B1", "신결석 칼슘 보충제"],
  ["B2", "kidney stone vitamin D"],
  ["B2", "nephrolithiasis cholecalciferol"],
  ["B2", "요로결석 비타민 D"],
  ["B2", "신결석 비타민 D"],
  ["B3", "kidney stone vitamin C"],
  ["B3", "nephrolithiasis ascorbic acid"],
  ["B3", "요로결석 비타민 C"],
  ["B3", "신결석 비타민 C"],
];

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function safeName(index, question, query) {
  const slug = query
    .normalize("NFKC")
    .replace(/[^0-9A-Za-z가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 70);
  return `${String(index + 1).padStart(2, "0")}_${question}_${slug}`;
}

async function captureKmbase(question, query, base) {
  const endpoint = "https://kmbase.medric.or.kr/ahebf/global/search_log/search_log_main.php";
  const form = new FormData();
  form.set("query", query);
  form.set("pg_idx", "150");
  form.set("frmtime", String(Date.now()));
  const response = await fetch(endpoint, { method: "POST", body: form });
  const bytes = Buffer.from(await response.arrayBuffer());
  const file = path.join("raw", "kmbase", `${base}.json`);
  fs.writeFileSync(path.join(root, file), bytes);
  let parsed = null;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {}
  return {
    platform: "KMbase",
    question_id: question,
    query,
    method: "POST multipart/form-data",
    endpoint,
    http_status: response.status,
    hits: Number.isInteger(parsed?.cnt) ? parsed.cnt : null,
    platform_hits: parsed?.kcnt == null ? null : Number(parsed.kcnt),
    external_hits: parsed?.ecnt == null ? null : Number(parsed.ecnt),
    response_file: file.replaceAll("\\", "/"),
    response_bytes: bytes.length,
    response_sha256: sha256(bytes),
  };
}

async function captureRiss(question, query, base) {
  const endpoint = "https://www.riss.kr/search/Search.do";
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries({
    colName: "all",
    isDetailSearch: "N",
    searchGubun: "true",
    oldQuery: "",
    sflag: "1",
    fsearchMethod: "search",
    isFDetailSearch: "N",
    searchQuery: "",
    pageNumber: "1",
    query,
  })) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { "User-Agent": "thesis-design-pilot/1.0" } });
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = bytes.toString("utf8");
  const countMatch = text.match(/검색결과\s*([0-9,]+)\s*건/);
  const explicitZero = /검색결과가 없습니다|0개 검색되었습니다/.test(text);
  const stored = zlib.gzipSync(bytes, { level: 9, mtime: 0 });
  const file = path.join("raw", "riss", `${base}.html.gz`);
  fs.writeFileSync(path.join(root, file), stored);
  return {
    platform: "RISS",
    question_id: question,
    query,
    method: "GET",
    endpoint,
    http_status: response.status,
    hits: countMatch ? Number(countMatch[1].replaceAll(",", "")) : explicitZero ? 0 : null,
    explicit_zero_page: explicitZero,
    capture_surface: "server_response_shell_unresolved",
    response_file: file.replaceAll("\\", "/"),
    response_bytes: stored.length,
    response_sha256: sha256(stored),
    content_encoding_at_rest: "gzip",
  };
}

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(path.join(root, "raw", "kmbase"), { recursive: true });
fs.mkdirSync(path.join(root, "raw", "riss"), { recursive: true });

const runs = [];
for (const [index, [question, query]] of queries.entries()) {
  const base = safeName(index, question, query);
  runs.push(await captureKmbase(question, query, base));
  runs.push(await captureRiss(question, query, base));
}

const summary = {
  schema_version: "1.0.0",
  status: "split_query_design_pilot_raw_responses_not_final_search",
  observed_at: observedAt,
  query_pairs: queries.length,
  response_count: runs.length,
  records_exported: 0,
  human_screening_decisions: 0,
  query_translation_validated: false,
  press_review_complete: false,
  final_search_claim_allowed: false,
  runs,
};
fs.writeFileSync(path.join(root, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  root,
  query_pairs: queries.length,
  response_count: runs.length,
  next_required_action: "capture RISS rendered DOM before validation",
}));
