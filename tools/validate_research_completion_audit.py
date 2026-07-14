#!/usr/bin/env python3
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/"research/audit/research_completion_audit.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 errors=[];d=json.loads(OUT.read_text(encoding="utf-8"))
 if d["research_complete"]:errors.append("research falsely marked complete")
 if d["completed_gates"]+d["open_gates"]!=d["gate_count"]:errors.append("gate count mismatch")
 if d["missing_evidence_files"]:errors.append("missing evidence files")
 if any(g["status"]=="complete" for g in d["gates"]):errors.append("unsupported completed gate")
 for path,expected in d["artifact_sha256"].items():
  p=ROOT/path
  if not p.is_file() or sha(p)!=expected:errors.append(f"evidence lineage mismatch: {path}")
 result={"status":"valid" if not errors else "invalid","gates":d["gate_count"],"open":d["open_gates"],"errors":errors};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
