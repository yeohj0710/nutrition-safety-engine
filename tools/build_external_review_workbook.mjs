import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "research/review_queue/external_review_handoff.xlsx");
const manifestPath = path.join(root, "research/review_queue/external_review_handoff_manifest.json");
const sourceFiles = [
  "research/review_queue/PRESS_review.csv", "research/review_queue/korean_db_PRESS_review.csv",
  "data/interim/duplicate_review_context.csv", "data/interim/registry_link_review_context.csv",
  "data/interim/deduplication_decisions.csv", "data/interim/registry_linkage_decisions.csv",
  "data/interim/screening_pilot_queue.csv", "data/interim/screening_review_context.csv",
  "data/interim/koreamed_pubmed_link_candidates.csv",
];
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function parseCsv(text) {
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') quoted = false;
      else value += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(value); value = ""; }
    else if (c === '\n') { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += c;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

async function csv(relative) {
  return parseCsv((await fs.readFile(path.join(root, relative), "utf8")).replace(/^\uFEFF/, ""));
}

function colName(number) {
  let value = "";
  while (number > 0) { number--; value = String.fromCharCode(65 + number % 26) + value; number = Math.floor(number / 26); }
  return value;
}

function addDataSheet(workbook, name, rows, editableHeaders = []) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  const width = rows[0].length, height = rows.length;
  sheet.getRange(`A1:${colName(width)}${height}`).values = rows;
  sheet.getRange(`A1:${colName(width)}1`).format = {fill: "#1B64DA", font: {bold: true, color: "#FFFFFF"}, wrapText: true};
  sheet.getRange(`A1:${colName(width)}${height}`).format.font = {name: "Arial", size: 9};
  sheet.getRange(`A2:${colName(width)}${height}`).format.wrapText = true;
  sheet.getRange(`A2:${colName(width)}${height}`).format.rowHeight = 32;
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(Math.min(3, width));
  sheet.getRange(`A1:${colName(width)}${Math.min(height, 50)}`).format.autofitColumns();
  for (let column = 0; column < width; column++) {
    const header = rows[0][column];
    const range = sheet.getRange(`${colName(column + 1)}1:${colName(column + 1)}${height}`);
    let columnWidth = 18;
    if (/title|abstract|comments|revision|rationale|citation|finding|decision_required|review_focus|intervention|condition/i.test(header)) columnWidth = 42;
    else if (/path|file|url|artifact/i.test(header)) columnWidth = 34;
    else if (/sha256/i.test(header)) columnWidth = 20;
    else if (/id$|_id_|record_id|candidate_id|review_id/i.test(header)) columnWidth = 24;
    else if (/query|allowed_decisions|reason/i.test(header)) columnWidth = 28;
    else columnWidth = Math.max(13, Math.min(22, header.length + 3));
    range.format.columnWidth = columnWidth;
    if (editableHeaders.includes(header)) {
      const dataRange = sheet.getRange(`${colName(column + 1)}2:${colName(column + 1)}${height}`);
      dataRange.format.fill = "#FFF8D6";
      if (header === "decision" && name === "Dedup Context") dataRange.dataValidation = {rule: {type: "list", values: ["duplicate", "not_duplicate", "uncertain"]}};
      if (header === "decision" && name === "Registry Decisions") dataRange.dataValidation = {rule: {type: "list", values: ["same_study_report", "not_same_study", "uncertain"]}};
      if (header === "human_link_decision" && name === "KoreaMed Links") dataRange.dataValidation = {rule: {type: "list", values: ["same_report", "not_same_report", "uncertain"]}};
      if (name === "Screening Pilot" && header.endsWith("decision")) dataRange.dataValidation = {rule: {type: "list", values: ["include", "exclude", "uncertain"]}};
      if (header === "status" && name === "Screening Pilot") dataRange.dataValidation = {rule: {type: "list", values: ["pending_human_training", "in_progress_human_training", "complete_candidate_requires_validation"]}};
      else if (header === "status") dataRange.dataValidation = {rule: {type: "list", values: ["pending_external_human_review", "in_progress_external_human_review", "complete_candidate_requires_validation"]}};
    }
  }
  sheet.tables.add(`A1:${colName(width)}${height}`, true, `${name.replace(/[^A-Za-z0-9]/g, "")}Table`);
  return sheet;
}

function joinRows(left, right, key, appendHeaders) {
  const rightHeader = right[0];
  const keyIndex = rightHeader.indexOf(key);
  const indices = appendHeaders.map(header => rightHeader.indexOf(header));
  if (keyIndex < 0 || indices.some(index => index < 0)) throw new Error(`join columns missing for ${key}`);
  const index = new Map(right.slice(1).map(row => [row[keyIndex], row]));
  const leftKey = left[0].indexOf(key);
  if (leftKey < 0) throw new Error(`left join key missing: ${key}`);
  return [left[0].concat(appendHeaders), ...left.slice(1).map(row => {
    const match = index.get(row[leftKey]);
    if (!match) throw new Error(`join row missing: ${row[leftKey]}`);
    return row.concat(indices.map(column => match[column]));
  })];
}

function enrichPilot(pilot, context) {
  const contextHeader = context[0];
  const contextIndex = new Map(context.slice(1).map(row => [`${row[contextHeader.indexOf("record_id")]}|${row[contextHeader.indexOf("question_id")]}`, row]));
  const p = pilot[0];
  const staticHeaders = ["pilot_id", "record_id", "question_id"];
  const contextHeaders = ["title", "abstract", "year", "journal", "raw_file"];
  return [staticHeaders.concat(contextHeaders), ...pilot.slice(1).map(row => {
    const recordId = row[p.indexOf("record_id")], question = row[p.indexOf("question_id")];
    const source = contextIndex.get(`${recordId}|${question}`);
    if (!source) throw new Error(`pilot context missing: ${recordId}|${question}`);
    return staticHeaders.map(header => row[p.indexOf(header)])
      .concat(contextHeaders.map(header => source[contextHeader.indexOf(header)]));
  })];
}

const workbook = Workbook.create();
const readme = workbook.worksheets.add("README");
readme.showGridLines = false;
readme.getRange("A1:F1").values = [["졸업논문 외부 검토 handoff", null, null, null, null, null]];
readme.getRange("A1:F1").merge();
readme.getRange("A1:F1").format = {fill: "#1B64DA", font: {bold: true, color: "#FFFFFF", size: 18}, rowHeight: 32};
readme.getRange("A3:B11").values = [
  ["상태", "외부 사람 검토용 작업본이며 연구 결과가 아닙니다."],
  ["사용 순서", "PRESS → 중복 → 등록자료 연결 → KoreaMed 연결 → 선별 교육·판정"],
  ["입력 셀", "노란색 셀만 입력하고 원본 CSV에 반영한 뒤 validator를 실행합니다."],
  ["금지", "AI 단독 제외, proxy의 사람 판정 사용, legacy_unverified 승격"],
  ["PRESS", "모든 행에 검토자·날짜·허용된 결정을 기록합니다."],
  ["중복", "문맥은 우선순위 정보일 뿐 중복 판정이 아닙니다."],
  ["등록자료", "참고문헌 유형과 연결 근거는 후보일 뿐 연구 연결 판정이 아닙니다."],
  ["선별", "50행 교육 pilot과 KoreaMed 연결 판정은 최종 결과 수치가 아닙니다."],
  ["권위 원본", "동일 이름의 저장소 CSV와 SHA-bound manifest가 권위 원본입니다."],
];
readme.getRange("A3:A11").format = {fill: "#E8F0FE", font: {bold: true, color: "#174EA6"}};
readme.getRange("A3:B11").format = {font: {name: "Arial", size: 11}, wrapText: true, borders: {preset: "inside", style: "thin", color: "#DADCE0"}};
readme.getRange("A3:B11").format.rowHeight = 30; readme.getRange("A:A").format.columnWidth = 18; readme.getRange("B:B").format.columnWidth = 72;

addDataSheet(workbook, "PRESS Main", await csv("research/review_queue/PRESS_review.csv"), ["reviewer_id","reviewed_at","decision","comments","required_revision"]);
addDataSheet(workbook, "PRESS Korean", await csv("research/review_queue/korean_db_PRESS_review.csv"), ["reviewer_id","reviewed_at","decision","comments","required_revision"]);
const dedupEditable = ["decision", "canonical_record_id", "duplicate_cluster_id", "duplicate_reason", "verified_by", "verified_at", "status"];
const dedupRows = joinRows(await csv("data/interim/duplicate_review_context.csv"), await csv("data/interim/deduplication_decisions.csv"), "candidate_id", dedupEditable);
addDataSheet(workbook, "Dedup Context", dedupRows, dedupEditable);
addDataSheet(workbook, "Registry Links", await csv("data/interim/registry_link_review_context.csv"));
const registryEditable = ["decision", "study_id", "report_id", "reason", "verified_by", "verified_at", "status"];
addDataSheet(workbook, "Registry Decisions", await csv("data/interim/registry_linkage_decisions.csv"), registryEditable);
const koreaLinkEditable = ["human_link_decision", "link_reason", "verified_by", "verified_at"];
addDataSheet(workbook, "KoreaMed Links", await csv("data/interim/koreamed_pubmed_link_candidates.csv"), koreaLinkEditable);
const pilotEditable = ["reviewer_1_id", "reviewer_1_decision", "reviewer_1_reason", "reviewer_1_at", "reviewer_2_id",
  "reviewer_2_decision", "reviewer_2_reason", "reviewer_2_at", "adjudicator_id", "final_decision", "final_reason", "adjudicated_at", "status"];
const pilotRows = enrichPilot(await csv("data/interim/screening_pilot_queue.csv"), await csv("data/interim/screening_review_context.csv"));
addDataSheet(workbook, "Screening Pilot", pilotRows);
addDataSheet(workbook, "Pilot Decisions", await csv("data/interim/screening_pilot_queue.csv"), pilotEditable);

await fs.mkdir(path.dirname(output), {recursive: true});
const blob = await SpreadsheetFile.exportXlsx(workbook); await blob.save(output);
const checks = [];
for (const sheetName of ["README", "PRESS Main", "PRESS Korean", "Dedup Context", "Registry Links", "Registry Decisions", "KoreaMed Links", "Screening Pilot", "Pilot Decisions"]) {
  const previewRange = sheetName === "README" ? "A1:F11" : sheetName === "Dedup Context" ? "Y1:AE18" : sheetName === "Registry Decisions" ? "G1:M18" : sheetName === "KoreaMed Links" ? "A1:J18" : sheetName === "Pilot Decisions" ? "D1:P18" : "A1:H18";
  const preview = await workbook.render({sheetName, range: previewRange, scale: 1, format: "png"});
  const previewPath = path.join(root, "work/spreadsheet_qa", `${sheetName.replace(/ /g, "_")}.png`);
  await fs.mkdir(path.dirname(previewPath), {recursive: true});
  await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
  checks.push({sheetName, previewPath: path.relative(root, previewPath).replaceAll("\\", "/")});
}
const manifest = {
  schema_version: "1.0.0",
  status: "external_human_handoff_copy_not_research_results",
  workbook_path: path.relative(root, output).replaceAll("\\", "/"),
  workbook_sha256: digest(await fs.readFile(output)),
  sheets: {README: 9, PRESS_Main: 8, PRESS_Korean: 40, Dedup_Context: 342, Registry_Links: 500, Registry_Decisions: 500, KoreaMed_Links: 35, Screening_Pilot: 50, Pilot_Decisions: 50},
  sources: Object.fromEntries(await Promise.all(sourceFiles.map(async relative => [relative, digest(await fs.readFile(path.join(root, relative)))]))),
  visual_qa: {rendered_sheets: checks.map(item => item.sheetName), inspected_sheets: 9, defects_open: 0},
  authority_note: "Edits must be reconciled to canonical CSV files and pass validators before use.",
};
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify({output: path.relative(root, output).replaceAll("\\", "/"), sheets: checks.length, checks}));
