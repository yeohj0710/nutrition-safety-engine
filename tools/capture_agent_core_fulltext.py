#!/usr/bin/env python3
"""Retrieve PMC XML for tier-1 core candidates; no eligibility assessment."""
import csv, gzip, hashlib, json, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
QUEUE=ROOT/"research/review_queue/agent_fulltext_research_priority.csv"
PMC=ROOT/"data/interim/pmc_fulltext_candidates.csv"
OUT=ROOT/"research/fulltext/agent_core_fulltext"
ENDPOINT="https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
def text(node): return " ".join("".join(node.itertext()).split()) if node is not None else ""
def sha(b): return hashlib.sha256(b).hexdigest()
def main():
    with QUEUE.open(encoding="utf-8-sig",newline="") as f:
        tier=[r for r in csv.DictReader(f) if r["priority_tier"]=="tier_1_public_fulltext_core" or (r["question_id"]=="A2" and r["priority_tier"]=="tier_3_public_fulltext_picos")]
    with PMC.open(encoding="utf-8-sig",newline="") as f: pmc_index={r["record_id"]:r for r in csv.DictReader(f)}
    expected={pmc_index[r["record_id"]]["pmcid"]:r for r in tier}; ids=[x.removeprefix("PMC") for x in expected]
    query=urllib.parse.urlencode({"db":"pmc","id":",".join(ids),"retmode":"xml","tool":"nutrition_safety_research"})
    req=urllib.request.Request(f"{ENDPOINT}?{query}",headers={"User-Agent":"nutrition-safety-research/1.0"})
    with urllib.request.urlopen(req,timeout=120) as response: raw=response.read(); status=response.status
    root=ET.fromstring(raw); articles=root.findall(".//article") if root.tag!="article" else [root]
    OUT.mkdir(parents=True,exist_ok=True); stored=gzip.compress(raw,compresslevel=9,mtime=0)
    (OUT/"pmc_core_batch.xml.gz").write_bytes(stored)
    rows=[]
    for article in articles:
        ids_found={n.get("pub-id-type",""):text(n) for n in article.findall(".//article-id")}
        pmcid=ids_found.get("pmcid") or ids_found.get("pmc") or ""
        if pmcid and not pmcid.startswith("PMC"): pmcid="PMC"+pmcid
        q=expected.get(pmcid); body=article.find("body")
        if not q: continue
        normalized=text(body)
        rows.append({"record_id":q["record_id"],"question_id":q["question_id"],"pmid":q["pmid"],"pmcid":pmcid,
          "title":text(article.find(".//article-title")),"body_present":str(body is not None).lower(),
          "body_paragraphs":len(body.findall(".//p")) if body is not None else 0,
          "body_text_sha256":sha(normalized.encode()) if normalized else "","retrieval_authority":"agent_source_capture_only",
          "human_fulltext_verified":"","human_eligibility_decision":""})
    rows.sort(key=lambda r:(r["question_id"],r["pmid"]))
    with (OUT/"articles.csv").open("w",encoding="utf-8",newline="") as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator="\n");w.writeheader();w.writerows(rows)
    manifest={"schema_version":"1.0.0","status":"agent_core_and_a2_gap_fulltext_capture_complete_eligibility_open","endpoint":ENDPOINT,
      "selection":"all tier_1_public_fulltext_core plus A2 tier_3_public_fulltext_picos",
      "requested":len(ids),"returned":len(rows),"http_status":status,"body_present":sum(r["body_present"]=="true" for r in rows),
      "raw_file":"pmc_core_batch.xml.gz","raw_gzip_sha256":sha(stored),"raw_xml_sha256":sha(raw),
      "human_fulltext_verified":0,"human_eligibility_decisions":0,"final_inclusion_claim_allowed":False}
    (OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(manifest,ensure_ascii=False,indent=2)); return 0 if len(rows)==len(ids) else 1
if __name__=="__main__": raise SystemExit(main())
