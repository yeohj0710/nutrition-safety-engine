#!/usr/bin/env python3
"""Validate v2 provisional claims/rules and generated bundle lineage."""
import hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];MAP=ROOT/"data/curated_v2/evidence_map.csv";MAN=ROOT/"research/synthesis/ai_exploratory_map_manifest.json";CLAIMS=ROOT/"data/curated_v2/provisional_claims.jsonl";RULES=ROOT/"data/curated_v2/exploratory_rules.jsonl";BUNDLE=ROOT/"src/generated/ai-exploratory-bundle.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def lines(p):return [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x.strip()]
def main():
 errors=[];before=BUNDLE.read_bytes() if BUNDLE.is_file() else b"";subprocess.run([sys.executable,str(ROOT/"tools/build_ai_exploratory_bundle.py")],cwd=ROOT,check=True,capture_output=True)
 claims,rules,bundle=lines(CLAIMS),lines(RULES),json.loads(BUNDLE.read_text(encoding="utf-8"));ids={x["claim_id"] for x in claims}
 if before and before!=BUNDLE.read_bytes():errors.append("v2 bundle rebuild is not deterministic")
 if len(claims)!=5 or len(rules)!=5 or len(ids)!=5:errors.append("v2 claim/rule cardinality mismatch")
 if any(c["authority"]!="ai_exploratory_only" or c["clinical_interpretation_allowed"] is not False or c["scope_status"]!="ai_exploratory" for c in claims):errors.append("provisional claim authority crossed")
 if any(r["claim_id"] not in ids or r["clinical_action"] is not None or r["output_type"]!="evidence_navigation" for r in rules):errors.append("navigation rule boundary crossed")
 if any(c["support"]["sha256"]!=sha(MAP) or c["support"]["manifest_sha256"]!=sha(MAN) for c in claims):errors.append("claim source lineage mismatch")
 if bundle.get("meta",{}).get("evidenceMapSha256")!=sha(MAP) or bundle.get("claims")!=claims or bundle.get("rules")!=rules:errors.append("generated bundle mismatch")
 result={"errors":errors,"claims":len(claims),"rules":len(rules),"clinical_actions":sum(r["clinical_action"] is not None for r in rules),"bundle_sha256":sha(BUNDLE),"status":"valid" if not errors else "invalid"};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
