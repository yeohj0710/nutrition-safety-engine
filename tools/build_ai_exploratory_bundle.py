#!/usr/bin/env python3
"""Build five question-level provisional map claims and non-clinical navigation rules."""
import csv,hashlib,json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; MAP=ROOT/"data/curated_v2/evidence_map.csv"; MAN=ROOT/"research/synthesis/ai_exploratory_map_manifest.json"
CLAIMS=ROOT/"data/curated_v2/provisional_claims.jsonl"; RULES=ROOT/"data/curated_v2/exploratory_rules.jsonl"; BUNDLE=ROOT/"src/generated/ai-exploratory-bundle.json"
TERMS={"A1":["vitamin k","phylloquinone","menaquinone"],"A2":["omega-3","omega 3","fish oil","epa","dha","icosapent"],"B1":["calcium"],"B2":["vitamin d","cholecalciferol","ergocalciferol"],"B3":["vitamin c","ascorbic acid","ascorbate"]}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 with MAP.open(encoding="utf-8-sig",newline="") as f:rows=list(csv.DictReader(f))
 map_hash=sha(MAP); manifest_hash=sha(MAN);claims=[];rules=[]
 for q in TERMS:
  subset=[r for r in rows if r["question_id"]==q]; classes=Counter(r["classification"] for r in subset);sources=Counter(r["source"] for r in subset)
  claim={"claim_id":f"V2-MAP-{q}","question_id":q,"claim_type":"provisional_ai_map_claim","statement":f"{q} 탐색 corpus에는 {len(subset):,}개의 record-question unit이 보존되어 있다.","record_question_units":len(subset),"source_counts":dict(sorted(sources.items())),"classification_counts":dict(sorted(classes.items())),"abstract_observed":sum(r["observability"]=="abstract_observed" for r in subset),"support":{"path":MAP.relative_to(ROOT).as_posix(),"sha256":map_hash,"manifest_path":MAN.relative_to(ROOT).as_posix(),"manifest_sha256":manifest_hash},"authority":"ai_exploratory_only","clinical_interpretation_allowed":False,"scope_status":"ai_exploratory"}
  claims.append(claim);rules.append({"rule_id":f"V2-NAV-{q}","question_id":q,"trigger_terms":TERMS[q],"output_type":"evidence_navigation","claim_id":claim["claim_id"],"clinical_action":None,"scope_status":"ai_exploratory"})
 CLAIMS.write_text("".join(json.dumps(x,ensure_ascii=False,sort_keys=True)+"\n" for x in claims),encoding="utf-8")
 RULES.write_text("".join(json.dumps(x,ensure_ascii=False,sort_keys=True)+"\n" for x in rules),encoding="utf-8")
 bundle={"meta":{"schemaVersion":"1.0.0","bundleVersion":"2.0-ai-exploratory","scope":"ai_exploratory","generationMode":"deterministic","evidenceMapSha256":map_hash,"claimCount":5,"ruleCount":5},"claims":claims,"rules":rules}
 BUNDLE.write_text(json.dumps(bundle,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"claims":5,"rules":5,"bundle_sha256":sha(BUNDLE)},ensure_ascii=False));return 0
if __name__=="__main__":raise SystemExit(main())
