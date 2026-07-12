#!/usr/bin/env python3
"""Build a source-bound bibliographic/abstract evidence map for protocol v2."""

import csv, hashlib, json
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CONTEXT=ROOT/"data/interim/screening_review_context.csv"
CLASSES=ROOT/"data/curated_v2/ai_screening_classifications.csv"
PMC=ROOT/"data/interim/pmc_fulltext_candidates.csv"
NONPUB=ROOT/"data/curated_v2/ai_nonpubmed_classifications.csv"
OUTPUT=ROOT/"data/curated_v2/evidence_map.csv"
MANIFEST=ROOT/"research/synthesis/ai_exploratory_map_manifest.json"

def read(p):
    with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    context,classes,pmc,nonpub=read(CONTEXT),read(CLASSES),read(PMC),read(NONPUB)
    class_index={(r["record_id"],r["question_id"]):r for r in classes}
    pmc_index={r["record_id"]:r for r in pmc}
    raw_hashes={}
    rows=[]
    for r in context:
        key=(r["record_id"],r["question_id"]); c=class_index[key]
        raw=ROOT/r["raw_file"]
        if raw not in raw_hashes: raw_hashes[raw]=sha(raw)
        locator=pmc_index.get(r["record_id"],{})
        rows.append({
          "source":"pubmed","record_id":r["record_id"],"question_id":r["question_id"],"provider_id":r["pmid"],
          "title":r["title"],"abstract":r["abstract"],"authors":r["authors"],"year":r["year"],"venue":r["journal"],
          "publication_types":r["publication_types"],"doi":r["doi"],"source_url":r["pubmed_url"],
          "classification":c["classification"],"observability":"abstract_observed" if r["abstract"].strip() else "title_metadata_only",
          "fulltext_locator_status":"pmc_identifier_candidate" if locator else "no_public_pmc_identifier_observed",
          "fulltext_locator":locator.get("pmc_article_url",""),"raw_source_path":r["raw_file"],"raw_source_sha256":raw_hashes[raw],
          "extracted_effect_value":"","extracted_effect_status":"not_extracted_by_protocol_v2_map",
          "decision_authority":"ai_exploratory_only","clinical_claim_allowed":"false","status":"source_bound_bibliographic_map",
        })
    nonpub_hash=sha(NONPUB)
    for r in nonpub:
        rows.append({
          "source":r["source"],"record_id":r["record_id"],"question_id":r["question_id"],"provider_id":r["provider_id"],
          "title":r["title"],"abstract":"","authors":"","year":"","venue":r["source"],"publication_types":"registry_or_index_record",
          "doi":"","source_url":r["source_url"],"classification":r["classification"],"observability":"title_metadata_only",
          "fulltext_locator_status":"not_observed","fulltext_locator":"","raw_source_path":NONPUB.relative_to(ROOT).as_posix(),
          "raw_source_sha256":nonpub_hash,"extracted_effect_value":"","extracted_effect_status":"not_extracted_by_protocol_v2_map",
          "decision_authority":"ai_exploratory_only","clinical_claim_allowed":"false","status":"source_bound_bibliographic_map",
        })
    rows.sort(key=lambda r:(r["source"],r["question_id"],r["record_id"]))
    with OUTPUT.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
    source_counts=Counter(r["source"] for r in rows); class_counts=Counter(r["classification"] for r in rows)
    payload={"schema_version":"1.0.0","protocol_version":"2.0-ai-exploratory","status":"complete_source_bound_descriptive_map",
      "row_count":len(rows),"source_counts":dict(sorted(source_counts.items())),"classification_counts":dict(sorted(class_counts.items())),
      "abstract_observed":sum(r["observability"]=="abstract_observed" for r in rows),
      "title_metadata_only":sum(r["observability"]=="title_metadata_only" for r in rows),
      "pmc_locator_record_question_rows":sum(r["fulltext_locator_status"]=="pmc_identifier_candidate" for r in rows),
      "unique_records_with_pmc_identifier":len({r["record_id"] for r in rows if r["fulltext_locator_status"]=="pmc_identifier_candidate"}),
      "unique_raw_source_files":len({r["raw_source_path"] for r in rows}),"effect_values_extracted":0,"clinical_claims":0,
      "inputs":{p.relative_to(ROOT).as_posix():sha(p) for p in (CONTEXT,CLASSES,PMC,NONPUB)},
      "output_path":OUTPUT.relative_to(ROOT).as_posix(),"output_sha256":sha(OUTPUT),"meta_analysis_allowed":False,"grade_allowed":False}
    MANIFEST.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:payload[k] for k in ("row_count","source_counts","abstract_observed","pmc_locator_record_question_rows","unique_records_with_pmc_identifier")},ensure_ascii=False));return 0
if __name__=="__main__":raise SystemExit(main())
