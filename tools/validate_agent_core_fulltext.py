#!/usr/bin/env python3
import csv,gzip,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/"research/fulltext/agent_core_fulltext"
def sha(b): return hashlib.sha256(b).hexdigest()
def main():
    errors=[]; m=json.loads((OUT/"manifest.json").read_text(encoding="utf-8"))
    with (OUT/"articles.csv").open(encoding="utf-8",newline="") as f: rows=list(csv.DictReader(f))
    stored=(OUT/m["raw_file"]).read_bytes(); raw=gzip.decompress(stored)
    if len(rows)!=m["returned"] or m["returned"]!=m["requested"]: errors.append("retrieval count mismatch")
    if sha(stored)!=m["raw_gzip_sha256"] or sha(raw)!=m["raw_xml_sha256"]: errors.append("raw checksum mismatch")
    if len({r["record_id"] for r in rows})!=len(rows): errors.append("duplicate record")
    if any(r["retrieval_authority"]!="agent_source_capture_only" or r["human_fulltext_verified"] or r["human_eligibility_decision"] for r in rows): errors.append("human authority crossed")
    if m["human_fulltext_verified"] or m["human_eligibility_decisions"] or m["final_inclusion_claim_allowed"]: errors.append("false completion claim")
    result={"status":"valid" if not errors else "invalid","articles":len(rows),"body_present":m["body_present"],"errors":errors}
    print(json.dumps(result,ensure_ascii=False,indent=2)); return 1 if errors else 0
if __name__=="__main__": raise SystemExit(main())
