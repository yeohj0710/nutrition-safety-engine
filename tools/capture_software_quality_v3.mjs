#!/usr/bin/env node
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(import.meta.dirname,"..");
const report=resolve(root,"research/validation/vitest_v3.json");
const output=resolve(root,"research/validation/software_quality_v3.json");
function run(command,args){const result=spawnSync(command,args,{cwd:root,encoding:"utf8",shell:false,stdio:["ignore","pipe","pipe"]});if(result.status!==0){if(result.stdout)process.stderr.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);if(result.error)process.stderr.write(`${result.error.message}\n`);process.exit(result.status??1)}return result}
const npmCli=process.env.npm_execpath;
if(!npmCli)throw new Error("npm_execpath is required to capture software quality");
run(process.execPath,[resolve(root,"node_modules/vitest/vitest.mjs"),"run","--reporter=json",`--outputFile=${report}`]);
run(process.execPath,[npmCli,"run","lint"]);
run(process.execPath,[npmCli,"run","typecheck"]);
run(process.execPath,[npmCli,"run","build"]);
const tests=JSON.parse(readFileSync(report,"utf8"));
const payload={schema_version:"software-quality-v3.0",captured_at:new Date().toISOString(),test_files:tests.testResults.length,tests:tests.numTotalTests,test_failures:tests.numFailedTests,lint:"passed",typescript:"passed",production_build:"passed",test_report:"research/validation/vitest_v3.json",test_report_sha256:createHash("sha256").update(readFileSync(report)).digest("hex")};
writeFileSync(output,JSON.stringify(payload,null,2)+"\n","utf8");
process.stdout.write(JSON.stringify(payload,null,2)+"\n");
