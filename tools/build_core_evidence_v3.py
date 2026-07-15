#!/usr/bin/env python3
from pathlib import Path
from xml.etree import ElementTree as ET
import pandas as pd,json,hashlib,re
R=Path(__file__).resolve().parents[1]; D=R/"research/systematic_review_v3"; d=pd.read_csv(D/"picos_extraction.csv").fillna("")
translations_payload=json.loads((D/"key_finding_translations_ko.json").read_text(encoding="utf-8"))
key_finding_translations=translations_payload["translations"]
key_finding_overrides=translations_payload.get("source_overrides",{})

def clean_text(value):
 return re.sub(r"\s+"," ",value or "").strip()

def excerpt(value):
 text=clean_text(value)
 sentences=[clean_text(x) for x in re.split(r"(?<=[.!?])\s+",text) if len(clean_text(x))>=30]
 finding=re.compile(r"\b(?:associated|correlated|increased|decreased|higher|lower|significant|risk|incidence|effect|found|observed|showed|returned|improved|reduced|predict\w*|result\w*|caus\w*|develop\w*|report\w*|induc\w*|led)\b",re.I)
 exposure=re.compile(r"\b(?:vitamin|ascorb|calcium|fish oil|omega.?3|warfarin|anticoag)\b",re.I)
 outcome=re.compile(r"\b(?:stone|oxalat|bleed|hemorrhag|inr|hypercalci|kidney|renal|coagulat)\w*\b",re.I)
 methods=re.compile(r"\b(?:objective|purpose|aim|methods?|participants?|randomized|evaluate|assess|investigate|determine)\b",re.I)
 def score(sentence):
  return 6*bool(re.search(r"\b(?:in conclusion|we conclude|concluded)\b",sentence,re.I))+4*bool(finding.search(sentence))+3*bool(exposure.search(sentence))+2*bool(outcome.search(sentence))+2*bool(re.search(r"\b(?:no|not)\b",sentence,re.I))+bool(re.search(r"\d",sentence))-5*bool(methods.search(sentence))
 selected=max(sentences,key=score) if sentences else text
 return selected if len(selected)<=280 else selected[:277].rstrip()+"…"

def pubmed_key_findings():
 findings={}
 for path in R.glob("research/searches/*/pubmed/**/*.xml"):
  try: root=ET.parse(path).getroot()
  except ET.ParseError: continue
  for article in root.findall(".//PubmedArticle"):
   pmid=clean_text(article.findtext(".//MedlineCitation/PMID"))
   if not pmid: continue
   sections=[]
   for node in article.findall(".//MedlineCitation/Article/Abstract/AbstractText"):
    text=clean_text("".join(node.itertext()))
    if text: sections.append((str(node.attrib.get("Label","")).upper(),text))
   preferred=next((text for label,text in sections if "CONCL" in label),"")
   rank=3 if preferred else 0
   if not preferred:
    preferred=next((text for label,text in sections if "RESULT" in label),"")
    rank=2 if preferred else 0
   if not preferred:
    preferred=" ".join(text for _,text in sections)
    rank=1 if preferred else 0
   if preferred and (pmid not in findings or rank>findings[pmid][0]): findings[pmid]=(rank,excerpt(preferred))
 return {pmid:value for pmid,(_,value) in findings.items()}

key_findings=pubmed_key_findings()
def score(r):
 t=(r.title+" "+r.publication_types).lower();s=0
 s+=8 if "systematic review" in t or "meta-analysis" in t else 0
 s+=6 if "random" in t or "clinical trial" in t else 0
 s+=4 if any(x in t for x in ["cohort","case-control","prospective"]) else 0
 s+=3 if r.dose_extracted else 0;s+=3 if r.fulltext_locator else 0;s+=2 if r.doi else 0
 s+=min(len(r.outcome_evidence)//250,3)
 if r.question_id=="A1":
  s+=10 if re.search(r"vitamin k|phylloquinone|menaquinone",r.title,re.I) else -8
  s+=5 if re.search(r"intake|supplement|dose|administr",r.title,re.I) else 0
 if r.question_id=="A2":
  s+=10 if re.search(r"omega.?3|fish oil|eicosapentaenoic|docosahexaenoic",r.title,re.I) else -8
  s+=5 if re.search(r"warfarin|anticoag|bleed|hemost",r.title,re.I) else 0
 return s
d["priority_score"]=d.apply(score,axis=1);core=d.sort_values(["question_id","priority_score","year"],ascending=[True,False,False]).groupby("question_id").head(30)
def title_direct(r):
 t=r.title.lower()
 scope_text=f"{r.title} {r.venue} {r.population_evidence}".lower()
 if re.search(r"\b(infant\w*|child\w*|pediatric|paediatric|adolescen\w*|juvenile|neonat\w*|newborn|pregnan\w*|mouse|mice|murine|rat|rats|canine|dog|dogs|frog|frogs|bovine|swine|pig|pigs|chick\w*|poultry|rabbit\w*|sheep|lamb\w*|monkey\w*|hamster\w*|guinea pig\w*)\b|first year of life",scope_text):return False
 if r.question_id=="A1":
  if re.search(r"non-vitamin k antagonist|vitamin k antagonist (?:vs|versus)",t) and not re.search(r"dietary|intake|supplement|vitamin k1|phylloquinone|menaquinone",t):return False
  if re.search(r"reversal|reverses|reverse |over.?anticoag|over-warfarin|coagulopathy|supratherapeutic|excessive anticoag|hypoprothrombin",t):return False
  exposure=bool(re.search(r"dietary vitamin k|vitamin k intake|vitamin k1? supplement|vitamin k supplementation|multivitamin|anticoagulation (?:control|stability)|anticoagulant stability",t))
  return bool(exposure and re.search(r"warfarin|vitamin k antagonist|anticoag|inr",t))
 if r.question_id=="A2":return bool(re.search(r"omega.?3|fish oil|eicosapentaenoic|docosahexaenoic|\bepa\b|\bdha\b",t) and re.search(r"warfarin|anticoag|apixaban|rivaroxaban|dabigatran|edoxaban",t) and re.search(r"bleed|hemorrhag|inr|coagulat|platelet|pharmacokinetic|pharmacodynamic",t))
 if r.question_id=="B1":return bool(re.search(r"oral calcium|dietary calcium|calcium (?:supplement|intake|diet|restriction|fortified|carbonate|citrate)|supplemented with calcium|milk|mineral water containing calcium",t) and re.search(r"stone|nephrolith|urolith|hypercalciur",t))
 if r.question_id=="B2":return bool(re.search(r"vitamin d|cholecalciferol|ergocalciferol",t) and re.search(r"stone|nephrolith|urolith|hypercalciur|hypercalcemia|urine calcium",t) and re.search(r"supplement|repletion|intake|dose|administr|taking|therapy|treatment",t))
 return bool(re.search(r"vitamin c|ascorb",t) and re.search(r"stone|nephrolith|urolith|oxalat|hyperoxalur",t))
d=d[d.apply(title_direct,axis=1)].copy()
core=d.sort_values(["question_id","priority_score","year"],ascending=[True,False,False]).groupby("question_id").head(30)
core.to_csv(D/"core_evidence.csv",index=False,encoding="utf-8")
rules=[]
meta={"A1":{"ingredient":"vitamin K","medication":"warfarin or vitamin K antagonist","condition":"anticoagulation","checks":["recent vitamin K intake change","dose and formulation","recent INR and stability"]},"A2":{"ingredient":"omega-3/fish oil","medication":"oral anticoagulant","condition":"bleeding risk","checks":["daily EPA+DHA dose","bleeding history","concurrent antiplatelet or NSAID"]},"B1":{"ingredient":"calcium","medication":"","condition":"kidney stone or hypercalciuria","checks":["supplement dose","dietary calcium","stone type and urine calcium"]},"B2":{"ingredient":"vitamin D","medication":"","condition":"kidney stone, hypercalciuria, or hypercalcemia","checks":["daily dose","25(OH)D","serum and urine calcium"]},"B3":{"ingredient":"vitamin C","medication":"","condition":"kidney stone or hyperoxaluria","checks":["daily dose","stone history","urine oxalate or renal impairment"]}}
for q,g in core.groupby("question_id"):
 def cite(x):
  pmid=re.sub(r"\D","",str(x.provider_id))
  key_finding=key_finding_overrides.get(x.record_id) or key_findings.get(pmid) or excerpt(x.outcome_evidence)
  return {"record_id":x.record_id,"title":x.title,"authors":x.authors,"venue":x.venue,"year":int(float(x.year)) if x.year!="" else None,"doi":x.doi,"url":x.source_url,"locator":x.evidence_locator,"dose":x.dose_extracted,"outcome":x.outcome_evidence,"key_finding":key_finding,"key_finding_ko":key_finding_translations.get(x.record_id,"").strip(),"publication_types":x.publication_types,"population":x.population_evidence,"priority_score":int(x.priority_score)}
 all_cites=[cite(x) for _,x in g.iterrows()]
 rules.append({"question_id":q,**meta[q],"output":"전체 핵심 후보를 보존하고 입력 연관도로 상위 근거를 동적으로 선정한다.","evidence":all_cites[:5],"all_evidence":all_cites,"status":"automated_evidence_linked_personalized_check"})
(D/"personalized_rules.json").write_text(json.dumps(rules,ensure_ascii=False,indent=2),encoding="utf-8")
man={"core_records":len(core),"per_question":core.groupby('question_id').size().to_dict(),"rules":len(rules),"source_sha256":hashlib.sha256((D/'picos_extraction.csv').read_bytes()).hexdigest()};(D/"core_manifest.json").write_text(json.dumps(man,ensure_ascii=False,indent=2),encoding="utf-8");print(json.dumps(man,ensure_ascii=False))
