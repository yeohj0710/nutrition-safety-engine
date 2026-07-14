#!/usr/bin/env python3
"""Extract source-bound evidence sentences from captured PMC body XML."""
from __future__ import annotations
import csv, gzip, hashlib, json, re
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/"research/fulltext/agent_core_fulltext"
ARTICLES=BASE/"articles.csv"; RAW=BASE/"pmc_core_batch.xml.gz"
OUT=BASE/"agent_fulltext_evidence.csv"; SUMMARY=ROOT/"research/synthesis/agent_fulltext_evidence_summary.json"
TERMS={
 "A1":{"exposure":[r"vitamin\s*k",r"phylloquinone",r"menaquinone"],"population":[r"warfarin",r"vitamin k antagonist",r"anticoag"],"outcome":[r"\binr\b",r"bleed",r"hemorrhag",r"coagulat",r"thrombo"]},
 "A2":{"exposure":[r"omega[- ]?3",r"fish oil",r"eicosapentaenoic",r"docosahexaenoic",r"\bepa\b",r"\bdha\b",r"icosapent"],"population":[r"warfarin",r"anticoag",r"apixaban",r"rivaroxaban",r"dabigatran"],"outcome":[r"bleed",r"hemorrhag",r"\binr\b",r"coagulat",r"platelet"]},
 "B1":{"exposure":[r"calcium"],"population":[r"kidney stone",r"renal stone",r"nephrolith",r"urolith",r"hypercalciur"],"outcome":[r"stone",r"nephrolith",r"urolith",r"hypercalciur",r"urinary calcium"]},
 "B2":{"exposure":[r"vitamin\s*d",r"cholecalciferol",r"ergocalciferol"],"population":[r"kidney stone",r"renal stone",r"nephrolith",r"urolith",r"hypercalciur",r"hypercalcemia"],"outcome":[r"stone",r"nephrolith",r"urolith",r"hypercalciur",r"hypercalcemia",r"urinary calcium"]},
 "B3":{"exposure":[r"vitamin\s*c",r"ascorbic acid",r"ascorbate"],"population":[r"kidney stone",r"renal stone",r"nephrolith",r"urolith",r"hyperoxalur",r"oxalate nephrop"],"outcome":[r"stone",r"nephrolith",r"urolith",r"oxalat",r"hyperoxalur",r"renal failure",r"kidney injury"]},
}
DOSE=re.compile(r"(?<![\d,])(?:\d{1,3}(?:[ ,]\d{3})+|\d+(?:\.\d+)?)(?:\s*(?:-|to)\s*(?:\d{1,3}(?:[ ,]\d{3})+|\d+(?:\.\d+)?))?\s*(?:mg|mcg|μg|ug|g|IU|international units?)(?:/day| per day| daily)?",re.I)
def norm(node): return " ".join("".join(node.itertext()).split())
def sha(b): return hashlib.sha256(b).hexdigest()
def hits(text,pats): return sorted({m.group(0) for p in pats for m in re.finditer(p,text,re.I)},key=str.lower)
def sentences(text): return [s.strip() for s in re.split(r"(?<=[.!?])\s+",text) if s.strip()]
def main():
 with ARTICLES.open(encoding="utf-8",newline="") as f: meta={r["pmcid"]:r for r in csv.DictReader(f)}
 raw=gzip.decompress(RAW.read_bytes()); root=ET.fromstring(raw); rows=[]
 articles=root.findall(".//article") if root.tag!="article" else [root]
 for article in articles:
  ids={n.get("pub-id-type",""):norm(n) for n in article.findall(".//article-id")}; pmcid=ids.get("pmcid") or ids.get("pmc") or ""
  if pmcid and not pmcid.startswith("PMC"): pmcid="PMC"+pmcid
  info=meta.get(pmcid); body=article.find("body")
  if not info or body is None: continue
  spec=TERMS[info["question_id"]]; parent={c:p for p in article.iter() for c in p}
  for pos,p in enumerate(body.findall(".//p"),1):
   para=norm(p); ancestor=parent.get(p)
   while ancestor is not None and ancestor.tag not in {"sec","body"}: ancestor=parent.get(ancestor)
   section=norm(ancestor.find("title")) if ancestor is not None and ancestor.tag=="sec" else ""
   for sent_pos,sentence in enumerate(sentences(para),1):
    exposure=hits(sentence,spec["exposure"]); population=hits(sentence,spec["population"]); outcome=hits(sentence,spec["outcome"]); doses=DOSE.findall(sentence)
    if not exposure or not (population or outcome or doses): continue
    evidence_type="exposure_outcome" if outcome else "exposure_population" if population else "exposure_dose"
    rows.append({"record_id":info["record_id"],"question_id":info["question_id"],"pmid":info["pmid"],"pmcid":pmcid,
      "section_title":section,"paragraph_position":pos,"sentence_position":sent_pos,
      "xml_locator":f"article[pmcid='{pmcid}']/body//p[{pos}]/sentence[{sent_pos}]","evidence_type":evidence_type,
      "matched_exposure_terms":"|".join(exposure),"matched_population_terms":"|".join(population),"matched_outcome_terms":"|".join(outcome),
      "dose_mentions":"|".join(doses),"evidence_sentence":sentence,"sentence_sha256":sha(sentence.encode()),
      "extraction_authority":"agent_fulltext_extraction_only","human_verified":"","eligibility_claim":"false","effect_estimate_claim":"false"})
 rows.sort(key=lambda r:(r["question_id"],r["pmid"],r["paragraph_position"],r["sentence_position"]))
 fields=["record_id","question_id","pmid","pmcid","section_title","paragraph_position","sentence_position","xml_locator","evidence_type","matched_exposure_terms","matched_population_terms","matched_outcome_terms","dose_mentions","evidence_sentence","sentence_sha256","extraction_authority","human_verified","eligibility_claim","effect_estimate_claim"]
 with OUT.open("w",encoding="utf-8-sig",newline="") as f: w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
 byq=defaultdict(Counter)
 for r in rows: byq[r["question_id"]][r["evidence_type"]]+=1
 payload={"schema_version":"1.0.0","status":"agent_fulltext_sentence_extraction_complete_human_verification_open",
  "source_articles_with_body":sum(r["body_present"]=="true" for r in meta.values()),"articles_with_evidence":len({r["record_id"] for r in rows}),
  "evidence_sentences":len(rows),"by_question":{q:dict(sorted(byq[q].items())) for q in sorted(byq)},
  "sentences_with_dose":sum(bool(r["dose_mentions"]) for r in rows),"human_verified_sentences":0,"human_eligibility_decisions":0,
  "rob_completed":0,"grade_completed":0,"clinical_conclusion_allowed":False,
  "inputs":{"articles_sha256":sha(ARTICLES.read_bytes()),"raw_xml_sha256":sha(raw)},"output":{"path":OUT.relative_to(ROOT).as_posix(),"sha256":sha(OUT.read_bytes())}}
 SUMMARY.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(payload,ensure_ascii=False,indent=2)); return 0
if __name__=="__main__": raise SystemExit(main())
