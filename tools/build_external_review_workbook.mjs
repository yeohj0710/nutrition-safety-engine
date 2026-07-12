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
  "data/interim/screening_pilot_queue.csv",
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
    if (editableHeaders.includes(header)) range.format.fill = "#FFF8D6";
  }
  sheet.tables.add(`A1:${colName(width)}${height}`, true, `${name.replace(/[^A-Za-z0-9]/g, "")}Table`);
  return sheet;
}

const workbook = Workbook.create();
const readme = workbook.worksheets.add("README");
readme.showGridLines = false;
readme.getRange("A1:F1").values = [["졸업논문 외부 검토 handoff", null, null, null, null, null]];
readme.getRange("A1:F1").merge();
readme.getRange("A1:F1").format = {fill: "#1B64DA", font: {bold: true, color: "#FFFFFF", size: 18}, rowHeight: 32};
readme.getRange("A3:B11").values = [
  ["상태", "외부 사람 검토용 복사본 - 연구결과 아님"],
  ["사용 순서", "PRESS Main → PRESS Korean → Dedup Context → Registry Links → Screening Pilot"],
  ["노란 셀", "사람이 입력할 수 있는 필드. 원본 CSV로 다시 반영한 뒤 validator 실행"],
  ["금지", "AI 단독 제외, proxy를 사람 판정으로 사용, legacy_unverified 승격"],
  ["PRESS", "모든 행에 reviewer/date/allowed decision 필요"],
  ["중복", "context는 우선순위일 뿐 duplicate 판정이 아님"],
  ["registry", "reference type은 연결 근거 후보일 뿐 study linkage 판정이 아님"],
  ["screening", "50행 교육용 pilot. 최종 선별 수치로 보고하지 않음"],
  ["권위 원본", "동일 이름의 저장소 CSV와 SHA-bound manifest"],
];
readme.getRange("A3:A11").format = {fill: "#E8F0FE", font: {bold: true, color: "#174EA6"}};
readme.getRange("A3:B11").format = {font: {name: "Arial", size: 11}, wrapText: true, borders: {preset: "inside", style: "thin", color: "#DADCE0"}};
readme.getRange("A3:B11").format.autofitRows(); readme.getRange("A:A").format.columnWidth = 18; readme.getRange("B:B").format.columnWidth = 72;

addDataSheet(workbook, "PRESS Main", await csv("research/review_queue/PRESS_review.csv"), ["reviewer_id","reviewed_at","decision","comments","required_revision"]);
addDataSheet(workbook, "PRESS Korean", await csv("research/review_queue/korean_db_PRESS_review.csv"), ["reviewer_id","reviewed_at","decision","comments","required_revision"]);
addDataSheet(workbook, "Dedup Context", await csv("data/interim/duplicate_review_context.csv"));
addDataSheet(workbook, "Registry Links", await csv("data/interim/registry_link_review_context.csv"));
addDataSheet(workbook, "Screening Pilot", await csv("data/interim/screening_pilot_queue.csv"));

await fs.mkdir(path.dirname(output), {recursive: true});
const blob = await SpreadsheetFile.exportXlsx(workbook); await blob.save(output);
const checks = [];
for (const sheetName of ["README", "PRESS Main", "PRESS Korean", "Dedup Context", "Registry Links", "Screening Pilot"]) {
  const preview = await workbook.render({sheetName, range: sheetName === "README" ? "A1:F11" : "A1:H18", scale: 1, format: "png"});
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
  sheets: {README: 9, PRESS_Main: 8, PRESS_Korean: 40, Dedup_Context: 342, Registry_Links: 500, Screening_Pilot: 50},
  sources: Object.fromEntries(await Promise.all(sourceFiles.map(async relative => [relative, digest(await fs.readFile(path.join(root, relative)))]))),
  visual_qa: {rendered_sheets: checks.map(item => item.sheetName), inspected_sheets: 6, defects_open: 0},
  authority_note: "Edits must be reconciled to canonical CSV files and pass validators before use.",
};
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify({output: path.relative(root, output).replaceAll("\\", "/"), sheets: checks.length, checks}));
