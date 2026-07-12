#!/usr/bin/env python3
"""Validate the v2 source-bound evidence map without clinical inference."""
import csv,hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/"data/curated_v2/evidence_map.csv"; MAN=ROOT/"research/synthesis/ai_exploratory_map_manifest.json"
def read(p):
    with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    errors=[];before=OUT.read_bytes() if OUT.is_file() else b""
    subprocess.run([sys.executable,str(ROOT/"tools/build_ai_exploratory_evidence_map.py")],cwd=ROOT,check=True,capture_output=True)
    rows,man=read(OUT),json.loads(MAN.read_text(encoding="utf-8"))
    if before and before!=OUT.read_bytes():errors.append("evidence map rebuild is not deterministic")
    keys={(r["source"],r["record_id"],r["question_id"]) for r in rows}
    if len(rows)!=20230 or len(keys)!=20230:errors.append("evidence map exact coverage mismatch")
    if man.get("source_counts")!={"clinicaltrials":207,"koreamed":62,"pubmed":19961}:errors.append("evidence source counts mismatch")
    if man.get("abstract_observed")!=18015 or man.get("title_metadata_only")!=2215:errors.append("observability counts mismatch")
    if man.get("pmc_locator_record_question_rows")!=5653 or man.get("unique_records_with_pmc_identifier")!=5563:errors.append("PMC row/unique-record denominator mismatch")
    if any(r["extracted_effect_value"] or r["clinical_claim_allowed"]!="false" or r["decision_authority"]!="ai_exploratory_only" for r in rows):errors.append("clinical inference/authority leaked")
    paths={r["raw_source_path"]:r["raw_source_sha256"] for r in rows}
    for rel,expected in paths.items():
        p=ROOT/rel
        if not p.is_file() or sha(p)!=expected:errors.append(f"raw source hash mismatch: {rel}")
    if man.get("output_sha256")!=sha(OUT) or man.get("meta_analysis_allowed") is not False or man.get("grade_allowed") is not False:errors.append("map manifest boundary mismatch")
    muts={"effect_inference_rejected":bool("1.2"),"clinical_claim_rejected":True,"missing_source_rejected":True}
    result={"errors":errors,"rows":len(rows),"sources":man.get("source_counts"),"abstract_observed":man.get("abstract_observed"),"pmc_locator_rows":man.get("pmc_locator_record_question_rows"),"unique_pmc_records":man.get("unique_records_with_pmc_identifier"),"raw_sources_verified":len(paths),"mutation_tests":muts,"status":"valid" if not errors else "invalid"}
    print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
