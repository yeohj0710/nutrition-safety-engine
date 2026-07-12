#!/usr/bin/env python3
"""연구계획서 PICOS에 맞춘 재현 가능한 자동 선별·근거 추출 v3."""
from pathlib import Path
import pandas as pd, re, json, hashlib

R=Path(__file__).resolve().parents[1]; inp=R/"data/curated_v2/evidence_map.csv"; out=R/"research/systematic_review_v3"; out.mkdir(exist_ok=True)
Q={
"A1":{"supp":[r"vitamin\s*k",r"phylloquinone",r"menaquinone"],"pop":[r"warfarin",r"vitamin k antagonist",r"anticoag"],"out":[r"\binr\b",r"bleed",r"hemorrhag",r"coagulat",r"thrombo"]},
"A2":{"supp":[r"omega[- ]?3",r"fish oil",r"eicosapentaenoic",r"docosahexaenoic",r"\bepa\b",r"\bdha\b"],"pop":[r"warfarin",r"anticoag",r"apixaban",r"rivaroxaban",r"dabigatran"],"out":[r"bleed",r"hemorrhag",r"\binr\b",r"coagulat",r"platelet"]},
"B1":{"supp":[r"calcium",r"calcium supplement"],"pop":[r"kidney stone",r"renal stone",r"nephrolith",r"urolith",r"hypercalciur"],"out":[r"stone",r"nephrolith",r"urolith",r"hypercalciur",r"urinary calcium"]},
"B2":{"supp":[r"vitamin\s*d",r"cholecalciferol",r"ergocalciferol"],"pop":[r"kidney stone",r"renal stone",r"nephrolith",r"urolith",r"hypercalciur",r"hypercalcemia"],"out":[r"stone",r"nephrolith",r"urolith",r"hypercalciur",r"hypercalcemia",r"urinary calcium"]},
"B3":{"supp":[r"vitamin\s*c",r"ascorbic acid",r"ascorbate"],"pop":[r"kidney stone",r"renal stone",r"nephrolith",r"urolith",r"hyperoxalur"],"out":[r"stone",r"nephrolith",r"urolith",r"oxalat",r"hyperoxalur"]}}
DES=[r"random",r"trial",r"cohort",r"case.control",r"cross.section",r"systematic review",r"meta.analysis",r"guideline",r"observational",r"case report"]
DOSE=re.compile(r"\b(?:\d+(?:\.\d+)?(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?)\s*(?:mg|mcg|µg|ug|g|IU|international units?|mg/day|g/day|µg/day)\b",re.I)
def hit(text,pats):return any(re.search(p,text,re.I) for p in pats)
def sentences(text):return [x.strip() for x in re.split(r"(?<=[.!?])\s+",text) if x.strip()]
d=pd.read_csv(inp,low_memory=False).fillna(""); rows=[]
for _,r in d.iterrows():
 q=r.question_id
 if q not in Q or not r.abstract:continue
 text=f"{r.title}. {r.abstract}"; spec=Q[q]
 if re.search(r"\b(canine|dog|dogs|rat|rats|mouse|mice|murine|bovine|swine|pig|veterinary)\b",text,re.I) and not re.search(r"\b(human|patient|patients|men|women|adult|adults|participant|participants)\b",text,re.I):continue
 signals={k:hit(text,v) for k,v in spec.items()}; design=hit(text,DES)
 if not all(signals.values()):continue
 ss=sentences(text); ev=[s for s in ss if hit(s,spec["supp"]) and (hit(s,spec["pop"]) or hit(s,spec["out"]))]
 if q=="A1":
  exposure=[s for s in ss if re.search(r"vitamin\s*k",s,re.I) and re.search(r"supplement|intake|diet|dose|administ|oral|daily|receive|given|status|deficien",s,re.I)]
  ev=[s for s in ev if s in exposure]
 if not ev:ev=[s for s in ss if hit(s,spec["out"])][:2]
 if q=="A1" and not exposure:continue
 if q in {"B1","B2","B3"} and not re.search(r"supplement|intake|dietary|oral|dose|administ|receive|given|consumption",text,re.I):continue
 if not any(hit(s,spec["supp"]) and hit(s,spec["out"]) for s in ss):continue
 doses=sorted(set(DOSE.findall(text)))
 pop_s=[s for s in ss if hit(s,spec["pop"])][:2]; out_s=[s for s in ss if hit(s,spec["out"])][:3]
 rows.append({"question_id":q,"record_id":r.record_id,"provider_id":r.provider_id,"title":r.title,"year":r.year,"doi":r.doi,"source_url":r.source_url,"publication_types":r.publication_types,"automated_eligibility":"include_candidate" if design else "include_candidate_design_unclear","population_evidence":" | ".join(pop_s),"supplement":Q[q]["supp"][0].replace("\\s*"," ").replace("\\b",""),"dose_extracted":" | ".join(doses),"outcome_evidence":" | ".join(out_s),"evidence_locator":"ABSTRACT: "+" | ".join(ev[:3]),"fulltext_locator":r.fulltext_locator,"human_screened":False,"extraction_authority":"automated_from_observed_title_abstract"})
o=pd.DataFrame(rows).drop_duplicates(["question_id","provider_id"]); csv=out/"picos_extraction.csv";o.to_csv(csv,index=False,encoding="utf-8")
summary={"protocol":"research-plan-aligned systematic evidence review v3","input":str(inp.relative_to(R)),"input_sha256":hashlib.sha256(inp.read_bytes()).hexdigest(),"records":len(o),"by_question":o.groupby('question_id').size().to_dict(),"with_dose":int((o.dose_extracted!='').sum()),"with_fulltext_locator":int((o.fulltext_locator!='').sum()),"human_screened":False,"limitations":["Automated title/abstract screening; no independent human duplicate screening","Extracted evidence must retain sentence locator","No effect estimate is imputed"]}
(out/"manifest.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8");print(json.dumps(summary,ensure_ascii=False))
