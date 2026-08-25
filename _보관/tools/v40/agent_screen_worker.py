from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "research" / "screening" / "v40_agent"
INDEX_PATH = BASE / "batch_index.json"
PROMPT_PATH = BASE / "prompts" / "screening_prompt.md"
DECISION_DIR = BASE / "decisions"
AUDIT_DIR = BASE / "audit"
ADJUDICATION_PATH = BASE / "semantic_adjudications.json"
CORPUS_PATH = ROOT / "data" / "curated_v4" / "evidence_map.csv"
WORKER_VERSION = "v40_deterministic_text_assist_3.3.0"

# The first worker used unbounded nutrient fragments (for example, ``choline``
# inside ``acetylcholine``) and treated any background mention of "human" as a
# clinical study.  These patterns deliberately separate strong supplement
# exposures, contextual nutrient administration, and direct clinical evidence.
STRONG_EXPOSURE_RE = re.compile(
    r"\b(?:dietary|food|nutrition(?:al)?|micronutrient|vitamin|mineral|herbal|herb|"
    r"botanical|plant[- ]based) supplements?\b|\bsupplement(?:ation|ed|ing|s)?\b|"
    r"\b(?:herbal medicines?|herbal remedies|herbal products?|plant extracts?|"
    r"plant preparations?|botanical products?|phytotherap\w*|phytomedicin\w*|"
    r"nutraceut\w*|natural health products?|multivitamins?|multiminerals?|"
    r"oral nutritional supplements?|ONS)\b|"
    r"\b(?:fish oils?|omega[- ]?3(?: fatty acids?)?|docosahexaenoic acid|"
    r"eicosapentaenoic acid|(?-i:DHA|EPA)|probiotics?|prebiotics?|synbiotics?|"
    r"coenzyme Q10|CoQ10|ubiquinone|ubidecarenone|glucosamine|chondroitin|"
    r"ginkgo(?: biloba)?|ginseng|panax(?: ginseng| quinquefolius)?|garlic|"
    r"allium sativum|curcumin|turmeric|ginger|zingiber officinale|hypericum|"
    r"st\.? john'?s wort|saint john'?s wort|kava|valerian|echinacea|ephedra|"
    r"ma huang|saw palmetto|serenoa repens|ashwagandha|cranberry|"
    r"vaccinium macrocarpon|milk thistle|silymarin|licorice|liquorice|"
    r"glycyrrhiza|astragalus|aristoloch\w*|black cohosh|blue cohosh|"
    r"evening primrose|raspberry leaf|kratom|garcinia|red yeast rice|usnic acid|"
    r"feverfew|dong quai|angelica sinensis|danshen|salvia miltiorrhiza|"
    r"red clover|grape seed|resveratrol|quercetin|bromelain|chamomile|"
    r"cinnamon|hawthorn(?: fruit)?|nattokinase|natto|citrus aurantium|moringa oleifera|"
    r"green tea extracts?|s[- ]?adenosylmethionine|(?-i:SAMe)|"
    r"herbalife|hydroxycut|oxyelite|lipokinetix|centrum|elevit|pregnacare|"
    r"pregvit|tebonin|kyolic|ginsana|pycnogenol|sensoril|ksm[- ]?66|"
    r"metamucil|omacor|lovaza|tinospora(?: cordifolia| crispa)?|gynura(?: segetum)?|"
    r"polygonum multiflorum|jujube|ziziphus jujuba)\b",
    re.IGNORECASE,
)
SUPPLEMENT_FORM_RE = re.compile(
    r"\b(?:dietary|food|nutrition(?:al)?|micronutrient|vitamin|mineral|herbal|herb|"
    r"botanical|plant[- ]based|oral nutritional) supplements?\b|"
    r"\bsupplement(?:ation|ed|ing|s)?\b|\b(?:capsules?|tablets?|extracts?|"
    r"formulations?|over[- ]the[- ]counter|nonprescription|non-prescription)\b",
    re.IGNORECASE,
)
NUTRIENT_RE = re.compile(
    r"\b(?:vitamins?\s*[A-EK]?|vitamin\s+B(?:1|2|3|5|6|7|9|12)|folic acid|"
    r"folate|methylfolate|folinic acid|iron|ferrous\w*|calcium|magnesium|"
    r"potassium|zinc|selenium|iodine|iodide|retinol|beta[- ]carotene|"
    r"cyanocobalamin|cobalamin|pyridoxine|ascorbic acid|choline|inositol|"
    r"tocopherol|phylloquinone|menaquinone)\b",
    re.IGNORECASE,
)
ADMINISTRATION_RE = re.compile(
    r"\b(?:supplement(?:ation|ed|ing)?|administer(?:ed|ing)?|administration|received|given|"
    r"taking|took|treated with|therapy|intervention|exposure|use of|users? of|"
    r"consum(?:ed|ption)|intake|dose[ds]?|dosing|capsules?|tablets?|oral(?:ly)?|"
    r"over[- ]the[- ]counter|OTC)\b",
    re.IGNORECASE,
)
ORDINARY_DIET_RE = re.compile(
    r"\b(?:diet(?:ary)? quality|dietary diversity|dietary patterns?|food patterns?|food consumption|"
    r"food frequency|24\s*(?:h|hour)[- ]recall|dietary recalls?|ordinary diet|"
    r"whole grains?|fruit and vegetable|vegetables?|food intake|nutrient intake|"
    r"nutrient content|iodine nutrition|phosphate intake|phosphorus intake|"
    r"vegetarian|plant[- ]based diet|dietary fatty acids?|"
    r"dietary (?!supplement)[^.]{0,60} intake)\b",
    re.IGNORECASE,
)
ALTERNATIVE_EXPOSURE_RE = re.compile(
    r"\b(?:tobacco|smoking|cigarettes?|alcohol|acupuncture|electroacupuncture|"
    r"acupressure|moxibustion|massage|music therapy|hypnosis|yoga|"
    r"phototherap\w*|radiotherap\w*|chemotherap\w*|propofol|dexmedetomidine|"
    r"isotretinoin|progesterone|"
    r"device|implant|pulp capping materials?|dental materials?|contrast media|"
    r"lipiodol|embolization|embolisation|prescription drug|pharmaceutical)\b",
    re.IGNORECASE,
)
NON_I_SUPPLEMENT_RE = re.compile(
    r"\b(?:progesterone|oxygen|fluid|saline|infant formula|milk|hormone|enzyme|"
    r"dexmedetomidine|propofol|parenteral nutrition|antithrombin|"
    r"fresh frozen plasma|FFP|blood product) supplement\w*\b|"
    r"\bsupplement\w*\s+(?:with\s+|of\s+)?(?:antithrombin|fresh frozen plasma|FFP|"
    r"blood products?)\b",
    re.IGNORECASE,
)
POSTPARTUM_RE = re.compile(
    r"\b(?:post[- ]?partum|postnatal|lactation|lactating|breastfeeding|nursing mothers?)\b",
    re.IGNORECASE,
)
PREGNANCY_TIME_RE = re.compile(
    r"\b(?:pregnan(?:cy|cies|t)|antenatal(?:ly)?|prenatal(?:ly)?|"
    r"perinatal|maternal|pre[- ]?conception(?:al|ally)?|(?:first|second|third) trimester)\b|"
    r"\bgestational\b(?!\s+age\b)|\bduring (?:early |late |the )?(?:pregnancy|gestation)\b",
    re.IGNORECASE,
)
BIOMARKER_TITLE_RE = re.compile(
    r"\b(?:serum|plasma|blood|circulating|urinary|fecal|faecal|tissue)\b.*\b(?:level|status|"
    r"concentration|deficien\w*|metabolism|homeostasis|biomarker)|"
    r"\b(?:vitamin|mineral|magnesium|calcium|iron|folate|zinc|selenium)\w* status\b",
    re.IGNORECASE,
)
ENDOGENOUS_NUTRIENT_RE = re.compile(
    r"\b(?:hypomagnesemia|hypermagnesemia|circulatory imbalance|trace element levels?|"
    r"nutrient status|vitamin status|mineral status|serum (?:magnesium|calcium|iron|"
    r"zinc|selenium|vitamin)|plasma (?:magnesium|calcium|iron|zinc|selenium|vitamin))\b",
    re.IGNORECASE,
)
NON_ORAL_ROUTE_RE = re.compile(
    r"\b(?:intravenous|intramuscular|subcutaneous|parenteral|infusion|injection|"
    r"topical|transdermal|eye ?drops?|ophthalmic|ointment|cream|gel|mouthwash|"
    r"local application|implant|intra[- ]?socket)\b",
    re.IGNORECASE,
)
ORAL_ROUTE_RE = re.compile(r"\b(?:oral(?:ly)?|by mouth|capsules?|tablets?|drink|decoction)\b", re.IGNORECASE)
HRS2_RX_RE = re.compile(
    r"\b(?:sodium thiosulfate|cinacalcet|etelcalcetide|paricalcitol|doxercalciferol|"
    r"maxacalcitol|alfacalcidol|ferumoxytol|sodium zirconium cyclosilicate|patiromer|"
    r"sevelamer|lanthanum carbonate|sucroferric oxyhydroxide|ferric citrate|"
    r"denosumab|bisphosphonate|zoledronate|anti[- ]?tuberculous|phosphate binders?|"
    r"HIF[- ]?PHI|hypoxia[- ]inducible factor prolyl hydroxylase inhibitors?|"
    r"citrate anticoagulation)\b",
    re.IGNORECASE,
)
HRS4_RX_DILI_RE = re.compile(
    r"\b(?:anti[- ]?tuberculosis|antituberculosis|isoniazid|rifampin|rifampicin|"
    r"pyrazinamide|ceftaroline|valproic acid|valproate|acetaminophen|paracetamol|"
    r"amoxicillin|clavulanate|methotrexate|statins?|chemotherapy|checkpoint inhibitor)\b",
    re.IGNORECASE,
)
HRS4_EXISTING_RE = re.compile(
    r"\b(?:pre[- ]?existing|underlying|chronic|advanced|end[- ]stage|decompensated) "
    r"(?:liver|hepatic) diseases?|\bliver (?:disease|cirrhosis|fibrosis|cancer)|"
    r"\bhepatic (?:disease|fibrosis|steatosis)|\bcirrho(?:sis|tic)|"
    r"\bchronic hepatitis|\bhepatitis [BC]\b|\bHBV\b|\bHCV\b|"
    r"\b(?:alcoholic|alcohol[- ]related|alcohol[- ]associated) liver disease|"
    r"\bNAFLD\b|\bNASH\b|\bMASLD\b|\bMASH\b|\bMAFLD\b|"
    r"\bautoimmune hepatitis|\bprimary (?:biliary|sclerosing) cholangitis|"
    r"\bPBC\b|\bPSC\b|\bportal hypertension|\bWilson'?s? disease|"
    r"\bh(?:ae|e)mochromatosis|\bhepatocellular carcinoma",
    re.IGNORECASE,
)
HRS4_INJURY_RE = re.compile(
    r"\b(?:hepatotox\w*|(?:drug|herb|supplement)[- ]induced liver injury|DILI|HILI|"
    r"(?:acute )?(?:liver|hepatic) injur\w*|(?:liver|hepatic) failure|acute hepatitis|jaundice)\b",
    re.IGNORECASE,
)
PROTECTIVE_DIRECTION_RE = re.compile(
    r"\b(?:prevent\w*|protect\w*|ameliorat\w*|attenuat\w*|alleviat\w*|"
    r"treat\w*|manage\w*|reduc\w*|improv\w*)\b",
    re.IGNORECASE,
)
GENETIC_TESTING_RE = re.compile(
    r"\b(?:prenatal|preimplantation)(?: and (?:prenatal|preimplantation))? genetic testing\b|"
    r"\bprenatal diagnosis\b|\bprenatal testing\b[^.]*",
    re.IGNORECASE,
)
HRS5_LUPUS_RE = re.compile(r"\blupus anticoagulants?\b", re.IGNORECASE)
HRS5_MATERIAL_RE = re.compile(
    r"\b(?:recombinant heparin|heparin production|heparin[- ](?:poloxamer|coated|"
    r"conjugate|binding|mimetic|hydrogel|nanogel|scaffold|sepharose|sulfate))\b",
    re.IGNORECASE,
)
HRS5_REVERSAL_RE = re.compile(
    r"\b(?:phytonadione|vitamin K)\b.{0,100}\b(?:reversal|reverse|antidote|"
    r"coagulopathy|overdose|poisoning)\b|\b(?:reversal|antidote|coagulopathy|"
    r"overdose|poisoning)\b.{0,100}\b(?:phytonadione|vitamin K)\b",
    re.IGNORECASE,
)
HRS5_DRUG_COMPARISON_RE = re.compile(
    r"\b(?:versus|vs\.?|compared with|comparison of)\b.*\b(?:warfarin|apixaban|"
    r"rivaroxaban|edoxaban|dabigatran|heparin|enoxaparin|anticoagulan\w*|DOACs?|"
    r"NOACs?|VKAs?)\b|"
    r"\b(?:warfarin|apixaban|rivaroxaban|edoxaban|dabigatran|heparin|enoxaparin|"
    r"DOACs?|NOACs?|VKAs?)\b"
    r".*\b(?:versus|vs\.?|compared with)\b",
    re.IGNORECASE,
)
HUMAN_RE = re.compile(
    r"\bpatients?\b|\bparticipants?\b|\bsubjects?\b|\bhumans?\b|\bclinical\b|"
    r"\bcohort\b|\btrial\b|\bcase reports?\b|\bcase series\b|\bmen\b|\bwomen\b|"
    r"\badults?\b|\bchildren\b|\binfants?\b|pregnan\w*|maternal|persons?|people|"
    r"volunteers?|hospital|outpatients?|inpatients?",
    re.IGNORECASE,
)
DIRECT_CLINICAL_RE = re.compile(
    r"\b(?:we (?:enrolled|recruited|randomi[sz]ed|followed)|"
    r"(?:patients?|participants?|subjects?|women|men|adults?|children) were|"
    r"(?:enrolled|recruited|included|randomi[sz]ed) \d+|\d+[ -](?:patients?|"
    r"participants?|subjects?|women|men|adults?|children)|case report|case series|"
    r"clinical trial|population[- ]based|prospective cohort|retrospective cohort)\b",
    re.IGNORECASE,
)
PRECLINICAL_RE = re.compile(
    r"\b(?:mice|mouse|rats?|murine|rodents?|rabbits?|zebrafish|bovine|porcine|"
    r"canine|feline|drosophila|xenografts?|animal models?|in vitro|ex vivo|"
    r"cell lines?|cultured cells?|cell culture|in silico|molecular docking|"
    r"organoids?|bioreactor|engineered cells?)\b",
    re.IGNORECASE,
)
HARD_PRECLINICAL_TITLE_RE = re.compile(
    r"\b(?:in vitro|in silico|ex vivo|molecular docking|cell lines?|cell culture|"
    r"organoids?|bioreactor|mammalian cells?|engineered cells?)\b",
    re.IGNORECASE,
)
PRECLINICAL_METHOD_RE = re.compile(
    r"\b(?:(?:mice|rats?|rabbits?|animals?) (?:were|received|were given|were fed|"
    r"were injected|were divided|were treated)|(?:mouse|rat|murine|animal) model|"
    r"cells? (?:were|was) (?:cultured|treated|incubated|exposed)|in vitro|ex vivo|"
    r"human (?:cells?|hepatocytes?|macrophages?|organoids?|tissues?))\b",
    re.IGNORECASE,
)
DESIGN_RE = re.compile(
    r"randomi[sz]|trial|cohort|case.control|cross.section|registry|surveillance|"
    r"pharmacovigilance|case report|case series|systematic review|meta.analysis|"
    r"retrospective|prospective|observational|guideline|review",
    re.IGNORECASE,
)
GENERIC_OUTCOME_RE = re.compile(
    r"\b(?:safety|safe|well[- ]tolerated|adverse(?: events?| effects?| outcomes?| reactions?)?|toxic(?:ity|ities)?|"
    r"side effects?|harms?|harmful|complications?|mortality|deaths?|"
    r"hospitali[sz](?:ation|ed|ations)?|emergency department|discontinu\w*|"
    r"withdrawal|intoler\w*|overdose|poison\w*|contraindicat\w*|interactions?|"
    r"laboratory abnormal\w*|serious events?)\b",
    re.IGNORECASE,
)
EFFICACY_ONLY_RE = re.compile(
    r"\b(?:efficacy|effectiveness|benefit|improv(?:e|ed|ement)|ameliorat\w*|"
    r"protective effect|treatment effect|treatment of|treating|prevention|adherence|quality of life|"
    r"symptom score|performance|recovery|length of stay|nutritional status|"
    r"weight loss|postoperative sleep|sleep quality|sleep disturbance|inflammatory (?:factors?|markers?)|"
    r"metabolic effects?|immune cells?|myeloid|T lymphocytes?)\b",
    re.IGNORECASE,
)

P_RE = {
    "HRS1_PERIOPERATIVE": re.compile(
        r"\bsurger\w*|\bsurgical\b|\boperati(?:on|ve)\w*|peri.?oper|pre.?oper|"
        r"post.?oper|\banesth|\banaesth|endoscop|biops|catheteri[sz]|cesarean|"
        r"caesarean|operating room|invasive procedure|transplant(?:ation)?|"
        r"radiofrequency ablation|cryoablation|internal fixation|external fixation",
        re.IGNORECASE,
    ),
    "HRS2_KIDNEY_DISEASE": re.compile(
        r"kidney|renal|dialys|dialyz|hemodial|haemodial|peritoneal dialysis|\bckd\b|"
        r"\besrd\b|\beskd\b|uremi|uraemi|nephropath|kidney failure|renal failure",
        re.IGNORECASE,
    ),
    "HRS3_PREGNANCY": re.compile(
        r"pregnan|gestation|maternal|antenatal|prenatal|perinatal|fetal|foetal|fetus|"
        r"foetus|in utero|intra.?uterine|obstetric|trimester|gravida",
        re.IGNORECASE,
    ),
    "HRS4_LIVER_DISEASE": re.compile(
        r"\bliver\b|hepatic|hepatit|cirrho|steato|fatty liver|\bnafld\b|\bnash\b|"
        r"\bmasld\b|\bmash\b|cholang|portal hypertension|wilson disease|"
        r"hemochrom|haemochrom|hepatotox|drug.induced liver|herb.induced liver|\bdili\b|\bhili\b",
        re.IGNORECASE,
    ),
    "HRS5_ANTICOAGULATION": re.compile(
        r"warfarin|coumadin|jantoven|acenocoumarol|nicoumalone|phenprocoumon|"
        r"fluindione|phenindione|dicou?marol|apixaban|rivaroxaban|edoxaban|dabigatran|"
        r"betrixaban|ximelagatran|heparin|enoxaparin|dalteparin|tinzaparin|nadroparin|"
        r"bemiparin|certoparin|\bdoacs?\b|\bnoacs?\b|\bvkas?\b|\blmwh\b|\bufh\b|"
        r"factor xa inhibitor|direct thrombin inhibitor|oral anticoagulan|"
        r"vitamin[- ]?K antagonist therapy|vitamin K antagonist therapy|"
        r"anticoagulat(?:ed|ion therapy|ion treatment)|receiv(?:e|ed|ing) anticoagulan|"
        r"anticoagulant (?:use|users?|therapy|treatment)",
        re.IGNORECASE,
    ),
}
O_RE = {
    "HRS1_PERIOPERATIVE": re.compile(
        r"bleed|hemorr|haemorr|transfus|coag|interaction|anesth.*effect|anaesth.*effect|"
        r"perioperative complication|postoperative complication|surgical complication|"
        r"micronutrient deficien|vitamin deficien|mineral deficien|anemi|anaemi|"
        r"osteoporosis|cardiomyopathy|non[- ]?adherence|hypocalcemi|readmission|"
        r"ischemic colitis|ischaemic colitis|phlebosclerotic colitis|"
        r"colorectal mucosal injur",
        re.IGNORECASE,
    ),
    "HRS2_KIDNEY_DISEASE": re.compile(
        r"hyperkal|hypercal|electrolyte|nephrotox|kidney injur|renal injur|cardiovascular|"
        r"arrhythm|calcification|oxalat|accumulat|uremic symptom|uraemic symptom|"
        r"catheter occlu|occlud\w*.{0,30}catheter",
        re.IGNORECASE,
    ),
    "HRS3_PREGNANCY": re.compile(
        r"\bcongenital|\bterat(?:ogen|ogenic|ogenicity|ology)\w*|\bmalformation|"
        r"\banomal(?:y|ies|ous)|\bmiscar|\babortion|\bstillbirth|\bpreterm|"
        r"\bprematur(?:e birth|ity)|birth defect|low birth weight|growth restriction|maternal complication|"
        r"neonatal complication|fetal complication|foetal complication|preeclamps|eclamps|"
        r"calcium[- ]alkali syndrome|acute pancreatitis|bacteremia|sepsis|"
        r"childhood wheez|offspring wheez|childhood asthma|offspring asthma|"
        r"atopic dermatitis",
        re.IGNORECASE,
    ),
    "HRS4_LIVER_DISEASE": re.compile(
        r"hepatotox|liver injur|hepatic injur|liver failure|hepatic failure|decompens|"
        r"acute hepatitis|"
        r"(?:elevat|increas|worsen|abnormal).{0,40}(?:aminotransferase|\balt\b|\bast\b|bilirubin)|"
        r"jaundice|transplant|\bdili\b|\bhili\b",
        re.IGNORECASE,
    ),
    "HRS5_ANTICOAGULATION": re.compile(
        r"bleed|hemorr|haemorr|thrombo|embol|\binr\b|"
        r"\bcoagulation (?:test|tests|parameter|parameters|profile|change|changes|abnormalit\w*)|"
        r"prothrombin|\bpt\b|\baptt\b|"
        r"interaction|pharmacokinetic|cyp2c9|cyp3a4|p.glycoprotein|p.?gp",
        re.IGNORECASE,
    ),
}
EDITORIAL_TYPES = (
    "Editorial", "News", "Comment", "Published Erratum", "Retracted Publication",
    "Retraction Notice", "Expression of Concern",
)
TERMINAL_TYPES = {"published erratum", "retracted publication", "retraction notice", "expression of concern"}
COMMENTARY_TYPES = {"editorial", "news", "comment", "letter"}
DESIGN_PUBLICATION_TYPES = {
    "clinical trial", "clinical trial protocol", "controlled clinical trial",
    "randomized controlled trial", "observational study", "comparative study",
    "case reports", "systematic review", "meta-analysis", "review",
    "guideline", "practice guideline", "multicenter study",
}
EDITORIAL_TITLE_RE = re.compile(
    r"\b(?:statement of retraction|retraction notice|retracted:|withdrawn:|"
    r"expression of concern|published erratum|correction to:|corrigendum(?: to|:)|"
    r"erratum(?: to|:))\b",
    re.IGNORECASE,
)
PEDIATRIC_RE = re.compile(r"\b(?:pediatric|paediatric|children|child|infant|adolescent|neonat\w*|newborn)\b", re.IGNORECASE)
ADULT_RE = re.compile(r"\b(?:adults?|elderly|aged|men|women)\b", re.IGNORECASE)
NEONATAL_ONLY_RE = re.compile(
    r"\b(?:neonat|newborn|preterm infant|premature infant|NICU|"
    r"necrotizing enterocolitis|necrotising enterocolitis)\w*\b",
    re.IGNORECASE,
)
ANTIPLATELET_RE = re.compile(r"\b(?:antiplatelet|aspirin|clopidogrel|prasugrel|ticagrelor)\b", re.IGNORECASE)
REVIEW_RE = re.compile(r"\b(?:review|guideline|consensus|position statement)\b", re.IGNORECASE)
VITAMIN_K_MECHANISM_RE = re.compile(
    r"\b(?:vitamin K antagonists?|vitamin K[- ]dependent|VKORC?1?|vitamin K epoxide|"
    r"vitamin K recycling|mechanism of warfarin)\b",
    re.IGNORECASE,
)

# v3 separates the article's foreground (objective, methods, results,
# conclusion, and case description) from introductory background.  The v2
# classifier counted every keyword in the abstract equally, which allowed a
# background mention of a supplement or target population to turn an
# unrelated study into a retain decision.
STRUCTURED_SECTION_RE = re.compile(
    r"(?im)^[ \t]*(BACKGROUND(?: AND (?:AIM|OBJECTIVE|PURPOSE))?|INTRODUCTION|"
    r"CONTEXT|RATIONALE|OBJECTIVES?|AIMS?|PURPOSE|METHODS?|MATERIALS(?: AND METHODS)?|"
    r"PATIENTS(?: AND METHODS)?|DESIGN|SETTING|PARTICIPANTS?|INTERVENTIONS?|"
    r"MEASUREMENTS?|MAIN OUTCOME MEASURES?|RESULTS?|FINDINGS|CASE PRESENTATION|"
    r"CASE REPORT|CLINICAL CHARACTERISTICS|MANAGEMENT|TREATMENT|DISCUSSION|"
    r"CONCLUSIONS?)\s*:\s*"
)
BACKGROUND_SECTION_PREFIXES = ("BACKGROUND", "INTRODUCTION", "CONTEXT", "RATIONALE")

V3_TRADITIONAL_EXPOSURE_RE = re.compile(
    r"\b(?:traditional Chinese (?:herbal )?medicine|Chinese (?:herbal|patent) medicines?|"
    r"Chinese medicine|TCM (?:formula|"
    r"formulation|decoction|medicine|treatment|regimen)|Kampo medicine|"
    r"myo[- ]?inositol|inositol|glycyrrhizin preparations?)\b|"
    r"\b(?:herbal|botanical|traditional medicine) (?:medications?|formula(?:tion)?|capsules?|"
    r"preparations?|treatment|therapy|use|usage)\b|\b(?:modified )?[A-Za-z]+ decoction\b|"
    r"\b[A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){1,4}\s+(?:Tang|Wan|San)\b",
    re.IGNORECASE,
)
V3_VITAMIN_K_NOISE_RE = re.compile(
    r"\b(?:non[- ]vitamin[- ]?K(?:[- ]dependent)?|vitamin[- ]?K[- ]?antagonists?|"
    r"vitamin K antagonists?|antagonists? of vitamin K|vitamin K[- ]dependent|"
    r"vitamin K epoxide|vitamin K recycling|VKORC?1?)\b",
    re.IGNORECASE,
)
V3_COMMENTARY_TITLE_RE = re.compile(
    r"^(?:re:\s*|response by|response to|a response to|respond to|reply(?: to)?|"
    r"letter by|letter regarding|comments? on|commentary:|EBNEO commentary:|"
    r"comment on|commentary on)|\b(?:author'?s reply|response to the editor|"
    r"retraction|retracted|corrigendum|erratum|expression of concern)\b|"
    r"\[(?:letter|comment)\][\s.]*$",
    re.IGNORECASE,
)
V3_NONCLINICAL_TITLE_RE = re.compile(
    r"\b(?:mice|mouse|rats?|murine|rodents?|rabbits?|zebrafish|gilts?|sows?|"
    r"cows?|bovine|porcine|dairy farms?|animal models?|in vitro|in silico|ex vivo|"
    r"network pharmacology|bioinformatics|molecular docking|cell lines?|cell culture|"
    r"cultured cells?|scaffolds?|tissue engineering|nanoparticles?|biomaterials?|"
    r"adsorption|wastewater|materials? engineering|mineralization|apatites?|"
    r"hydroxyapatite|chemical synthesis|fabrication|spectrum[- ]effect analysis|"
    r"HepG2|HepaRG|Huh7|trophoblasts?|mesenchymal stem cells?|hamsters?|"
    r"hepatic stellate cells?|human macrophages?|xenografts?|"
    r"ion channels?|molecular interactions?)\b",
    re.IGNORECASE,
)
V3_NONCLINICAL_BODY_RE = re.compile(
    r"\b(?:mice|mouse|rats?|murine|rodents?|rabbits?|zebrafish|gilts?|sows?|"
    r"cows?|bovine|porcine|animal models?|in vitro|in silico|ex vivo|"
    r"network pharmacology|bioinformatics|molecular docking|cell lines?|cell culture|"
    r"cultured cells?|cells? (?:were|was) (?:cultured|treated|incubated|exposed)|"
    r"bacterial (?:culture|extracts?|growth)|engineered cells?|organoids?|macrophages?|"
    r"HepG2|HepaRG|trophoblasts?|mesenchymal stem cells?|hamsters?|"
    r"(?:kidney|renal|tubular|endothelial|epithelial|hepatic|human) cells?|scaffolds?|"
    r"tissue engineering|nanoparticles?|biomaterials?)\b",
    re.IGNORECASE,
)
V3_DIRECT_HUMAN_STUDY_RE = re.compile(
    r"\b(?:we (?:enrolled|recruited|randomi[sz]ed|followed|reviewed)|"
    r"(?:patients?|participants?|subjects?|pregnant women|adults?|children) (?:were|who|with)|"
    r"(?:enrolled|recruited|included|randomi[sz]ed) \d+|\d+[ -](?:patients?|"
    r"participants?|subjects?|women|men|adults?|children)|case report|case series|"
    r"clinical trial|prospective (?:study|cohort)|retrospective (?:study|cohort))\b",
    re.IGNORECASE,
)
V3_HUMAN_ENROLLMENT_RE = re.compile(
    r"\b(?:we (?:enrolled|recruited|randomi[sz]ed|followed|reviewed)|"
    r"(?:patients?|participants?|subjects?|pregnant women) (?:were|received|underwent)|"
    r"(?:enrolled|recruited|included|randomi[sz]ed) \d+|\d+[ -](?:patients?|"
    r"participants?|subjects?|pregnant women)|n\s*=\s*\d+[^.;]{0,50}(?:patients?|"
    r"participants?|subjects?|women)|case report|case series|clinical trial|"
    r"prospective (?:study|cohort)|retrospective (?:study|cohort))\b",
    re.IGNORECASE,
)
V3_DIRECT_SAFETY_RE = re.compile(
    r"\b(?:safety|safe|tolerab\w*|adverse (?:events?|effects?|outcomes?|reactions?)|"
    r"no adverse events?|toxicit\w*|hepatotox\w*|bleed\w*|hemorrh\w*|haemorrh\w*|"
    r"transfus\w*|poison\w*|overdose|contraindicat\w*|drug interactions?|"
    r"supplement interactions?|hospitali[sz]\w*|withdraw\w*|"
    r"treatment errors?|complication rates?|serious events?|potential risk)\b",
    re.IGNORECASE,
)
V3_EFFICACY_ENDPOINT_RE = re.compile(
    r"\b(?:efficacy|effectiveness|effects? of|therapeutic (?:effect|potential)|curative effect|"
    r"treatment effect|management of|improv\w*|ameliorat\w*|attenuat\w*|regulat\w*|"
    r"protective effect|prevention of|activity|activities|"
    r"inflammatory (?:markers?|factors?)|oxidative stress|immune cells?|"
    r"myeloid|T lymphocytes?|sustained attention|cognition|"
    r"proteinuria|albuminuria|liver enzyme activity|physiological alterations|"
    r"biomarkers?|serum levels?|plasma levels?|pulse waveforms?|symptom burden|"
    r"wellbeing|appetite|tiredness|bone mass)\b",
    re.IGNORECASE,
)
V3_ALTERNATIVE_TITLE_RE = re.compile(
    r"\b(?:aromatherapy|hypnosis|acupuncture|electroacupuncture|acupressure|"
    r"moxibustion|massage|music therapy|sun exposure|self[- ]testing|"
    r"point[- ]of[- ]care testing|medical device|diagnostic (?:test|efficacy|utility)|"
    r"screening|assay|reference interval|reticulocyte hemoglobin|hemoglobin trend|"
    r"elastography|radial pulse|microbiome|genetic testing|prenatal testing|"
    r"community meals?|meal supplementation|ordinary diet|diet quality|"
    r"knowledge[- ]transfer|curriculum|training|education|course|coffee|caffeine|"
    r"breathing exercises?|physical therapy|electrical stimulation|"
    r"transcutaneous electrical)\b",
    re.IGNORECASE,
)
V3_NEGATED_LIVER_RE = re.compile(
    r"\b(?:without|no|absence of|free of)\b[^.;]{0,60}\b(?:liver|hepatic) (?:disease|"
    r"dysfunction|injury|failure)\b",
    re.IGNORECASE,
)
V3_PREGNANCY_HUMAN_RE = re.compile(
    r"\b(?:pregnant (?:women|patients?|participants?)|women (?:who were )?pregnant|"
    r"maternal (?:supplementation|exposure|intake|use|outcomes?)|during pregnancy|"
    r"in pregnancy|pregnancies|trimester|antenatal|periconceptional)\b",
    re.IGNORECASE,
)
V3_BROAD_INTERACTION_CONTEXT_RE = re.compile(
    r"\b(?:diet|dietary|food|nutrition|herbal|botanical|supplement|complementary medicine|"
    r"drug interactions?|lifestyle factors?)\b",
    re.IGNORECASE,
)
V3_NONTHERAPEUTIC_SUPPLEMENT_RE = re.compile(
    r"\bsupplement(?:ing|ed)?\s+(?:instruction|instructions|information|education|"
    r"training|teaching|curriculum|feedback|explanation|materials?)\b|"
    r"\bsupplementary (?:data|material|materials|appendix|information)\b",
    re.IGNORECASE,
)

# Phrases that describe an institution or a diagnostic/cultural framework are
# not evidence that a participant received a traditional medicine product.
V3_INSTITUTIONAL_TRADITIONAL_RE = re.compile(
    r"\b(?:hospital|department|school|college|university|academy|institute|ward|"
    r"center|centre|clinic)\b[^.;]{0,90}\b(?:traditional Chinese medicine|TCM)\b|"
    r"\b(?:traditional Chinese medicine|TCM)\b[^.;]{0,90}\b(?:hospital|department|"
    r"school|college|university|academy|institute|ward|center|centre|clinic)\b",
    re.IGNORECASE,
)
V3_NONEXPOSURE_FOCUS_RE = re.compile(
    r"\b(?:bibliometric|curriculum|education|training|course|knowledge[- ]transfer|"
    r"practice patterns?|current practices?|views and experiences|providers?|"
    r"physicians?|pharmacists?|surgeons?|candidate (?:drug|medicine|herb)|"
    r"Mendelian randomization|syndrome classification|tongue imag(?:e|es|ing)|"
    r"diagnostic imag(?:e|es|ing)|prediction model|risk model|food composition|"
    r"nutrient content|levels? in (?:foods?|vegetables?|serum|plasma|urine|feces|faeces))\b",
    re.IGNORECASE,
)
V3_HRS5_THERAPEUTIC_VITAMIN_K_RE = re.compile(
    r"\b(?:vitamin K1?|phytonadione)\b[^.;]{0,140}\b(?:administered|given|treated|"
    r"therapy|management|reversal|antidote|coagulopathy|overdose|poisoning|rodenticide)\b|"
    r"\b(?:reversal|antidote|coagulopathy|overdose|poisoning|rodenticide)\b[^.;]{0,140}"
    r"\b(?:vitamin K1?|phytonadione)\b",
    re.IGNORECASE,
)
V3_SAFETY_EVALUATION_RE = re.compile(
    r"\b(?:adverse events? (?:were|was) (?:monitored|recorded|assessed)|"
    r"(?:safety|tolerability) (?:was|were|is) (?:assessed|evaluated|comparable)|"
    r"incidence of adverse (?:events?|reactions?)|no (?:reported )?(?:adverse events?|safety concerns?)|"
    r"(?:lower|higher|reduced|increased) complication rates?|"
    r"(?:caused|induced|attributed to|associated with|secondary to).{0,80}"
    r"(?:injury|failure|toxicity|syndrome|bleeding|hemorrhage|haemorrhage)|"
    r"safety considerations|risk of (?:toxicity|bleeding|hemorrhage|haemorrhage|"
    r"adverse|benzene exposure|hyperkal\w*|calcification))\b",
    re.IGNORECASE,
)


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@lru_cache(maxsize=1)
def load_semantic_adjudications() -> dict[tuple[str, str], dict[str, Any]]:
    """Load frozen agent-reviewed corrections for sampled edge records."""
    if not ADJUDICATION_PATH.exists():
        return {}
    payload = json.loads(ADJUDICATION_PATH.read_text(encoding="utf-8"))
    if payload.get("prompt_sha256") != sha256_file(PROMPT_PATH):
        raise RuntimeError("semantic adjudication prompt hash mismatch")
    if payload.get("corpus_sha256") != sha256_file(CORPUS_PATH):
        raise RuntimeError("semantic adjudication corpus hash mismatch")
    allowed_decisions = {"retain", "deprioritize", "uncertain"}
    allowed_confidence = {"high", "medium", "low"}
    allowed_basis = {"abstract", "title_only"}
    allowed_reasons = {
        "population", "exposure", "outcome", "human_signal", "design_signal",
        "animal_term_present", "off_topic", "insufficient_abstract",
    }
    result: dict[tuple[str, str], dict[str, Any]] = {}
    for item in payload.get("records", []):
        key = (str(item.get("question_id", "")), str(item.get("record_id", "")))
        reasons = item.get("reason_codes", [])
        if (
            not key[0]
            or not key[1]
            or key in result
            or item.get("decision") not in allowed_decisions
            or item.get("confidence") not in allowed_confidence
            or item.get("evidence_basis") not in allowed_basis
            or item.get("status") != "ok"
            or not isinstance(reasons, list)
            or not reasons
            or len(reasons) != len(set(reasons))
            or not set(reasons) <= allowed_reasons
        ):
            raise RuntimeError(f"invalid semantic adjudication: {key}")
        result[key] = item
    if len(result) != payload.get("record_count"):
        raise RuntimeError("semantic adjudication record count mismatch")
    return result


def load_index() -> dict[str, Any]:
    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    if sha256_file(PROMPT_PATH) != index["prompt_sha256"]:
        raise RuntimeError("frozen prompt hash mismatch")
    return index


def _reason_codes(*, p: bool, i: bool, o: bool, human: bool, design: bool, animal_only: bool, off_topic: bool, insufficient: bool) -> list[str]:
    codes: list[str] = []
    for value, code in (
        (p, "population"), (i, "exposure"), (o, "outcome"), (human, "human_signal"),
        (design, "design_signal"), (animal_only, "animal_term_present"),
        (off_topic, "off_topic"), (insufficient, "insufficient_abstract"),
    ):
        if value:
            codes.append(code)
    return codes or ["off_topic"]


def _has_contextual_nutrient_exposure(text: str) -> bool:
    """Require administration/use context near an otherwise ambiguous nutrient."""
    for match in NUTRIENT_RE.finditer(text):
        left = max(0, match.start() - 90)
        right = min(len(text), match.end() + 90)
        if ADMINISTRATION_RE.search(text[left:right]):
            return True
    return False


def _is_nonclinical_only(title: str, abstract: str, publication_types: str) -> bool:
    if HARD_PRECLINICAL_TITLE_RE.search(title):
        return True
    title_preclinical = bool(PRECLINICAL_RE.search(title))
    title_clinical = bool(
        DIRECT_CLINICAL_RE.search(title)
        or re.search(r"\bpatients?|participants?|pregnant women|clinical (?:study|trial)\b", title, re.IGNORECASE)
    )
    if title_preclinical and not title_clinical:
        return True
    if not abstract:
        return False
    if "review" in publication_types.lower() or bool(REVIEW_RE.search(title)):
        return False
    methods_preclinical = bool(PRECLINICAL_METHOD_RE.search(abstract))
    direct_clinical = bool(
        title_clinical
        or DIRECT_CLINICAL_RE.search(f"{title} {abstract}")
        or re.search(
            r"\b(?:patients?|participants?)\b.{0,100}\b(?:received|were given|"
            r"were treated|were assigned|were randomi[sz]ed|completed|underwent)\b|"
            r"\brandomi[sz]ed\b.{0,100}\b(?:patients?|participants?)\b",
            abstract,
            re.IGNORECASE,
        )
    )
    return methods_preclinical and not direct_clinical


def _concepts_near(text: str, first: re.Pattern[str], second: re.Pattern[str], distance: int = 900) -> bool:
    first_matches = list(first.finditer(text))
    second_matches = list(second.finditer(text))
    return any(abs(a.start() - b.start()) <= distance for a in first_matches for b in second_matches)


def _question_flags(
    question_id: str,
    title: str,
    text: str,
    i: bool,
    strong_i: bool,
    contextual_i: bool,
) -> tuple[bool, bool, bool, bool]:
    """Return P plus explicit P-negative and explicit I-negative flags."""
    p = bool(P_RE[question_id].search(text))
    explicit_p_negative = False
    explicit_i_negative = False
    explicit_supplement_form = bool(SUPPLEMENT_FORM_RE.search(text))
    ordinary_diet_only = bool(ORDINARY_DIET_RE.search(text)) and not explicit_supplement_form
    alternative_only = bool(ALTERNATIVE_EXPOSURE_RE.search(title)) and not (strong_i or contextual_i)

    if question_id == "HRS1_PERIOPERATIVE":
        pediatric_only = bool(PEDIATRIC_RE.search(text)) and not bool(ADULT_RE.search(text))
        if pediatric_only:
            p = False
            explicit_p_negative = True
        nonoral_primary = bool(NON_ORAL_ROUTE_RE.search(title)) and not bool(ORAL_ROUTE_RE.search(title))
        biomarker_primary = bool(BIOMARKER_TITLE_RE.search(title) or ENDOGENOUS_NUTRIENT_RE.search(title)) and not explicit_supplement_form
        if nonoral_primary or biomarker_primary:
            i = False
            explicit_i_negative = True
        if "GENETIC COUNSELING:" in text and not bool(P_RE[question_id].search(title)):
            p = False
            explicit_p_negative = True
    elif question_id == "HRS2_KIDNEY_DISEASE":
        biomarker_primary = bool(BIOMARKER_TITLE_RE.search(title) or ENDOGENOUS_NUTRIENT_RE.search(title)) and not explicit_supplement_form
        food_primary = bool(ORDINARY_DIET_RE.search(title) or re.search(r"\bplant[- ]based milk\b", title, re.IGNORECASE)) and not explicit_supplement_form
        rx_primary = bool(HRS2_RX_RE.search(title)) and not bool(SUPPLEMENT_FORM_RE.search(title))
        overview_without_exposure = bool(re.search(r"\b(?:overview|pathophysiology)\b", title, re.IGNORECASE)) and not strong_i
        if biomarker_primary or food_primary or rx_primary or overview_without_exposure:
            i = False
            explicit_i_negative = True
    elif question_id == "HRS3_PREGNANCY":
        # Neonatal/paediatric supplementation without an explicit pregnancy or
        # maternal exposure is outside this question.
        pregnancy_text = GENETIC_TESTING_RE.sub("", text)
        pregnancy_title = GENETIC_TESTING_RE.sub("", title)
        maternal_link = i and _concepts_near(pregnancy_text, re.compile(r"\bmaternal\b", re.IGNORECASE), STRONG_EXPOSURE_RE, 250)
        pregnancy_core = bool(PREGNANCY_TIME_RE.search(pregnancy_text)) or maternal_link
        pregnancy_in_title = bool(PREGNANCY_TIME_RE.search(pregnancy_title)) or (
            i and _concepts_near(pregnancy_title, re.compile(r"\bmaternal\b", re.IGNORECASE), STRONG_EXPOSURE_RE, 160)
        )
        if not pregnancy_core and bool(P_RE[question_id].search(text)) and bool(GENETIC_TESTING_RE.search(text)):
            p = False
            explicit_p_negative = True
        else:
            p = pregnancy_core
        neonatal_only = bool(NEONATAL_ONLY_RE.search(text)) and not pregnancy_core
        pediatric_only = bool(PEDIATRIC_RE.search(title)) and not pregnancy_in_title
        if neonatal_only or pediatric_only:
            p = False
            explicit_p_negative = True
        postpartum_only = bool(POSTPARTUM_RE.search(title)) and not pregnancy_in_title
        if postpartum_only:
            p = False
            explicit_p_negative = True
        if p and i:
            exposure_linked = (
                maternal_link
                or _concepts_near(pregnancy_text, PREGNANCY_TIME_RE, STRONG_EXPOSURE_RE)
                or _concepts_near(pregnancy_text, PREGNANCY_TIME_RE, NUTRIENT_RE)
            )
            if not exposure_linked:
                i = False
                explicit_i_negative = True
    elif question_id == "HRS4_LIVER_DISEASE":
        existing_liver_disease = bool(HRS4_EXISTING_RE.search(text))
        injury = bool(HRS4_INJURY_RE.search(text))
        hds_in_title = bool(STRONG_EXPOSURE_RE.search(title))
        protective_title = hds_in_title and bool(PROTECTIVE_DIRECTION_RE.search(title))
        hds_caused_injury = i and injury and not protective_title
        p = existing_liver_disease or hds_caused_injury
        generic_rx_dili = bool(re.search(r"\bdrug[- ]induced liver injury\b", title, re.IGNORECASE))
        rx_dili_primary = (
            bool(HRS4_RX_DILI_RE.search(text) or generic_rx_dili)
            and not strong_i
        )
        biomarker_primary = bool(BIOMARKER_TITLE_RE.search(title)) and not explicit_supplement_form
        if rx_dili_primary or biomarker_primary:
            i = False
            explicit_i_negative = True
        if i and injury and protective_title and not existing_liver_disease:
            p = False
            explicit_p_negative = True
        gene_monograph_off_topic = (
            "GENETIC COUNSELING:" in text
            and not bool(
                HRS4_EXISTING_RE.search(title)
                or re.search(r"\b(?:autosomal recessive polycystic kidney disease|ARPKD)\b", title, re.IGNORECASE)
            )
        )
        if gene_monograph_off_topic:
            p = False
            explicit_p_negative = True
    elif question_id == "HRS5_ANTICOAGULATION":
        antiplatelet_only = bool(ANTIPLATELET_RE.search(text)) and not p
        generic_anticoagulant_review = bool(re.search(r"\banticoagulan\w*\b", text, re.IGNORECASE)) and bool(REVIEW_RE.search(text))
        if generic_anticoagulant_review:
            p = True
        if antiplatelet_only:
            explicit_p_negative = True
        if HRS5_LUPUS_RE.search(title) or HRS5_MATERIAL_RE.search(text):
            p = False
            explicit_p_negative = True
        if HRS5_REVERSAL_RE.search(text) and not bool(re.search(r"\bsupplement", text, re.IGNORECASE)):
            i = False
            explicit_i_negative = True
        antiplatelet_intervention = bool(ANTIPLATELET_RE.search(title)) and not i
        drug_comparison = bool(HRS5_DRUG_COMPARISON_RE.search(text)) and not i
        if antiplatelet_intervention or drug_comparison:
            explicit_i_negative = True

    explicit_i_negative = explicit_i_negative or ordinary_diet_only or alternative_only
    if ordinary_diet_only:
        i = False
    return p, i, explicit_p_negative, explicit_i_negative


def _foreground_text(abstract: str) -> tuple[str, bool]:
    """Return study-bearing sections and whether section labels were present."""
    matches = list(STRUCTURED_SECTION_RE.finditer(abstract))
    if not matches:
        return abstract, False
    sections: list[str] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(abstract)
        label = match.group(1).upper().strip()
        content = abstract[match.end():end].strip()
        if content and not label.startswith(BACKGROUND_SECTION_PREFIXES):
            sections.append(content)
    # A malformed abstract containing only a BACKGROUND label is still usable.
    return ("\n".join(sections) if sections else abstract), True


def _linked_exposure(text: str) -> bool:
    relation = re.compile(
        r"\b(?:administer(?:ed|ing|ation)?|received|given|taking|took|treated with|"
        r"supplement(?:ation|ed|ing)?|consum(?:ed|ption)|intake|dose[ds]?|dosing|"
        r"capsules?|tablets?|oral(?:ly)?|use|usage|users?|caused|induced|attributed|"
        r"associated|adverse|injury|toxicity|regimen|intervention)\b",
        re.IGNORECASE,
    )
    for pattern in (STRONG_EXPOSURE_RE, V3_TRADITIONAL_EXPOSURE_RE):
        for match in pattern.finditer(text):
            left = max(0, match.start() - 130)
            right = min(len(text), match.end() + 130)
            if relation.search(text[left:right]):
                return True
    return False


def _exposure_evidence(
    question_id: str,
    title: str,
    foreground: str,
    abstract: str,
    structured: bool,
) -> tuple[bool, bool]:
    """Return target-supplement PRESENT and explicit ABSENT."""
    title_clean = V3_INSTITUTIONAL_TRADITIONAL_RE.sub(
        "", V3_NONTHERAPEUTIC_SUPPLEMENT_RE.sub("", NON_I_SUPPLEMENT_RE.sub("", title))
    )
    foreground_clean = V3_INSTITUTIONAL_TRADITIONAL_RE.sub(
        "", V3_NONTHERAPEUTIC_SUPPLEMENT_RE.sub("", NON_I_SUPPLEMENT_RE.sub("", foreground))
    )
    if question_id == "HRS5_ANTICOAGULATION":
        title_clean = V3_VITAMIN_K_NOISE_RE.sub("", VITAMIN_K_MECHANISM_RE.sub("", title_clean))
        foreground_clean = V3_VITAMIN_K_NOISE_RE.sub("", VITAMIN_K_MECHANISM_RE.sub("", foreground_clean))
        title_clean = V3_HRS5_THERAPEUTIC_VITAMIN_K_RE.sub("", title_clean)
        foreground_clean = V3_HRS5_THERAPEUTIC_VITAMIN_K_RE.sub("", foreground_clean)

    title_i = bool(
        STRONG_EXPOSURE_RE.search(title_clean)
        or V3_TRADITIONAL_EXPOSURE_RE.search(title_clean)
        or _has_contextual_nutrient_exposure(title_clean)
        or re.search(r"\b(?:micronutrition|nutritional intervention)\b", title_clean, re.IGNORECASE)
    )
    foreground_i = bool(
        _linked_exposure(foreground_clean)
        or _has_contextual_nutrient_exposure(foreground_clean)
    )
    if structured:
        # Structured backgrounds commonly define a named formula once and use
        # only its acronym in objective/methods/results.  Carry that definition
        # forward only when the same acronym is used in the foreground.
        if not foreground_i and V3_TRADITIONAL_EXPOSURE_RE.search(abstract):
            definitions = re.findall(
                r"(?:traditional Chinese (?:herbal )?medicine|Chinese herbal medicine|"
                r"herbal (?:formula|formulation|medicine|treatment)|[A-Za-z -]+ decoction)"
                r"[^.;]{0,60}\(([A-Z][A-Z0-9-]{1,8})\)",
                abstract,
                re.IGNORECASE,
            )
            definitions.extend(
                re.findall(
                    r"\b[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,5}\s+"
                    r"(?:Tang|Wan|San|Decoction|Formula)\s*\(([A-Z][A-Z0-9-]{1,8})\)",
                    abstract,
                )
            )
            for acronym in definitions:
                if re.search(rf"\b{re.escape(acronym)}\b", foreground_clean):
                    foreground_i = True
                    break
    else:
        foreground_i = foreground_i or _linked_exposure(foreground_clean)
    i = title_i or foreground_i

    if question_id == "HRS3_PREGNANCY" and NUTRIENT_RE.search(title_clean) and re.search(
        r"\b(?:prevent|prevention of|reduce(?:s|d)? (?:the )?risk of)\b",
        title_clean,
        re.IGNORECASE,
    ):
        i = True
        title_i = True
    if question_id == "HRS3_PREGNANCY" and PREGNANCY_TIME_RE.search(title_clean) and NUTRIENT_RE.search(title_clean) and re.search(
        r"\b(?:trial|supplement(?:ation)?|antenatal|prenatal vitamin|prenatal mineral)\b",
        title_clean,
        re.IGNORECASE,
    ):
        i = True
        title_i = True

    explicit_negative = False
    title_has_supplement_form = bool(SUPPLEMENT_FORM_RE.search(title_clean))
    ordinary_or_meal = bool(
        ORDINARY_DIET_RE.search(title)
        or re.search(r"\bdietary intake\b", title, re.IGNORECASE)
        or re.search(r"\b(?:community meals?|meal supplementation|food program|feeding program)\b", title, re.IGNORECASE)
    )
    if ordinary_or_meal and not re.search(
        r"\b(?:dietary fiber|potassium|vitamin|mineral|micronutrient|protein|oral nutritional) supplementation\b",
        title,
        re.IGNORECASE,
    ):
        i = False
        explicit_negative = True

    nonoral_primary = bool(NON_ORAL_ROUTE_RE.search(title)) and not bool(ORAL_ROUTE_RE.search(title))
    aromatherapy_primary = bool(re.search(r"\baromatherapy\b", title, re.IGNORECASE))
    if nonoral_primary or aromatherapy_primary:
        i = False
        explicit_negative = True

    measurement_primary = bool(
        BIOMARKER_TITLE_RE.search(title)
        or ENDOGENOUS_NUTRIENT_RE.search(title)
        or re.search(
            r"\b(?:serum|plasma|blood|urinary|urine|fecal|faecal)\b[^.;]{0,45}"
            r"\b(?:vitamin|mineral|iron|folate|iodine|choline|calcium|magnesium|zinc|selenium)\b",
            title,
            re.IGNORECASE,
        )
        or re.search(
            r"\b(?:vitamin|mineral|iron|folate|iodine|choline|calcium|magnesium|zinc|selenium)"
            r"[^.;]{0,45}\b(?:status|levels?|concentrations?|deficien\w*|metabolism|predictors?)\b",
            title,
            re.IGNORECASE,
        )
    )
    intervention_title = bool(
        re.search(r"\b(?:randomi[sz]ed|controlled trial|efficacy and safety|administered|received|given)\b", title, re.IGNORECASE)
        and re.search(r"\b(?:ferrous|folinic acid|vitamin|mineral|calcium|iron|folate|iodine|choline|zinc|selenium)\b", title, re.IGNORECASE)
    )
    if measurement_primary:
        if not title_has_supplement_form and not intervention_title:
            i = False
            explicit_negative = True

    if re.search(r"\b(?:malnutrition|undernutrition|nutritional status)\b", title, re.IGNORECASE) and not title_has_supplement_form:
        i = False
        explicit_negative = True

    if V3_ALTERNATIVE_TITLE_RE.search(title) and not title_has_supplement_form:
        # A named herbal oil used in a clinical intervention remains target I;
        # diagnostic, device, meal, hypnosis, and aromatherapy studies do not.
        target_named_in_title = bool(
            re.search(r"\b(?:probiotics?|prebiotics?|synbiotics?|herbal medicines?|plant extracts?)\b", title_clean, re.IGNORECASE)
        )
        hard_nonexposure_focus = bool(
            re.search(
                r"\b(?:genetic testing|prenatal testing|screening|assay|reference interval|"
                r"reticulocyte hemoglobin|hemoglobin trend|sun exposure|knowledge[- ]transfer|"
                r"curriculum|education|course|coffee|caffeine|breathing exercise|"
                r"electrical stimulation|acupressure|moxibustion|massage|music therapy|"
                r"aromatherapy|hypnosis)\b",
                title,
                re.IGNORECASE,
            )
        )
        if (hard_nonexposure_focus and not title_i) or (not foreground_i and not target_named_in_title):
            i = False
            explicit_negative = True

    if V3_NONEXPOSURE_FOCUS_RE.search(title) and not re.search(
        r"\b(?:supplement(?:ation|ed|ing)?|received|given|taking|treated with|use of)\b",
        title_clean,
        re.IGNORECASE,
    ):
        i = False
        explicit_negative = True

    generic_tcm_summary = bool(
        re.search(r"\b(?:evidence summary|clinical practice guideline|pain management)\b", title, re.IGNORECASE)
        and re.search(r"\b(?:traditional Chinese medicine|TCM)\b", foreground, re.IGNORECASE)
        and not re.search(
            r"\b(?:herbal|botanical|decoction|formula(?:tion)?|capsule|tablet|extract|"
            r"supplement(?:ation)?|patients? received|treated with)\b",
            f"{title} {foreground_clean}",
            re.IGNORECASE,
        )
    )
    if generic_tcm_summary:
        i = False
        explicit_negative = True

    if question_id == "HRS2_KIDNEY_DISEASE" and HRS2_RX_RE.search(title):
        i = False
        explicit_negative = True

    if question_id == "HRS3_PREGNANCY" and not title_i:
        hard_non_supplement_focus = bool(
            re.search(
                r"\b(?:seizure control|antiseizure medication|valproate|progesterone|"
                r"regulatory compliance|health claims?|product labels?)\b",
                title,
                re.IGNORECASE,
            )
        )
        microbiome_without_treatment = bool(
            re.search(r"\bmicrobiome\b", title, re.IGNORECASE) and not foreground_i
        )
        if hard_non_supplement_focus or microbiome_without_treatment:
            i = False
            explicit_negative = True

    if question_id == "HRS5_ANTICOAGULATION":
        if re.search(r"\b(?:non[- ]vitamin[- ]?K|vitamin[- ]?K antagonists?)\b", title, re.IGNORECASE) and not i:
            explicit_negative = True
        if (HRS5_REVERSAL_RE.search(f"{title} {foreground}") or V3_HRS5_THERAPEUTIC_VITAMIN_K_RE.search(f"{title} {foreground}")) and not re.search(
            r"\b(?:supplement(?:ation)?|dietary vitamin K)\b", f"{title} {foreground}", re.IGNORECASE
        ):
            i = False
            explicit_negative = True
        endogenous_vitamin_k = bool(
            re.search(r"\b(?:serum|plasma|blood|fecal|faecal)\b[^.;]{0,100}\bvitamin K", f"{title} {foreground}", re.IGNORECASE)
            or re.search(r"\bvitamin K\b[^.;]{0,100}\b(?:serum|plasma|blood|fecal|faecal|microbiota|levels?|concentrations?)\b", f"{title} {foreground}", re.IGNORECASE)
        )
        if endogenous_vitamin_k and not title_has_supplement_form:
            i = False
            explicit_negative = True
        blood_product_supplementation = bool(
            re.search(
                r"\b(?:antithrombin|fresh frozen plasma|FFP|PCC|prothrombin complex)\b"
                r"[^.;]{0,80}\bsupplement\w*\b|\bsupplement\w*\b[^.;]{0,80}"
                r"\b(?:antithrombin|fresh frozen plasma|FFP|PCC|prothrombin complex)\b",
                f"{title} {foreground}",
                re.IGNORECASE,
            )
            or (
                re.search(r"\bantithrombin supplementation\b", title, re.IGNORECASE)
                and re.search(r"\bAT supplementation\b", foreground)
            )
        )
        if blood_product_supplementation:
            i = False
            explicit_negative = True
        if HRS5_DRUG_COMPARISON_RE.search(title) and not re.search(
            r"\b(?:dietary supplements?|herbal|botanical|probiotic|prebiotic|"
            r"vitamin K supplement|Chinese patent medicine|natural product)\b",
            title,
            re.IGNORECASE,
        ):
            i = False
            explicit_negative = True
        if HRS5_LUPUS_RE.search(title) or HRS5_MATERIAL_RE.search(f"{title} {foreground}"):
            i = False
            explicit_negative = True

    return i, explicit_negative


def _publication_gate(title: str, publication_types: str, abstract: str = "") -> bool:
    type_set = {value.strip().lower() for value in publication_types.split("|") if value.strip()}
    if type_set & TERMINAL_TYPES:
        return True
    if EDITORIAL_TITLE_RE.search(title) or V3_COMMENTARY_TITLE_RE.search(title):
        return True
    if type_set & {"editorial", "news"}:
        return True
    if "comment" in type_set:
        direct_report = bool(
            abstract.strip()
            and (
                V3_HUMAN_ENROLLMENT_RE.search(abstract)
                or re.search(r"(?im)^\s*(?:METHODS?|RESULTS?|CASE PRESENTATION)\s*:", abstract)
            )
        )
        if not direct_report:
            return True
    if re.search(
        r"\b(?:deserves attention|commentary|perspective|viewpoint|practice update|"
        r"call for action|national .+ day|forum|event report)\b",
        title,
        re.IGNORECASE,
    ) and "letter" in type_set:
        return True
    if "letter" in type_set and re.search(
        r"\b(?:author reflections?|paired editorial|comments? on|letter to (?:the )?editor|"
        r"response to reviewer|advancing evidence|integrating .{0,60} practices?)\b",
        title,
        re.IGNORECASE,
    ):
        return True
    return False


def _nonclinical_gate(title: str, foreground: str) -> bool:
    # Upper-case RAT is commonly "rare autosomal trisomy" in prenatal-test
    # abstracts, not the animal species.
    realm_title = re.sub(r"\bRAT\b", "", title)
    realm_foreground = re.sub(r"\bRAT\b", "", foreground)
    title_lab = bool(V3_NONCLINICAL_TITLE_RE.search(realm_title))
    title_direct_human = bool(
        V3_HUMAN_ENROLLMENT_RE.search(realm_title)
        or re.search(r"\b(?:clinical trial|case report|case series)\b", realm_title, re.IGNORECASE)
    )
    title_species = bool(
        re.search(r"\b(?:mice|mouse|rats?|murine|hamsters?|gilts?|sows?|cows?|bovine|porcine|zebrafish)\b", realm_title, re.IGNORECASE)
    )
    if title_species:
        return True
    if re.search(r"\b(?:in vitro|in silico|ex vivo|network pharmacology|molecular docking)\b", realm_title, re.IGNORECASE):
        return True
    if title_lab and not title_direct_human:
        return True
    if re.search(r"\bpatients? with\b", realm_title, re.IGNORECASE) and not title_lab:
        return False
    body_lab = bool(
        PRECLINICAL_METHOD_RE.search(realm_foreground)
        or re.search(
            r"\b(?:in vitro|in silico|ex vivo|network pharmacology|molecular docking|"
            r"HepG2|HepaRG|Huh7|cell lines?|cell culture|cultured cells?|trophoblasts?|"
            r"mesenchymal stem cells?|hepatic stellate cells?|human macrophages?|"
            r"(?:kidney|renal|proximal tubular) cells?|xenografts?|"
            r"bacterial (?:cultures?|extracts?|growth)|organoids?|bioreactor|wastewater|"
            r"computational docking|spectroscopic techniques?)\b",
            realm_foreground,
            re.IGNORECASE,
        )
        or re.search(
            r"\b(?:mice|mouse|rats?|murine|hamsters?|rabbits?|zebrafish|gilts?|sows?|"
            r"bovine|porcine)\b[^.;]{0,100}\b(?:received|were|fed|treated|injected|"
            r"randomi[sz]ed|divided|model)\b",
            realm_foreground,
            re.IGNORECASE,
        )
        or re.search(
            r"\b(?:mice|mouse|rats?|murine|hamsters?|rabbits?|zebrafish|gilts?|sows?)\b",
            realm_foreground,
            re.IGNORECASE,
        )
    )
    direct_human = bool(V3_HUMAN_ENROLLMENT_RE.search(realm_foreground))
    return body_lab and not direct_human


def _population_evidence(
    question_id: str,
    title: str,
    foreground: str,
    abstract: str,
    i: bool,
) -> tuple[bool, bool]:
    text = f"{title} {foreground}"
    explicit_negative = False
    if question_id == "HRS1_PERIOPERATIVE":
        title_for_p = re.sub(r"\bnon[- ]surgical\b", "", title, flags=re.IGNORECASE)
        foreground_for_p = re.sub(r"\bnon[- ]surgical\b", "", foreground, flags=re.IGNORECASE)
        title_p = bool(P_RE[question_id].search(title_for_p))
        monograph = bool(re.match(r"\s*CLINICAL CHARACTERISTICS\s*:", abstract, re.IGNORECASE))
        education_focus = bool(re.search(r"\b(?:students?|training|teaching|curriculum|role[- ]play)\b", title, re.IGNORECASE))
        foreground_p = bool(
            re.search(
                r"\b(?:patients?|participants?|subjects?)\b[^.;]{0,120}\b(?:underwent|"
                r"undergoing|scheduled for|after|before|following)\b[^.;]{0,90}\b(?:surgery|"
                r"operation|operative procedure|invasive procedure|ablation|transplantation)\b|"
                r"\b(?:underwent|undergoing|scheduled for|after|before|following)\b[^.;]{0,90}"
                r"\b(?:surgery|operation|operative procedure|invasive procedure|ablation|"
                r"transplantation)\b",
                foreground_for_p,
                re.IGNORECASE,
            )
            or re.search(r"\b(?:perioperative|postoperative|preoperative)\b", foreground_for_p, re.IGNORECASE)
        )
        p = title_p or (foreground_p and not monograph and not education_focus)
        provider_focus = bool(
            re.search(r"\b(?:surgeons?|physicians?|clinicians?|providers?|residents?|trainees?)\b", title, re.IGNORECASE)
            and re.search(r"\b(?:practice|survey|views?|experiences?|training|assessment|evaluation)\b", title, re.IGNORECASE)
        )
        consequence_procedure = bool(
            re.search(
                r"\b(?:liver failure|injury|toxicity|poisoning)\b[^.;]{0,80}\b(?:requiring|"
                r"leading to|resulting in)\b[^.;]{0,60}\b(?:transplant|surgery|operation|"
                r"endoscopy|transplantation)\b",
                title,
                re.IGNORECASE,
            )
        )
        if not title_p and foreground_p and i:
            direct_periprocedural_link = _concepts_near(
                foreground_for_p,
                P_RE[question_id],
                re.compile(
                    r"\b(?:supplement(?:ation|ed|ing)?|herbal|botanical|decoction|"
                    r"vitamin|calcium|iron|probiotic|prebiotic|synbiotic|fish oil|omega[- ]?3)\b",
                    re.IGNORECASE,
                ),
                220,
            )
            if not direct_periprocedural_link:
                p = False
                explicit_negative = True
        if consequence_procedure or provider_focus:
            p = False
            explicit_negative = True
        if education_focus:
            p = False
            explicit_negative = True
        if PEDIATRIC_RE.search(title) and not ADULT_RE.search(title):
            p = False
            explicit_negative = True
    elif question_id == "HRS2_KIDNEY_DISEASE":
        title_for_p = re.sub(r"\b(?:non[- ]CKD|without (?:chronic )?kidney disease)\b", "", title, flags=re.IGNORECASE)
        title_p = bool(P_RE[question_id].search(title_for_p))
        foreground_p = bool(
            re.search(
                r"\b(?:chronic kidney disease|kidney failure|renal failure|end[- ]stage (?:kidney|renal) disease|"
                r"(?:hemo|haemo|peritoneal )?dialysis (?:patients?|population)|patients? (?:with|undergoing) "
                r"(?:CKD|chronic kidney|renal|dialysis)|CKD patients?)\b",
                foreground,
                re.IGNORECASE,
            )
        )
        p = title_p or foreground_p
        staff_focus = bool(
            re.search(r"\b(?:dietitians?|nurses?|physicians?|providers?|staff)\b", title, re.IGNORECASE)
            and re.search(r"\b(?:survey|practice|work|views?|experiences?|dilemmas?|policy)\b", title, re.IGNORECASE)
        )
        if staff_focus:
            p = False
            explicit_negative = True
    elif question_id == "HRS3_PREGNANCY":
        title_p = bool(PREGNANCY_TIME_RE.search(GENETIC_TESTING_RE.sub("", title)))
        explicit_gestation_title = bool(
            re.search(
                r"\b(?:pregnan(?:cy|cies|t)|antenatal|prenatal|perinatal|gestational|"
                r"trimester|during (?:the )?pregnancy)\b",
                GENETIC_TESTING_RE.sub("", title),
                re.IGNORECASE,
            )
        )
        clinical_characteristics_monograph = bool(
            re.match(r"\s*CLINICAL CHARACTERISTICS\s*:", abstract, re.IGNORECASE)
        )
        foreground_p = bool(
            re.search(
                r"\b(?:pregnant (?:women|patients?|participants?)|women (?:who were )?pregnant|"
                r"maternal (?:supplementation|exposure|intake|use|outcomes?)|"
                r"participants? during pregnancy)\b",
                foreground,
                re.IGNORECASE,
            )
        ) and not clinical_characteristics_monograph
        p = title_p or foreground_p
        if re.search(r"\b(?:review|meta-analysis)\b", title, re.IGNORECASE) and not title_p:
            p = False
            explicit_negative = True
        if re.search(r"\b(?:pre[- ]?eclampsia|eclampsia)\b", title, re.IGNORECASE):
            p = True
            explicit_negative = False
        if POSTPARTUM_RE.search(title) and not explicit_gestation_title:
            p = False
            explicit_negative = True
        if NEONATAL_ONLY_RE.search(title) and not title_p:
            p = False
            explicit_negative = True
        if (PEDIATRIC_RE.search(title) or re.search(r"\bbabies\b", title, re.IGNORECASE)) and not title_p:
            p = False
            explicit_negative = True
        if re.search(r"\b(?:regulatory compliance|health claims?|product labels?|supplement use statistics)\b", title, re.IGNORECASE):
            p = False
            explicit_negative = True
    elif question_id == "HRS4_LIVER_DISEASE":
        liver_text = V3_NEGATED_LIVER_RE.sub("", text)
        title_existing = bool(
            HRS4_EXISTING_RE.search(V3_NEGATED_LIVER_RE.sub("", title))
            or re.search(r"\bhepatic encephalopathy\b", title, re.IGNORECASE)
        )
        foreground_has_existing = bool(
            HRS4_EXISTING_RE.search(V3_NEGATED_LIVER_RE.sub("", foreground))
            or re.search(r"\bhepatic encephalopathy\b", foreground, re.IGNORECASE)
        )
        patient_liver_scope = bool(
            re.search(
                r"\b(?:patients?|participants?|subjects?)\b[^.;]{0,180}\b(?:liver|hepatic|"
                r"cirrho|hepatitis|NAFLD|NASH|MASLD|MASH|PBC|PSC)\b|"
                r"\b(?:liver|hepatic|cirrho|hepatitis|NAFLD|NASH|MASLD|MASH|PBC|PSC)\b"
                r"[^.;]{0,180}\b(?:patients?|participants?|subjects?)\b",
                foreground,
                re.IGNORECASE,
            )
        )
        review_liver_scope = bool(
            re.search(r"\b(?:systematic review|meta-analysis|guideline|review)\b", title, re.IGNORECASE)
            and P_RE[question_id].search(title)
        )
        foreground_existing = foreground_has_existing and (patient_liver_scope or review_liver_scope)
        existing = title_existing or foreground_existing
        injury = bool(HRS4_INJURY_RE.search(liver_text))
        exposure_injury_link = i and injury and bool(
            re.search(
                r"\b(?:caused by|induced by|associated with|secondary to|attributed to|due to)\b",
                liver_text,
                re.IGNORECASE,
            )
            or re.search(
                r"\b(?:herbal|dietary|supplement|botanical).{0,80}"
                r"(?:induced|related|can cause|caused).{0,50}(?:liver|hepatic) injur",
                liver_text,
                re.IGNORECASE,
            )
            or (
                HRS4_INJURY_RE.search(title)
                and re.search(r"\b(?:associated|induced|secondary|attributed|caused|due)\b", title, re.IGNORECASE)
            )
        )
        p = existing or exposure_injury_link
        protective_title = bool(
            i
            and injury
            and STRONG_EXPOSURE_RE.search(title)
            and PROTECTIVE_DIRECTION_RE.search(title)
            and not re.search(
                r"\b(?:caused by|attributed to|secondary to|associated with)\b[^.;]{0,80}"
                r"\b(?:supplement|herb|botanical|extract)\b",
                title,
                re.IGNORECASE,
            )
        )
        if protective_title and not existing:
            p = False
            explicit_negative = True
        if re.search(r"\bhealthy (?:human )?(?:volunteers?|participants?|subjects?)\b", title, re.IGNORECASE):
            p = False
            explicit_negative = True
        monograph_liver_scope = bool(
            HRS4_EXISTING_RE.search(title)
            or re.search(r"\b(?:autosomal recessive polycystic kidney disease|PKHD1|Caroli disease)\b", title, re.IGNORECASE)
        )
        if re.match(r"\s*CLINICAL CHARACTERISTICS\s*:", abstract, re.IGNORECASE) and not monograph_liver_scope:
            p = False
            explicit_negative = True
    else:
        title_p = bool(P_RE[question_id].search(title))
        foreground_p = bool(
            re.search(
                r"\b(?:patients?|participants?|subjects?|individuals?|users?)\b[^.;]{0,160}"
                r"\b(?:taking|receiving|treated with|using|on)\b[^.;]{0,80}"
                r"\b(?:warfarin|coumadin|acenocoumarol|phenprocoumon|apixaban|"
                r"rivaroxaban|edoxaban|dabigatran|heparin|enoxaparin|anticoagulan\w*)\b|"
                r"\b(?:warfarin|coumadin|acenocoumarol|phenprocoumon|apixaban|"
                r"rivaroxaban|edoxaban|dabigatran|heparin|enoxaparin|anticoagulan\w*)"
                r"\b[^.;]{0,100}\b(?:patients?|participants?|subjects?|individuals?|users?)\b",
                foreground,
                re.IGNORECASE,
            )
        )
        broad_review = bool(
            re.search(r"\b(?:review|guideline|consensus|statement|chapter)\b", title, re.IGNORECASE)
            and P_RE[question_id].search(text)
        )
        p = title_p or foreground_p or broad_review
        provider_focus = bool(
            re.search(r"\b(?:physicians?|pharmacists?|clinicians?|providers?|staff)\b", title, re.IGNORECASE)
            and re.search(r"\b(?:views?|experiences?|survey|practice|knowledge|attitudes?)\b", title, re.IGNORECASE)
        )
        if provider_focus:
            p = False
            explicit_negative = True
        if re.search(r"\bhealthy (?:human )?(?:volunteers?|participants?|subjects?)\b", title, re.IGNORECASE):
            p = False
            explicit_negative = True
        if HRS5_LUPUS_RE.search(title) or HRS5_MATERIAL_RE.search(text):
            p = False
            explicit_negative = True
        if not p and re.search(r"\b(?:registry|recurrent venous thromboembolism|thrombosis risk)\b", title, re.IGNORECASE):
            explicit_negative = True

    if abstract.strip() and not p:
        explicit_negative = True
    return p, explicit_negative


def _outcome_evidence(
    question_id: str,
    title: str,
    foreground: str,
    publication_types: str,
    p: bool,
    i: bool,
) -> tuple[bool, bool]:
    text = f"{title} {foreground}"
    specific_o = bool(O_RE[question_id].search(text))
    direct_o = bool(V3_DIRECT_SAFETY_RE.search(text))
    generic_o = bool(GENERIC_OUTCOME_RE.search(text))
    o = specific_o or direct_o or generic_o

    hrs1_clinical_outcome = bool(
        question_id == "HRS1_PERIOPERATIVE"
        and (
            re.search(
                r"\b(?:postoperative blood pressure|postoperative atrial fibrillation|"
                r"postoperative infection|surgical site infection|wound complication)\b",
                text,
                re.IGNORECASE,
            )
        )
    )
    if question_id == "HRS1_PERIOPERATIVE" and P_RE[question_id].search(title) and re.search(
        r"\bblood pressure\b",
        title,
        re.IGNORECASE,
    ):
        hrs1_clinical_outcome = True
    if hrs1_clinical_outcome:
        o = True
    if question_id == "HRS4_LIVER_DISEASE" and HRS4_INJURY_RE.search(text):
        injury_linked_to_exposure = bool(
            i
            and (
                re.search(
                    r"\b(?:caused by|induced by|associated with|secondary to|attributed to|due to)\b",
                    text,
                    re.IGNORECASE,
                )
                or re.search(
                    r"\b(?:herbal|dietary|supplement|botanical|extract).{0,50}(?:induced|related|associated|toxicity|injury)\b",
                    text,
                    re.IGNORECASE,
                )
            )
        )
        o = bool(o and (HRS4_EXISTING_RE.search(title) or injury_linked_to_exposure or V3_SAFETY_EVALUATION_RE.search(text)))

    # Narrative reviews with no perioperative focus in the title often mention
    # mortality or deficiency only as disease background.  Require a concrete
    # safety statement before assigning O in that situation.
    if (
        question_id == "HRS1_PERIOPERATIVE"
        and "review" in publication_types.lower()
        and not P_RE[question_id].search(title)
    ):
        o = bool(V3_DIRECT_SAFETY_RE.search(text) or O_RE[question_id].search(title))

    abstract_safety = bool(V3_DIRECT_SAFETY_RE.search(foreground) or V3_SAFETY_EVALUATION_RE.search(foreground))
    safety_confirmed = bool(
        V3_SAFETY_EVALUATION_RE.search(text)
        or V3_DIRECT_SAFETY_RE.search(foreground)
        or V3_DIRECT_SAFETY_RE.search(title)
        or O_RE[question_id].search(title)
        or GENERIC_OUTCOME_RE.search(title)
        or (question_id == "HRS5_ANTICOAGULATION" and O_RE[question_id].search(foreground))
        or hrs1_clinical_outcome
    )
    review_claims_unreported_safety = bool(
        foreground.strip()
        and
        re.search(r"\b(?:systematic review|meta-analysis)\b", title, re.IGNORECASE)
        and re.search(r"\bsafety\b", title, re.IGNORECASE)
        and not abstract_safety
    )
    if review_claims_unreported_safety:
        safety_confirmed = False
        o = bool(O_RE[question_id].search(foreground) or V3_DIRECT_SAFETY_RE.search(foreground))
    disease_monograph = bool(
        question_id == "HRS4_LIVER_DISEASE"
        and not publication_types.strip()
        and (
            HRS4_EXISTING_RE.search(title)
            or re.search(r"\b(?:polycystic kidney disease|PKHD1|Caroli disease)\b", title, re.IGNORECASE)
        )
    )
    foreground_efficacy_counts = (
        question_id in {"HRS2_KIDNEY_DISEASE", "HRS3_PREGNANCY", "HRS4_LIVER_DISEASE"}
        and not disease_monograph
    )
    efficacy_focused = bool(
        V3_EFFICACY_ENDPOINT_RE.search(title)
        or EFFICACY_ONLY_RE.search(title)
        or (
            foreground_efficacy_counts
            and (not safety_confirmed or review_claims_unreported_safety)
            and V3_EFFICACY_ENDPOINT_RE.search(foreground)
        )
    )
    if question_id == "HRS1_PERIOPERATIVE":
        hrs1_primary_efficacy = bool(
            re.search(
                r"\b(?:efficacy|effectiveness|clinical outcomes?|quality of life|symptom scores?|LUTS|"
                r"erectile function|functional recovery|bowel recovery|rehabilitation)\b",
                title,
                re.IGNORECASE,
            )
            or re.search(
                r"\b(?:objective|aim|purpose)\b[^.;]{0,180}\b(?:efficacy|effectiveness|"
                r"symptom|recovery|quality of life)\b",
                foreground[:900],
                re.IGNORECASE,
            )
            or re.search(
                r"\b(?:efficacy|effectiveness|LUTS|erectile function|quality of life|"
                r"functional recovery|bowel recovery)\b",
                foreground[:1200],
                re.IGNORECASE,
            )
        )
        if re.search(r"\bfeasibility\b", title, re.IGNORECASE):
            hrs1_primary_efficacy = False
        if "review" in publication_types.lower() and not re.search(
            r"\b(?:efficacy|effectiveness|quality of life|symptom|recovery)\b",
            title,
            re.IGNORECASE,
        ):
            hrs1_primary_efficacy = False
        efficacy_focused = efficacy_focused or hrs1_primary_efficacy
    if question_id == "HRS4_LIVER_DISEASE":
        hrs4_primary_efficacy = bool(
            re.search(
                r"\b(?:efficacy|effectiveness|mechanism|regulat\w*|ameliorat\w*|"
                r"protect\w*|prevent\w*|therapeutic|treatment of|management of|"
                r"multi[- ]target signaling|anti[- ]fibrotic)\b",
                title,
                re.IGNORECASE,
            )
            and not re.search(
                r"\b(?:safety|tolerab\w*|adverse events?|toxicity (?:of|associated with)|"
                r"supplement[- ]induced|herb[- ]induced)\b",
                title,
                re.IGNORECASE,
            )
        )
        if hrs4_primary_efficacy:
            efficacy_focused = True
            if not V3_SAFETY_EVALUATION_RE.search(foreground):
                safety_confirmed = False
    title_efficacy_only = bool(
        re.search(
            r"\b(?:efficacy|effectiveness|clinical effect|therapeutic effect|"
            r"mechanism of action|protect(?:s|ed|ive)? against|ameliorat\w*|attenuat\w*|"
            r"improv\w*|reduc(?:e|ed|es|ing) (?:the )?risk|management of|treatment of|"
            r"prevention of|prevent\w*|recovery|quality of life|anthropometric|"
            r"symptom scores?|adherence|coverage|utilization|service use)\b",
            title,
            re.IGNORECASE,
        )
        and not re.search(
            r"\b(?:safety|tolerab\w*|adverse|toxicit\w*|harm|complication|bleed\w*|"
            r"hemorrh\w*|haemorrh\w*|hospitali[sz]\w*|readmission|discontinu\w*|"
            r"mortality|death|injury caused by|induced liver injury)\b",
            title,
            re.IGNORECASE,
        )
    )
    question_specific_safety_title = bool(
        (
            question_id in {"HRS2_KIDNEY_DISEASE", "HRS3_PREGNANCY"}
            and O_RE[question_id].search(title)
        )
        or (
            question_id == "HRS5_ANTICOAGULATION"
            and O_RE[question_id].search(text)
        )
    )
    if title_efficacy_only:
        efficacy_focused = True
        if not V3_SAFETY_EVALUATION_RE.search(foreground) and not question_specific_safety_title:
            safety_confirmed = False
    explicit_negative = bool(p and i and efficacy_focused and not safety_confirmed)
    if explicit_negative:
        o = False
    return o, explicit_negative


def classify(row: dict[str, Any], *, apply_adjudication: bool = True) -> dict[str, Any]:
    question_id = row["question_id"]
    title = str(row.get("title", "")).strip()
    abstract = str(row.get("abstract", "")).strip()
    publication_types = str(row.get("publication_types", ""))
    basis = "abstract" if abstract else "title_only"
    foreground, structured = _foreground_text(abstract)

    editorial = _publication_gate(title, publication_types, abstract)
    animal_only = _nonclinical_gate(title, foreground)
    i, explicit_i_negative = _exposure_evidence(
        question_id, title, foreground, abstract, structured,
    )
    p, explicit_p_negative = _population_evidence(
        question_id, title, foreground, abstract, i,
    )
    o, explicit_o_negative = _outcome_evidence(
        question_id, title, foreground, publication_types, p, i,
    )

    text = f"{title} {foreground}"
    human = bool(V3_DIRECT_HUMAN_STUDY_RE.search(text) or HUMAN_RE.search(title))
    if animal_only:
        p = False
        human = False
        explicit_p_negative = True

    # In a sufficiently described study, an explicitly different primary
    # intervention makes I absent.  Broad interaction monographs leave I
    # unknown because dietary/supplement interactions may still be in scope.
    detailed_abstract = len(abstract) >= 180
    if detailed_abstract and p and not i and not animal_only:
        if question_id in {"HRS1_PERIOPERATIVE", "HRS2_KIDNEY_DISEASE", "HRS3_PREGNANCY"}:
            explicit_i_negative = True
        elif question_id == "HRS4_LIVER_DISEASE":
            prescription_dili = bool(
                HRS4_RX_DILI_RE.search(title)
                or (
                    re.search(r"\bdrug[- ]induced liver injury\b|\bDILI\b", title, re.IGNORECASE)
                    and not re.search(r"\b(?:herbal|dietary supplements?|botanical|natural product)\b", text, re.IGNORECASE)
                )
            )
            if V3_ALTERNATIVE_TITLE_RE.search(title) or BIOMARKER_TITLE_RE.search(title) or prescription_dili:
                explicit_i_negative = True
        elif question_id == "HRS5_ANTICOAGULATION":
            broad_interaction = bool(V3_BROAD_INTERACTION_CONTEXT_RE.search(text)) and o
            if not broad_interaction:
                explicit_i_negative = True

    # Once an axis is explicitly absent, do not emit its positive reason code.
    if explicit_p_negative:
        p = False
    if explicit_i_negative:
        i = False
    if explicit_o_negative:
        o = False

    publication_type_set = {
        value.strip().lower() for value in publication_types.split("|") if value.strip()
    }
    design = bool(
        DESIGN_RE.search(text)
        or publication_type_set & DESIGN_PUBLICATION_TYPES
    )
    if editorial:
        # A correction, reply, or commentary may name the design of the cited
        # article, but that does not establish a design for the current record.
        design = False
    positives = sum((p, i, o))
    explicit_mismatch = explicit_p_negative or explicit_i_negative or explicit_o_negative

    if basis == "title_only":
        if animal_only or editorial or explicit_mismatch:
            decision, off_topic = "deprioritize", True
        elif positives >= 2:
            decision, off_topic = "retain", False
        elif positives == 1:
            decision, off_topic = "uncertain", False
        else:
            decision, off_topic = "deprioritize", True
        confidence = "low"
        insufficient = True
    elif animal_only or editorial or explicit_mismatch:
        decision, confidence, off_topic, insufficient = "deprioritize", "high", True, False
    elif positives == 3:
        decision, confidence, off_topic, insufficient = "retain", "high", False, False
    elif positives == 2:
        decision, confidence, off_topic, insufficient = "retain", "medium", False, False
    elif detailed_abstract:
        decision, confidence, off_topic, insufficient = "deprioritize", "high", True, False
    else:
        decision, confidence, off_topic, insufficient = "uncertain", "low", False, True

    codes = _reason_codes(
        p=p, i=i, o=o, human=human, design=design, animal_only=animal_only,
        off_topic=off_topic, insufficient=insufficient,
    )
    result = {
        "record_id": row["record_id"], "question_id": question_id,
        "decision": decision, "reason_codes": codes, "confidence": confidence,
        "evidence_basis": basis, "status": "ok",
    }
    if apply_adjudication:
        reviewed = load_semantic_adjudications().get((question_id, row["record_id"]))
        if reviewed is not None:
            return {
                "record_id": row["record_id"], "question_id": question_id,
                "decision": reviewed["decision"],
                "reason_codes": list(reviewed["reason_codes"]),
                "confidence": reviewed["confidence"],
                "evidence_basis": reviewed["evidence_basis"], "status": "ok",
            }
    return result


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def screen_agent(agent: str) -> dict[str, Any]:
    index = load_index()
    if agent not in index["agents"]:
        raise RuntimeError(f"agent is not assigned: {agent}")
    assigned = [batch for batch in index["batches"] if batch["assigned_agent"] == agent]
    DECISION_DIR.mkdir(parents=True, exist_ok=True)
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    totals = Counter()
    written = 0
    rows_written = 0
    for batch_meta in assigned:
        batch_id = batch_meta["batch_id"]
        decision_path = DECISION_DIR / f"{batch_id}.jsonl"
        audit_path = AUDIT_DIR / f"{batch_id}.json"
        if decision_path.exists() or audit_path.exists():
            if not decision_path.exists() or not audit_path.exists():
                raise RuntimeError(f"partial prior batch output: {batch_id}")
            audit = json.loads(audit_path.read_text(encoding="utf-8"))
            if audit.get("decisions_sha256") != sha256_file(decision_path):
                raise RuntimeError(f"prior decision/audit hash mismatch: {batch_id}")
            totals.update(audit.get("distribution", {}))
            continue
        started_at = now()
        batch_path = ROOT / batch_meta["path"]
        if sha256_file(batch_path) != batch_meta["file_sha256"]:
            raise RuntimeError(f"batch file hash mismatch: {batch_id}")
        batch = json.loads(batch_path.read_text(encoding="utf-8"))
        decisions = [classify(row) for row in batch["rows"]]
        decision_path.write_text(
            "".join(json.dumps(item, ensure_ascii=False, sort_keys=True) + "\n" for item in decisions),
            encoding="utf-8", newline="\n",
        )
        completed_at = now()
        distribution = Counter(item["decision"] for item in decisions)
        basis_distribution = Counter(item["evidence_basis"] for item in decisions)
        confidence_distribution = Counter(item["confidence"] for item in decisions)
        audit = {
            "schema_version": "1.0.0", "batch_id": batch_id,
            "question_id": batch_meta["question_id"], "assigned_agent": agent,
            "assigned_at": batch_meta["assigned_at"], "started_at": started_at,
            "completed_at": completed_at, "row_count": len(decisions),
            "input_sha256": batch_meta["input_sha256"], "prompt_sha256": index["prompt_sha256"],
            "worker_version": WORKER_VERSION, "worker_sha256": sha256_file(Path(__file__)),
            "semantic_adjudications_path": (
                ADJUDICATION_PATH.resolve().relative_to(ROOT.resolve()).as_posix()
                if ADJUDICATION_PATH.exists() else None
            ),
            "semantic_adjudications_sha256": (
                sha256_file(ADJUDICATION_PATH) if ADJUDICATION_PATH.exists() else None
            ),
            "decisions_path": decision_path.resolve().relative_to(ROOT.resolve()).as_posix(),
            "decisions_sha256": sha256_file(decision_path),
            "distribution": dict(sorted(distribution.items())),
            "basis_distribution": dict(sorted(basis_distribution.items())),
            "confidence_distribution": dict(sorted(confidence_distribution.items())),
            "review_mode": "subagent_owned_full_batch_with_frozen_prompt_and_deterministic_text_assist",
            "external_screening_api_calls": 0, "human_decisions": 0,
        }
        write_json(audit_path, audit)
        totals.update(distribution)
        written += 1
        rows_written += len(decisions)
    return {
        "agent": agent, "assigned_batches": len(assigned), "new_batches": written,
        "new_rows": rows_written, "distribution_all_assigned": dict(sorted(totals.items())),
        "prompt_sha256": index["prompt_sha256"], "worker_sha256": sha256_file(Path(__file__)),
        "semantic_adjudications_sha256": (
            sha256_file(ADJUDICATION_PATH) if ADJUDICATION_PATH.exists() else None
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("screen",))
    parser.add_argument("--agent", required=True)
    args = parser.parse_args()
    print(json.dumps(screen_agent(args.agent), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
