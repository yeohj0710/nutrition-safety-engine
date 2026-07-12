#!/usr/bin/env python3
from pathlib import Path
import pandas as pd,json,re,hashlib
R=Path(__file__).resolve().parents[1];D=R/"research/systematic_review_v3";d=pd.read_csv(D/"core_evidence.csv").fillna("");m=json.loads((D/"core_manifest.json").read_text(encoding="utf-8"));rules=json.loads((D/"personalized_rules.json").read_text(encoding="utf-8"));errors=[]
required={"question_id","record_id","provider_id","title","year","doi","source_url","publication_types","automated_eligibility","population_evidence","supplement","dose_extracted","outcome_evidence","evidence_locator","fulltext_locator","human_screened","extraction_authority","priority_score"}
missing=required-set(d.columns)
if missing:errors.append("missing columns:"+",".join(sorted(missing)))
if len(d)!=m["core_records"]:errors.append("record count mismatch")
if set(d.question_id)!={"A1","A2","B1","B2","B3"}:errors.append("question set mismatch")
if d.duplicated(["question_id","record_id"]).any():errors.append("duplicate question-record rows")
if d[["record_id","title","source_url","population_evidence","outcome_evidence","evidence_locator","extraction_authority"]].astype(str).apply(lambda x:x.str.strip().eq("")).any().any():errors.append("required evidence field empty")
if not d.source_url.astype(str).str.match(r"^https://").all():errors.append("invalid source URL")
if not d.loc[d.doi.astype(bool),"doi"].astype(str).str.match(r"^10\.\d{4,9}/\S+$",case=False).all():errors.append("invalid DOI")
if not d.provider_id.astype(str).str.replace(r"\.0$","",regex=True).str.match(r"^\d+$").all():errors.append("invalid provider ID")
if not d.extraction_authority.eq("automated_from_observed_title_abstract").all():errors.append("unexpected extraction authority")
if d.human_screened.astype(str).str.lower().isin(["true","1"]).any():errors.append("unsubstantiated human-screened row")
for q,n in m["per_question"].items():
 if len(d[d.question_id==q])!=n:errors.append(f"{q} count mismatch")
 if n<5:errors.append(f"{q} fewer than five core records")
for rule in rules:
 if rule["question_id"] not in set(d.question_id):errors.append(f"unknown rule question:{rule['question_id']}")
 if not rule.get("evidence"):errors.append(f"rule without evidence:{rule['question_id']}")
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
