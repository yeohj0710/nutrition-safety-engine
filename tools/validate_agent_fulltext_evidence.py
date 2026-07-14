#!/usr/bin/env python3
import csv,gzip,hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; BASE=ROOT/"research/fulltext/agent_core_fulltext"
OUT=BASE/"agent_fulltext_evidence.csv"; SUMMARY=ROOT/"research/synthesis/agent_fulltext_evidence_summary.json"
def sha(b): return hashlib.sha256(b).hexdigest()
def main():
 errors=[]; data=json.loads(SUMMARY.read_text(encoding="utf-8"))
 with OUT.open(encoding="utf-8-sig",newline="") as f: rows=list(csv.DictReader(f))
 keys=[(r["pmcid"],r["paragraph_position"],r["sentence_position"]) for r in rows]
 if len(keys)!=len(set(keys)): errors.append("duplicate sentence locator")
 if len(rows)!=data["evidence_sentences"]: errors.append("sentence count mismatch")
 if sha(OUT.read_bytes())!=data["output"]["sha256"]: errors.append("output checksum mismatch")
 if sha(gzip.decompress((BASE/"pmc_core_batch.xml.gz").read_bytes()))!=data["inputs"]["raw_xml_sha256"]: errors.append("raw XML lineage mismatch")
 if any(not re.fullmatch(r"[0-9a-f]{64}",r["sentence_sha256"]) for r in rows): errors.append("invalid sentence hash")
 if any(r["extraction_authority"]!="agent_fulltext_extraction_only" or r["human_verified"] or r["eligibility_claim"]!="false" or r["effect_estimate_claim"]!="false" for r in rows): errors.append("authority boundary crossed")
 if data["human_verified_sentences"] or data["human_eligibility_decisions"] or data["rob_completed"] or data["grade_completed"] or data["clinical_conclusion_allowed"]: errors.append("false completion claim")
 result={"status":"valid" if not errors else "invalid","sentences":len(rows),"articles":len({r["record_id"] for r in rows}),"errors":errors}
 print(json.dumps(result,ensure_ascii=False,indent=2)); return 1 if errors else 0
if __name__=="__main__": raise SystemExit(main())
