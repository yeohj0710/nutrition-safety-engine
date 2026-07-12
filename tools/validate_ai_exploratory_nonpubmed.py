#!/usr/bin/env python3
"""Validate non-PubMed v2 mapping coverage and non-authority."""

import csv, hashlib, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data/curated_v2/ai_nonpubmed_classifications.csv"
MANIFEST = ROOT / "research/screening/ai_exploratory_nonpubmed_manifest.json"

def read(path):
    with path.open(encoding="utf-8-sig", newline="") as handle: return list(csv.DictReader(handle))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    errors=[]; before=OUTPUT.read_bytes() if OUTPUT.is_file() else b""
    subprocess.run([sys.executable, str(ROOT/"tools/build_ai_exploratory_nonpubmed.py")], cwd=ROOT, check=True, capture_output=True)
    rows, manifest=read(OUTPUT),json.loads(MANIFEST.read_text(encoding="utf-8"))
    if before and before != OUTPUT.read_bytes(): errors.append("non-PubMed v2 rebuild is not deterministic")
    keys={(r["source"],r["record_id"],r["question_id"]) for r in rows}
    if len(rows)!=269 or len(keys)!=269: errors.append("non-PubMed exact coverage mismatch")
    if manifest.get("source_counts")!={"clinicaltrials":207,"koreamed":62}: errors.append("source counts mismatch")
    if any(r["classification"]!="ai_unranked_source_candidate" or r["decision_authority"]!="ai_exploratory_only" or r["human_screening_claim"]!="false" for r in rows): errors.append("non-PubMed authority boundary crossed")
    if sum(bool(r["known_query_risk"]) for r in rows)!=139: errors.append("ClinicalTrials lexical-risk flags lost")
    if sum(bool(r["source_limitation"]) for r in rows)!=62: errors.append("KoreaMed export limitations lost")
    if manifest.get("output_sha256")!=sha(OUTPUT) or manifest.get("prisma_allowed") is not False: errors.append("manifest mismatch")
    result={"errors":errors,"rows":len(rows),"source_counts":manifest.get("source_counts"),"lexical_risk_rows":sum(bool(r["known_query_risk"]) for r in rows),"export_limited_rows":sum(bool(r["source_limitation"]) for r in rows),"status":"valid" if not errors else "invalid"}
    print(json.dumps(result,ensure_ascii=False,indent=2)); return 1 if errors else 0
if __name__=="__main__": raise SystemExit(main())
