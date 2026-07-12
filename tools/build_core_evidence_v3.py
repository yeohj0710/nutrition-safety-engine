#!/usr/bin/env python3
from pathlib import Path
import pandas as pd,json,hashlib,re
R=Path(__file__).resolve().parents[1]; D=R/"research/systematic_review_v3"; d=pd.read_csv(D/"picos_extraction.csv").fillna("")
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
 if re.search(r"\b(infant|infants|child|children|pediatric|paediatric|adolescent|neonat\w*|newborn|pregnan\w*|mouse|mice|murine|rat|rats|canine|dog|dogs|frog|frogs|bovine|swine|pig|pigs)\b",t):return False
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
 cites=[{"record_id":x.record_id,"title":x.title,"doi":x.doi,"url":x.source_url,"locator":x.evidence_locator,"dose":x.dose_extracted,"outcome":x.outcome_evidence} for _,x in g.head(5).iterrows()]
 rules.append({"question_id":q,**meta[q],"output":"확인 항목과 근거 문헌을 표시하고 복용 시작·중단·용량 변경은 지시하지 않는다.","evidence":cites,"status":"automated_evidence_linked_personalized_check"})
(D/"personalized_rules.json").write_text(json.dumps(rules,ensure_ascii=False,indent=2),encoding="utf-8")
man={"core_records":len(core),"per_question":core.groupby('question_id').size().to_dict(),"rules":len(rules),"source_sha256":hashlib.sha256((D/'picos_extraction.csv').read_bytes()).hexdigest()};(D/"core_manifest.json").write_text(json.dumps(man,ensure_ascii=False,indent=2),encoding="utf-8");print(json.dumps(man,ensure_ascii=False))
