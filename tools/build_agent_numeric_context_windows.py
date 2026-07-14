#!/usr/bin/env python3
"""Add adjacent PMC sentences to numeric candidates with incomplete context."""
import csv,gzip,hashlib,json,re
import xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/"research/fulltext/agent_core_fulltext"
SOURCE=BASE/"agent_numeric_result_context.csv";RAW=BASE/"pmc_core_batch.xml.gz";OUT=BASE/"agent_numeric_context_windows.csv";SUMMARY=ROOT/"research/synthesis/agent_numeric_context_windows_summary.json"
GROUP=re.compile(r"placebo|control|intervention|treatment|exposure|supplement|intake|diet|dose|group|patients?|participants?|\bmen\b|\bwomen\b|\bman\b|\bwoman\b|records?|case",re.I)
TIME=re.compile(r"\b\d+(?:\.\d+)?\s*(?:hour|day|week|month|year)s?\b|baseline|follow[- ]?up|daily|previous months?",re.I)
OUTCOME=re.compile(r"bleeding|hemorrhage|INR|coagulation|thrombosis|kidney stones?|renal stones?|nephrolithiasis|urolithiasis|hypercalciuria|hypercalcemia|oxalate nephropathy|hyperoxaluria|urinary (?:calcium|oxalate)",re.I)
LOC=re.compile(r"article\[pmcid='([^']+)'\]/body//p\[(\d+)\]/sentence\[(\d+)\]")
def text(n):return " ".join("".join(n.itertext()).split())
def sentences(t):return [s.strip() for s in re.split(r"(?<=[.!?])\s+",t) if s.strip()]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 with SOURCE.open(encoding="utf-8-sig",newline="") as f:rows=list(csv.DictReader(f))
 root=ET.fromstring(gzip.decompress(RAW.read_bytes()));index={}
 for article in root.findall(".//article") if root.tag!="article" else [root]:
  ids={n.get("pub-id-type",""):text(n) for n in article.findall(".//article-id")};pmcid=ids.get("pmcid") or ids.get("pmc") or ""
  if pmcid and not pmcid.startswith("PMC"):pmcid="PMC"+pmcid
  body=article.find("body")
  if body is None:continue
  paras=[sentences(text(p)) for p in body.findall(".//p")]
  for ppos,ss in enumerate(paras,1):
   for spos,s in enumerate(ss,1):
    prev=ss[spos-2] if spos>1 else (paras[ppos-2][-1] if ppos>1 and paras[ppos-2] else "")
    nxt=ss[spos] if spos<len(ss) else (paras[ppos][0] if ppos<len(paras) and paras[ppos] else "")
    index[(pmcid,ppos,spos)]=(prev,s,nxt)
 out=[]
 for r in rows:
  match=LOC.fullmatch(r["xml_locator"]);key=(match.group(1),int(match.group(2)),int(match.group(3))) if match else None
  prev,current,nxt=index.get(key,("",r["source_sentence"],""));window=" ".join(x for x in (prev,current,nxt) if x)
  g=sorted(set(m.group(0) for m in GROUP.finditer(window)),key=str.lower);t=sorted(set(m.group(0) for m in TIME.finditer(window)),key=str.lower);o=sorted(set(m.group(0) for m in OUTCOME.finditer(window)),key=str.lower)
  status="context_window_complete_candidate" if g and o else "context_still_incomplete_manual_review"
  out.append({**r,"previous_sentence":prev,"next_sentence":nxt,"window_group_signals":"|".join(g),"window_timepoint_signals":"|".join(t),"window_outcome_signals":"|".join(o),"window_context_status":status,"window_sha256":hashlib.sha256(window.encode()).hexdigest(),"context_window_authority":"agent_context_window_only"})
 with OUT.open("w",encoding="utf-8-sig",newline="") as f:w=csv.DictWriter(f,fieldnames=list(out[0]));w.writeheader();w.writerows(out)
 before=sum(r["context_completeness"]=="candidate_context_present" for r in rows);after=sum(r["window_context_status"]=="context_window_complete_candidate" for r in out)
 payload={"schema_version":"1.0.0","status":"adjacent_context_windows_complete_human_verification_open","candidates":len(out),"complete_before":before,"complete_after":after,"newly_contextualized":after-before,"still_incomplete":len(out)-after,"human_verified":0,"effect_estimates_usable":0,"input":{"path":SOURCE.relative_to(ROOT).as_posix(),"sha256":sha(SOURCE)},"raw":{"path":RAW.relative_to(ROOT).as_posix(),"sha256":sha(RAW)},"output":{"path":OUT.relative_to(ROOT).as_posix(),"sha256":sha(OUT)}}
 SUMMARY.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");print(json.dumps(payload,ensure_ascii=False,indent=2));return 0
if __name__=="__main__":raise SystemExit(main())
