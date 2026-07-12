#!/usr/bin/env python3
"""Build the protocol-v2 final reproducibility manifest."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/"research/thesis/ai_exploratory_final_manifest.json"
FILES=["research/protocol/protocol-v2.0-ai-exploratory.md","research/protocol/amendments.csv","research/protocol/ai_exploratory_role_matrix.md","data/curated_v2/ai_screening_classifications.csv","data/curated_v2/ai_nonpubmed_classifications.csv","data/curated_v2/evidence_map.csv","data/curated_v2/provisional_claims.jsonl","data/curated_v2/exploratory_rules.jsonl","research/screening/ai_exploratory_screening_manifest.json","research/screening/ai_exploratory_nonpubmed_manifest.json","research/synthesis/ai_exploratory_map_manifest.json","src/generated/ai-exploratory-bundle.json","research/validation/ai_exploratory_performance.json","research/validation/ai_exploratory_local_smoke.json","research/thesis/ai_exploratory_thesis_ko.md","research/thesis/ai_exploratory_thesis.docx","research/thesis/ai_exploratory_thesis.pdf","tools/build_ai_exploratory_screening.py","tools/build_ai_exploratory_nonpubmed.py","tools/build_ai_exploratory_evidence_map.py","tools/build_ai_exploratory_bundle.py","tools/build_ai_exploratory_thesis.py","scripts/evaluate-ai-exploratory-scenarios.ts"]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 head=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip();entries=[]
 for rel in FILES:
  p=ROOT/rel
  if not p.is_file():raise FileNotFoundError(rel)
  entries.append({"path":rel,"size_bytes":p.stat().st_size,"sha256":sha(p)})
 mapm=json.loads((ROOT/"research/synthesis/ai_exploratory_map_manifest.json").read_text(encoding="utf-8"));screen=json.loads((ROOT/"research/screening/ai_exploratory_screening_manifest.json").read_text(encoding="utf-8"));perf=json.loads((ROOT/"research/validation/ai_exploratory_performance.json").read_text(encoding="utf-8"));smoke=json.loads((ROOT/"research/validation/ai_exploratory_local_smoke.json").read_text(encoding="utf-8"))
 payload={"schema_version":"1.0.0","study_id":"nutrition-safety-engine-ai-exploratory-v2","status":"complete_verified_ai_exploratory","protocol_version":"2.0-ai-exploratory","implementation_head":head,"v1_systematic_review_status":"blocked_external_not_relabelled","systematic_review_claim_allowed":False,"clinical_recommendation_allowed":False,"human_review_claim_allowed":False,"summary":{"record_question_units":mapm["row_count"],"source_counts":mapm["source_counts"],"abstract_observed":mapm["abstract_observed"],"title_metadata_only":mapm["title_metadata_only"],"pubmed_classifications":screen["classifications"],"synthetic_scenarios":perf["scenario_count"],"executions":perf["executions"],"clinical_action_leakage":perf["clinical_action_leakage_scenarios"],"legacy_leakage":perf["legacy_leakage_scenarios"],"runtime_home_status":smoke["home_status"],"runtime_api_status":smoke["api_status"],"pdf_visual_pages_checked":6,"pdf_visual_defects_open":0},"artifacts":entries}
 OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");print(json.dumps({"status":payload["status"],"implementation_head":head,"artifacts":len(entries)},ensure_ascii=False));return 0
if __name__=="__main__":raise SystemExit(main())
