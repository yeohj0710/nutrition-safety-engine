#!/usr/bin/env python3
from pathlib import Path
import pandas as pd,json,re,hashlib
R=Path(__file__).resolve().parents[1];D=R/"research/systematic_review_v3";d=pd.read_csv(D/"core_evidence.csv").fillna("");m=json.loads((D/"core_manifest.json").read_text(encoding="utf-8"));rules=json.loads((D/"personalized_rules.json").read_text(encoding="utf-8"));errors=[]
if len(d)!=m["core_records"]:errors.append("record count mismatch")
for q,n in m["per_question"].items():
 if len(d[d.question_id==q])!=n:errors.append(f"{q} count mismatch")
 if n<5:errors.append(f"{q} fewer than five core records")
for rule in rules:
 ids=set(d[d.question_id==rule["question_id"]].record_id)
 for e in rule["evidence"]:
  if e["record_id"] not in ids:errors.append(f"rule evidence outside core:{e['record_id']}")
bad=[]
for _,r in d.iterrows():
 t=r.title.lower()
 if r.question_id=="A1" and re.search(r"non-vitamin k antagonist|vitamin k antagonist (?:vs|versus)",t) and not re.search(r"dietary|intake|supplement|vitamin k1",t):bad.append(r.record_id)
 if r.question_id=="B2" and not re.search(r"supplement|repletion|intake|dose|administr|taking|therapy|treatment",t):bad.append(r.record_id)
if bad:errors.append("direct relevance failures:"+",".join(bad))
print(json.dumps({"status":"valid" if not errors else "invalid","errors":errors,"records":len(d),"per_question":m["per_question"],"sha256":hashlib.sha256((D/"core_evidence.csv").read_bytes()).hexdigest()},ensure_ascii=False,indent=2));raise SystemExit(bool(errors))
