# 항응고제 복용자 및 신장 관련 고위험군에서의 영양소 보충제 안전성 체계적 근거 검토와 개인맞춤 조회 시스템 구축



## 국문초록



본 연구는 항응고제를 복용하는 성인과 신장결석·고칼슘뇨 등 신장 관련 고위험군에서 비타민 K, 오메가-3, 칼슘, 비타민 D 및 비타민 C 보충제의 안전성 근거를 체계적으로 검색·구조화하고, 개인의 복용 조건에 따라 확인사항과 근거 문헌을 제시하는 웹 시스템을 구축하는 것을 목적으로 하였다. PubMed, ClinicalTrials.gov와 KoreaMed에서 수집한 공개 서지자료를 연구계획서의 PICOS에 따라 자동 선별하고 대상자, 보충제, 용량, 안전성 결과와 근거 위치를 추출하였다. 직접 관련 후보는 4,593건이었고, 용량 정보가 확인된 문헌은 369건, 공개 원문 위치가 연결된 문헌은 1,507건이었다. 제목 직접관련성, 연구설계, 용량·결과 및 원문 접근성을 기준으로 핵심 근거 128건을 선정하였다. 조회 시스템은 보충제, 일일 용량, 병용 약물, 질환·결석 병력과 검사값을 입력받아 질문별 확인사항, 맞춤형 요약과 근거 원문을 제공하도록 구현하였다. 62개 자동 테스트, TypeScript 검사와 Production 빌드를 통과한 버전을 Vercel 고정 주소에 배포하였다. 본 연구는 체계적인 검색·선별·추출과 소프트웨어 검증을 수행했으나 독립된 두 명의 사람 선별자가 없으므로 자동 선별 결과를 최종 임상 권고로 해석할 수 없다.

## 국문초록

주요어: 영양보충제, 항응고제, 신장결석, 체계적 문헌고찰, 개인맞춤 조회, 인공지능

## 1. 서론

영양보충제는 처방전 없이 구입할 수 있지만 항응고제 복용자와 신장 관련 고위험군에서는 성분명만으로 안전성을 판단하기 어렵다. 같은 성분도 용량, 복용 기간, 병용 약물, 질환 상태와 검사값에 따라 확인해야 할 문제가 달라진다.

연구계획서는 문헌 검색, 선별, 근거 추출과 개인맞춤 조회 도구를 하나의 계보로 연결하도록 제시하였다. 본 연구는 이 방향을 유지하여 다섯 안전성 질문의 문헌 근거를 체계적으로 정리하고 실제 사용 가능한 웹 시스템으로 구현하였다.

연구 목적은 첫째 PICOS에 따라 관련 문헌을 검색·선별하는 것, 둘째 대상자·용량·안전성 결과와 근거 위치를 추출하는 것, 셋째 개인 조건에 따라 확인사항과 문헌을 조회하는 시스템을 구축하고 검증하는 것이다.

## 2. 연구 방법

### 2.1 연구설계

AI 보조 체계적 문헌고찰과 웹 시스템 개발 연구로 설계하였다. 자동화는 반복 가능한 후보 선별과 구조화에 사용했으며, 각 판정에는 자동화 여부와 근거 문장 위치를 보존하였다.

### 2.2 연구질문과 PICOS

대상은 항응고제 복용 성인 또는 신장결석·고칼슘뇨 고위험군, 노출은 다섯 보충제, 결과는 출혈·INR·결석·고칼슘뇨·고칼슘혈증·요중 옥살산으로 정의하였다.

### 2.3 정보원과 검색

PubMed를 핵심 정보원으로 사용하고 ClinicalTrials.gov와 KoreaMed를 보완 정보원으로 사용하였다. 접근하지 못한 데이터베이스의 결과 수는 임의로 계산하지 않았다.

### 2.4 선별

제목과 초록에서 대상, 성분, 안전성 결과가 함께 관찰되는 레코드를 직접 후보로 분류하였다. 동물·수의학 자료와 보충제 노출이 없는 자료를 제외하고, 제목에서 질문의 성분 노출과 결과가 직접 확인되는 문헌만 핵심 근거 후보로 선정하였다.

### 2.5 자료 추출

record ID, 제목, 연도, DOI, 대상자 근거문장, 보충제, 용량, 안전성 결과문장, 초록 위치와 공개 원문 URL을 추출하였다. 수치가 관찰되지 않으면 공란으로 유지하였다.

### 2.6 핵심근거 우선순위

체계적 문헌고찰·메타분석, 무작위시험, 관찰연구 순으로 가중하고 DOI, 용량 및 공개 원문 위치가 확인된 자료를 우선하였다. 질문별 최대 30건으로 제한하되 적격 문헌이 부족하면 수를 채우지 않았다.

### 2.7 개인맞춤 조회 시스템

Next.js App Router로 구현하였다. 입력은 보충제, 일일 용량, 병용 약물, 질환·결석 병력과 검사값이며, 출력은 현재 상태의 쉬운 요약, 우선 확인사항, 다음 단계와 근거 문헌이다. AI API는 구조화된 근거를 쉬운 한국어로 요약하는 데만 사용하고 입력 수치 보존을 코드로 재검사하였다.

### 2.8 검증과 배포

단위·계약·경계·개인맞춤 API 테스트 62개, lint, TypeScript 검사와 Production 빌드를 수행하였다. 최종 시스템은 https://nutrition-safety-engine.vercel.app 에 배포하였다.

## 3. 연구 결과

### 3.1 문헌 선별과 추출

PICOS 직접 후보는 4,593건이었다. 이 중 369건에서 단위가 있는 용량을 관찰했고 1,507건에 공개 원문 위치를 연결하였다. 제목 직접관련성 필터를 통과한 핵심 문헌은 128건이었다.

### 3.2 질문별 핵심 근거

### 3.2.1 비타민 K와 항응고제

A1 질문의 핵심 문헌은 30건이었다. 아래 문헌은 연구설계, 직접관련성, 용량·결과 및 원문 접근성을 종합해 우선 배치하였다.

이 가운데 명시적 용량이 관찰된 문헌은 18건, 공개 원문 위치가 연결된 문헌은 7건이었다. 용량이 공란인 경우 수치가 없다고 단정하지 않고, 현재 확보한 초록에서 명시적 단위를 추출하지 못한 상태로 해석하였다.

핵심 문헌 목록은 임상 권고 순위가 아니라 후속 원문 확인의 우선순위다. 연구설계와 제목의 직접관련성을 우선하되, 실제 효과 방향과 적용 가능성은 대상자 특성, 비교군, 용량 및 결과 정의를 원문에서 확인해야 한다.

Interaction Between Dietary Vitamin K Intake and Anticoagulation by Vitamin K Antagonists: Is It Really True?: A Systematic Review (2016). 보고 용량: 150 μg/day | 76 to 217 μg/day

A prospective randomized study to determine the optimal dose of intravenous vitamin K in reversal of over-warfarinization (2000). 보고 용량: 0.5 mg | 1 mg | 2 mg

Vitamin K1 supplementation to improve the stability of anticoagulation therapy with vitamin K antagonists: a dose-finding study (2011). 보고 용량: 100 μg | 150 μg | 200 μg

Over-the-counter vitamin K1-containing multivitamin supplements disrupt warfarin anticoagulation in vitamin K1-depleted patients. A prospective, controlled trial (2004). 보고 용량: 25 mcg

Reversal of overanticoagulation in very elderly hospitalized patients with an INR above 5.0: 24-hour INR response after vitamin K administration (2011). 보고 용량: 1 mg

### 3.2.2 오메가-3와 항응고제

A2 질문의 핵심 문헌은 12건이었다. 아래 문헌은 연구설계, 직접관련성, 용량·결과 및 원문 접근성을 종합해 우선 배치하였다.

이 가운데 명시적 용량이 관찰된 문헌은 2건, 공개 원문 위치가 연결된 문헌은 1건이었다. 용량이 공란인 경우 수치가 없다고 단정하지 않고, 현재 확보한 초록에서 명시적 단위를 추출하지 못한 상태로 해석하였다.

핵심 문헌 목록은 임상 권고 순위가 아니라 후속 원문 확인의 우선순위다. 연구설계와 제목의 직접관련성을 우선하되, 실제 효과 방향과 적용 가능성은 대상자 특성, 비교군, 용량 및 결과 정의를 원문에서 확인해야 한다.

No Effect of Omega-3 Carboxylic Acids on Pharmacokinetics/Pharmacodynamics of Warfarin or on Platelet Function When Co-administered with Acetylsalicylic Acid: Results of Two Phase I Studies in Healthy Volunteers (2017). 보고 용량: 4 g | 40 mg | 81 mg

Role of Fish Oil in Post-Cardiotomy Bleeding: A Summary of the Basic Science and Clinical Trials (2018). 초록 내 명시적 용량 없음.

Omega-3 and fish oil supplements do not cause increased bleeding during spinal decompression surgery (2012). 초록 내 명시적 용량 없음.

The Use of Fish Oil with Warfarin Does Not Significantly Affect either the International Normalised Ratio or Incidence of Adverse Events in Patients with Atrial Fibrillation and Deep Vein Thrombosis: A Retrospective Study (2016). 초록 내 명시적 용량 없음.

Subdural hematoma after a fall in an elderly patient taking high-dose omega-3 fatty acids with warfarin and aspirin: case report and review of the literature (2007). 보고 용량: 6 g/day

### 3.2.3 칼슘과 신장결석

B1 질문의 핵심 문헌은 30건이었다. 아래 문헌은 연구설계, 직접관련성, 용량·결과 및 원문 접근성을 종합해 우선 배치하였다.

이 가운데 명시적 용량이 관찰된 문헌은 14건, 공개 원문 위치가 연결된 문헌은 10건이었다. 용량이 공란인 경우 수치가 없다고 단정하지 않고, 현재 확보한 초록에서 명시적 단위를 추출하지 못한 상태로 해석하였다.

핵심 문헌 목록은 임상 권고 순위가 아니라 후속 원문 확인의 우선순위다. 연구설계와 제목의 직접관련성을 우선하되, 실제 효과 방향과 적용 가능성은 대상자 특성, 비교군, 용량 및 결과 정의를 원문에서 확인해야 한다.

Diet, fluid, or supplements for secondary prevention of nephrolithiasis: a systematic review and meta-analysis of randomized trials (2009). 초록 내 명시적 용량 없음.

Why oral calcium supplements may reduce renal stone disease: report of a clinical pilot study (2001). 보고 용량: 500 mg

Effect of dietary treatment and fluid intake on the prevention of recurrent calcium stones and changes in urine composition: A meta-analysis and systematic review (2021). 초록 내 명시적 용량 없음.

Incidence of hypercalciuria and hypercalcemia during vitamin D and calcium supplementation in older women (2014). 보고 용량: 1,200 mg | 1,200 mg/day | 200 mg

Dietary and lifestyle factors for primary prevention of nephrolithiasis: a systematic review and meta-analysis (2020). 초록 내 명시적 용량 없음.

### 3.2.4 비타민 D와 신장결석

B2 질문의 핵심 문헌은 30건이었다. 아래 문헌은 연구설계, 직접관련성, 용량·결과 및 원문 접근성을 종합해 우선 배치하였다.

이 가운데 명시적 용량이 관찰된 문헌은 15건, 공개 원문 위치가 연결된 문헌은 18건이었다. 용량이 공란인 경우 수치가 없다고 단정하지 않고, 현재 확보한 초록에서 명시적 단위를 추출하지 못한 상태로 해석하였다.

핵심 문헌 목록은 임상 권고 순위가 아니라 후속 원문 확인의 우선순위다. 연구설계와 제목의 직접관련성을 우선하되, 실제 효과 방향과 적용 가능성은 대상자 특성, 비교군, 용량 및 결과 정의를 원문에서 확인해야 한다.

Effect of two vitamin D repletion protocols on 24-h urine calcium in patients with recurrent calcium kidney stones and vitamin D deficiency: a randomized clinical trial (2023). 보고 용량: 2000 IU | 50,000 IU

Risk of hypercalcemia in blacks taking hydrochlorothiazide and vitamin D (2014). 보고 용량: 4000 IU | 4000 international units

Incidence of hypercalciuria and hypercalcemia during vitamin D and calcium supplementation in older women (2014). 보고 용량: 1,200 mg | 1,200 mg/day

A 250 μg/week dose of vitamin D was as effective as a 50 μg/d dose in healthy adults, but a regimen of four weekly followed by monthly doses of 1250 μg raised the risk of hypercalciuria (2013). 보고 용량: 1250 μg | 50 000 IU

Monthly high-dose vitamin D supplementation does not increase kidney stone risk or serum calcium: results from a randomized controlled trial (2019). 보고 용량: 100,000 IU

### 3.2.5 비타민 C와 신장결석

B3 질문의 핵심 문헌은 26건이었다. 아래 문헌은 연구설계, 직접관련성, 용량·결과 및 원문 접근성을 종합해 우선 배치하였다.

이 가운데 명시적 용량이 관찰된 문헌은 8건, 공개 원문 위치가 연결된 문헌은 10건이었다. 용량이 공란인 경우 수치가 없다고 단정하지 않고, 현재 확보한 초록에서 명시적 단위를 추출하지 못한 상태로 해석하였다.

핵심 문헌 목록은 임상 권고 순위가 아니라 후속 원문 확인의 우선순위다. 연구설계와 제목의 직접관련성을 우선하되, 실제 효과 방향과 적용 가능성은 대상자 특성, 비교군, 용량 및 결과 정의를 원문에서 확인해야 한다.

Ascorbic Acid Supplements and Kidney Stones Incidence Among Men and Women: A systematic review and meta-analysis (2019). 초록 내 명시적 용량 없음.

Ascorbic acid-induced oxalate nephropathy: a case report and discussion of pathologic mechanisms (2019). 보고 용량: 2 g/day

No Reported Renal Stones with Intravenous Vitamin C Administration: A Prospective Case Series Study (2018). 초록 내 명시적 용량 없음.

A case report of renal oxalosis and secondary hyperoxaluria due to chronic high vitamin C consumption (2025). 보고 용량: 3 g

Vitamin C-induced hyperoxaluria causing reversible tubulointerstitial nephritis and chronic renal failure: a case report (2007). 보고 용량: 680 mg

### 3.3 개인맞춤 조회 시스템

사용자는 전문 검색식을 작성하지 않고 다섯 보충제 중 하나를 선택한 뒤 용량, 약물, 병력과 검사값을 입력한다. 결과 화면은 입력 상태의 해석, 확인 이유와 우선 행동을 한 문단으로 제시하며, 세부 확인사항과 영문 원문은 접힌 영역에서 선택적으로 확인한다.

### 3.4 소프트웨어와 배포 검증

## 4. 고찰

본 연구는 연구계획서의 핵심인 체계적 검색, 대상자·용량·안전성 결과 추출과 개인맞춤 조회를 하나의 재현 가능한 흐름으로 연결하였다. 검색 건수 자체보다 어떤 문헌에서 어떤 조건과 수치가 관찰됐는지 확인할 수 있게 한 점이 중요하다.

질문별 핵심 문헌 수를 동일하게 맞추지 않고 직접관련성 기준을 통과한 수만 보고하였다. 특히 오메가-3와 항응고제 질문은 12건으로 다른 질문보다 적어, 근거 규모의 차이를 화면과 논문에 그대로 반영하였다.

AI 요약은 사용자가 입력한 숫자와 단위를 보존하고 구조화된 확인사항만 문장화하도록 제한하였다. 세부 문헌을 기본 접힘으로 배치해 초보자의 인지 부담을 줄이면서도 검증 가능한 원문 경로를 유지하였다.

한계는 독립된 두 명의 사람 선별과 충돌 해결이 없고, 구독 데이터베이스와 일부 원문에 접근하지 못했다는 점이다. 따라서 자동 선별·추출의 오류 가능성이 있으며, 효과크기 통합이나 임상 권고 강도 평가는 수행하지 않았다.

## 5. 결론

본 연구는 다섯 영양보충제 안전성 질문에 대해 4,593건의 PICOS 직접 후보에서 대상자·용량·안전성 결과와 근거 위치를 구조화하고 핵심 문헌 128건을 선정하였다. 이를 개인 조건 기반 웹 조회 시스템으로 구현해 Production에 배포하였다. 결과는 임상 처방을 대신하지 않지만 상담 전에 확인할 조건과 근거 문헌을 빠르게 정리하는 재현 가능한 도구를 제공한다.

## 참고문헌

[A1] Interaction Between Dietary Vitamin K Intake and Anticoagulation by Vitamin K Antagonists: Is It Really True?: A Systematic Review. 2016. 10.1097/md.0000000000002895

[A1] A prospective randomized study to determine the optimal dose of intravenous vitamin K in reversal of over-warfarinization. 2000. 10.1046/j.1365-2141.2000.02001.x

[A1] Vitamin K1 supplementation to improve the stability of anticoagulation therapy with vitamin K antagonists: a dose-finding study. 2011. 10.3324/haematol.2010.035162

[A1] Over-the-counter vitamin K1-containing multivitamin supplements disrupt warfarin anticoagulation in vitamin K1-depleted patients. A prospective, controlled trial. 2004. 10.1160/th04-06-0346

[A1] Reversal of overanticoagulation in very elderly hospitalized patients with an INR above 5.0: 24-hour INR response after vitamin K administration. 2011. 10.1016/j.amjmed.2011.01.016

[A1] Role of dietary vitamin K intake in chronic oral anticoagulation: prospective evidence from observational and randomized protocols. 2004. 10.1016/j.amjmed.2003.12.036

[A1] The effect of low-dose oral vitamin K supplementation on INR stability in patients receiving warfarin. A randomised trial. 2016. 10.1160/th16-04-0320

[A1] Vitamin K for improved anticoagulation control in patients receiving warfarin. 2014. 10.1002/14651858.cd009917.pub2

[A1] Antagonism of warfarin-induced hypoprothrombinemia with use of low-dose subcutaneous vitamin K1. 1997. 10.1002/j.1552-4604.1997.tb04363.x

[A1] Reversal of excessive effect of regular anticoagulation: low oral dose of phytonadione (vitamin K1) compared with warfarin discontinuation. 1993. https://pubmed.ncbi.nlm.nih.gov/8292723/

[A1] Nutri-pharmacogenomics of warfarin anticoagulation therapy: VKORC1 genotype-dependent influence of dietary vitamin K intake. 2014. 10.1007/s11239-013-0978-9

[A1] Short-term warfarin reversal for elective surgery--using low-dose intravenous vitamin K: safe, reliable and convenient*. 2011. 10.1111/j.1365-2141.2011.08787.x

[A1] A single dose of oral vitamin K effectively reverses oral anticoagulation with phenprocoumon during heart catheterisation. 2006. 10.4414/smw.2006.11452

[A1] Low-dose oral vitamin K reliably reverses over-anticoagulation due to warfarin. 1998. https://pubmed.ncbi.nlm.nih.gov/9657434/

[A1] Vitamin K for reversal of excessive vitamin K antagonist anticoagulation: a systematic review and meta-analysis. 2019. 10.1182/bloodadvances.2018025163

[A1] Association Between Usual Vitamin K Intake and Anticoagulation in Patients Under Warfarin Therapy. 2015. 10.7762/cnr.2015.4.4.235

[A1] Vitamin K supplementation can improve stability of anticoagulation for patients with unexplained variability in response to warfarin. 2007. 10.1182/blood-2006-09-049262

[A1] Daily vitamin K supplementation improves anticoagulant stability. 2007. 10.1111/j.1538-7836.2007.02715.x

[A1] Effect of 200μG/day of vitamin K1 on the variability of anticoagulation control in patients on warfarin: a randomized controlled trial. 2013. 10.1016/j.thromres.2013.07.019

[A1] [Oral administration of intravenous preparation of Vitamin K for excessive anticoagulation due to warfarin]. 2012. https://pubmed.ncbi.nlm.nih.gov/22522851/

[A1] Comparison of oral vs intravenous phytonadione (vitamin K1) in patients with excessive anticoagulation: a prospective randomized controlled study. 2003. 10.1001/archinte.163.20.2469

[A1] Treatment of warfarin-associated coagulopathy with oral vitamin K: a randomised controlled trial. 2000. 10.1016/s0140-6736(00)03125-1

[A1] Randomized, placebo-controlled trial of orally administered vitamin K1 for warfarin-associated coagulopathy in Chinese patients with mechanical heart valves. 2021. 10.1007/s00228-021-03127-8

[A1] Management of Supratherapeutic International Normalized Ratio without Bleeding after Warfarin Use: An Evaluation of Vitamin K Administration (SUPRA-WAR-K Study). 2017. 10.4212/cjhp.v70i3.1660

[A1] Warfarin and vitamin K intake in the era of pharmacogenetics. 2010. 10.1111/j.1365-2125.2010.03672.x

[A1] Oral vitamin K versus placebo to correct excessive anticoagulation in patients receiving warfarin: a randomized trial. 2009. 10.7326/0003-4819-150-5-200903030-00005

[A1] Low-dose oral vitamin K to normalize the international normalized ratio prior to surgery in patients who require temporary interruption of warfarin. 2007. 10.1007/s11239-007-0022-z

[A1] Warfarin cessation before cardiopulmonary bypass: lessons learned from a randomized controlled trial of oral vitamin K. 2007. 10.1016/j.athoracsur.2007.03.014

[A1] Oral vitamin K produces a normal INR within 24 hours of its administration in most patients discontinuing warfarin. 2005. https://pubmed.ncbi.nlm.nih.gov/15642685/

[A1] Impaired warfarin response secondary to high-dose vitamin K1 for rapid anticoagulation reversal: case series and literature review. 2004. 10.1592/phco.24.13.1213.38080

[A2] No Effect of Omega-3 Carboxylic Acids on Pharmacokinetics/Pharmacodynamics of Warfarin or on Platelet Function When Co-administered with Acetylsalicylic Acid: Results of Two Phase I Studies in Healthy Volunteers. 2017. 10.1007/s40256-017-0217-4

[A2] Role of Fish Oil in Post-Cardiotomy Bleeding: A Summary of the Basic Science and Clinical Trials. 2018. 10.1016/j.athoracsur.2018.01.041

[A2] Omega-3 and fish oil supplements do not cause increased bleeding during spinal decompression surgery. 2012. 10.1097/bsd.0b013e3182120227

[A2] The Use of Fish Oil with Warfarin Does Not Significantly Affect either the International Normalised Ratio or Incidence of Adverse Events in Patients with Atrial Fibrillation and Deep Vein Thrombosis: A Retrospective Study. 2016. 10.3390/nu8090578

[A2] Subdural hematoma after a fall in an elderly patient taking high-dose omega-3 fatty acids with warfarin and aspirin: case report and review of the literature. 2007. 10.1592/phco.27.1.152

[A2] Nasal Bleeding as a Potential Side Effect of Omega-3 Fatty Acids: A Case Report. 2026. 10.2174/0115748863448971260303083058

[A2] The assessment of risk for gastrointestinal injury with anticoagulant and antiplatelet drugs: the possible beneficial effect of eicosapentaenoic Acid for the risk of gastrointestinal injury. 2013. 10.1248/bpb.b12-00584

[A2] Plasma triacylglycerol and coagulation factor concentrations predict the anticoagulant effect of dietary fish oil in overweight subjects. 2007. 10.1093/jn/137.1.7

[A2] Extremely prolonged INR associated with warfarin in combination with both trazodone and omega-3 fatty acids. 2007. 10.1016/j.arcmed.2007.05.004

[A2] Fish oil interaction with warfarin. 2004. 10.1345/aph.1d007

[A2] Effects of Marine Fish Oils on the Anticoagulation Status of Patients Receiving Chronic Warfarin Therapy. 1998. 10.1023/a:1008852127668

[A2] Omega-3 Fatty Acid Supplementation and Warfarin: A Lethal Combination in Traumatic Brain Injury. 2017. 10.1097/jtn.0000000000000256

[B1] Diet, fluid, or supplements for secondary prevention of nephrolithiasis: a systematic review and meta-analysis of randomized trials. 2009. 10.1016/j.eururo.2009.03.031

[B1] Why oral calcium supplements may reduce renal stone disease: report of a clinical pilot study. 2001. 10.1136/jcp.54.1.54

[B1] Effect of dietary treatment and fluid intake on the prevention of recurrent calcium stones and changes in urine composition: A meta-analysis and systematic review. 2021. 10.1371/journal.pone.0250257

[B1] Incidence of hypercalciuria and hypercalcemia during vitamin D and calcium supplementation in older women. 2014. 10.1097/gme.0000000000000270

[B1] Dietary and lifestyle factors for primary prevention of nephrolithiasis: a systematic review and meta-analysis. 2020. 10.1186/s12882-020-01925-3

[B1] Pathophysiology of renal calcium handling in acromegaly: what lies behind hypercalciuria?. 2012. 10.1210/jc.2011-3188

[B1] Risk of calcium oxalate nephrolithiasis in postmenopausal women supplemented with calcium or combined calcium and estrogen. 2002. 10.1016/s0378-5122(01)00277-8

[B1] Substituting milk for apple juice does not increase kidney stone risk in most normocalciuric adults who form calcium oxalate stones. 1998. 10.1016/s0002-8223(98)00071-6

[B1] Randomized controlled trial of a low animal protein, high fiber diet in the prevention of recurrent calcium oxalate kidney stones. 1996. 10.1093/oxfordjournals.aje.a008851

[B1] Hypercalcemia, hypercalciuria, and kidney stones in long-term studies of vitamin D supplementation: a systematic review and meta-analysis. 2016. 10.3945/ajcn.116.134981

[B1] Calcium supplementation and kidney stone risk in osteoporosis: a systematic literature review. 2012. https://pubmed.ncbi.nlm.nih.gov/23137489/

[B1] Calcium supplementation and incident kidney stone risk: a systematic review. 2008. 10.1080/07315724.2008.10719734

[B1] Comparison of two diets for the prevention of recurrent stones in idiopathic hypercalciuria. 2002. 10.1056/nejmoa010369

[B1] Risk of calcium oxalate nephrolithiasis after calcium or combined calcium and calcitriol supplementation in postmenopausal women. 2000. 10.1007/s001980070090

[B1] Stone-forming potential of milk or calcium-fortified orange juice in idiopathic hypercalciuric adults. 1992. 10.1038/ki.1992.18

[B1] The impact of vitamin D supplementation on vitamin D level, urinary calcium excretion and bone density in patients with hypercalciuria and vitamin D deficiency - preliminary report. 2018. 10.34763/devperiodmed.20182202.144152

[B1] Association between calcium and vitamin D supplementation and increased risk of kidney stone formation in patients with osteoporosis in Southwest China: a cross-sectional study. 2025. 10.1136/bmjopen-2024-092901

[B1] Heritability of dietary traits that contribute to nephrolithiasis in a cohort of adult sibships. 2016. 10.1007/s40620-015-0204-2

[B1] Renal response to lithogenic and anti-lithogenic supplement challenges in a stone-free population group. 2004. 10.1053/j.jrn.2004.04.007

[B1] Diets with either beef or plant proteins reduce risk of calcium oxalate precipitation in patients with a history of calcium kidney stones. 2001. 10.1016/s0002-8223(01)00085-2

[B1] Magnesium, citrate, magnesium citrate and magnesium-alkali citrate as modulators of calcium oxalate crystallization in urine: observations in patients with recurrent idiopathic calcium urolithiasis. 1999. 10.1007/s002400050097

[B1] Relationship of hypercalciuria to diet and bladder stone formation in spinal cord injury patients. 1984. https://pubmed.ncbi.nlm.nih.gov/6380301/

[B1] Lowering urinary oxalate excretion to decrease calcium oxalate stone disease. 2016. 10.1007/s00240-015-0839-4

[B1] Biochemical control of bone loss and stone-forming propensity by potassium-calcium citrate after bariatric surgery. 2012. 10.1016/j.soard.2011.05.001

[B1] Schedule of taking calcium supplement and the risk of nephrolithiasis. 2004. 10.1111/j.1523-1755.2004.00587.x

[B1] Effect of dietary calcium on stone forming propensity. 2003. 10.1097/01.ju.0000043669.63989.22

[B1] Prolonged dietary calcium restriction: a diagnostic approach in idiopathic hypercalciuria. 2001. 10.1159/000046108

[B1] Effect of mineral water containing calcium and magnesium on calcium oxalate urolithiasis risk factors. 1997. 10.1159/000282958

[B1] Sensitivity to calcium intake in calcium stone forming patients. 1996. 10.1159/000189031

[B1] Dietary Recommendations for Bariatric Patients to Prevent Kidney Stone Formation. 2020. 10.3390/nu12051442

[B2] Effect of two vitamin D repletion protocols on 24-h urine calcium in patients with recurrent calcium kidney stones and vitamin D deficiency: a randomized clinical trial. 2023. 10.1186/s40001-023-01226-z

[B2] Risk of hypercalcemia in blacks taking hydrochlorothiazide and vitamin D. 2014. 10.1016/j.amjmed.2014.02.044

[B2] Incidence of hypercalciuria and hypercalcemia during vitamin D and calcium supplementation in older women. 2014. 10.1097/gme.0000000000000270

[B2] A 250 μg/week dose of vitamin D was as effective as a 50 μg/d dose in healthy adults, but a regimen of four weekly followed by monthly doses of 1250 μg raised the risk of hypercalciuria. 2013. 10.1017/s000711451300113x

[B2] Monthly high-dose vitamin D supplementation does not increase kidney stone risk or serum calcium: results from a randomized controlled trial. 2019. 10.1093/ajcn/nqy378

[B2] Vitamin D Repletion in Kidney Stone Formers: A Randomized Controlled Trial. 2017. 10.1016/j.juro.2016.10.057

[B2] No Severe Hypercalcemia with Daily Vitamin D3 Supplementation of up to 30 µg during the First Year of Life. 2017. 10.1159/000477298

[B2] Hypercalcemia, hypercalciuria, and kidney stones in long-term studies of vitamin D supplementation: a systematic review and meta-analysis. 2016. 10.3945/ajcn.116.134981

[B2] Association Between Vitamin D Supplementation and Urolithiasis Recurrence Outcomes in Known Stone Formers: A Retrospective Cohort Study With Dose-Response Analysis. 2025. 10.7759/cureus.90853

[B2] The impact of vitamin D supplementation on vitamin D level, urinary calcium excretion and bone density in patients with hypercalciuria and vitamin D deficiency - preliminary report. 2018. 10.34763/devperiodmed.20182202.144152

[B2] Reduction in Hypercalcemia Following Readjustment of Target Serum 25-Hydroxy Vitamin D Concentration during Cholecalciferol Therapy in Vitamin D-Deficient Critically Ill Patients. 2022. 10.3390/nu14081650

[B2] Hypercalcemia during pulse vitamin D3 therapy in CAPD patients treated with low calcium dialysate: the role of the decreasing serum parathyroid hormone level. 1997. 10.1681/asn.v8101579

[B2] Exacerbated hypercalcemia, nephrolithiasis, and renal impairment after vitamin D supplementation in granulomatous disease: a case report. 2025. 10.1186/s13256-025-05078-5

[B2] Vitamin D Intake and the Risk of Incident Kidney Stones. 2017. 10.1016/j.juro.2016.08.084

[B2] Effect of vitamin D repletion on urinary calcium excretion among kidney stone formers. 2012. 10.2215/cjn.11331111

[B2] Association between calcium and vitamin D supplementation and increased risk of kidney stone formation in patients with osteoporosis in Southwest China: a cross-sectional study. 2025. 10.1136/bmjopen-2024-092901

[B2] The Safety Profile of Vitamin D Supplements Using Real-World Data from 445,493 Participants of the UK Biobank: Slightly Higher Hypercalcemia Prevalence but Neither Increased Risks of Kidney Stones nor Atherosclerosis. 2024. 10.3390/nu16142251

[B2] Vitamin D and Calcium Supplementation and Urolithiasis: A Controversial and Multifaceted Relationship. 2023. 10.3390/nu15071724

[B2] Safety of megadose of vitamin D in patients with nephrolithiasis. 2021. 10.1016/j.nut.2021.111201

[B2] Calcium and Vitamin D Supplementation and Their Association with Kidney Stone Disease: A Narrative Review. 2021. 10.3390/nu13124363

[B2] Combined vitamin D and calcium supplementation in vitamin D inadequate patients with urolithiasis: Impact on hypercalciuria and de novo stone formation. 2015. 10.5489/cuaj.3332

[B2] Calcium and vitamin D supplementation and risk of kidney stone formation in postmenopausal women. 2013. https://pubmed.ncbi.nlm.nih.gov/23689153/

[B2] Idiopathic infantile hypercalcemia with a CYP24A1 variant triggered by vitamin D supplementation in fortified milk: A case report. 2025. 10.1297/cpe.2024-0049

[B2] Hypercalcemia with the Oral Administration of Active Vitamin D3 and Chinese Herbal Medicine. 2025. 10.2169/internalmedicine.4431-24

[B2] Normal 24-hour urine calcium concentrations after long-term daily oral intake of vitamin D in doses ranging from 5000 to 50,000 international units in 14 adult hospitalized psychiatric patients. 2023. 10.1016/j.jsbmb.2023.106329

[B2] Successful treatment with denosumab for two cases with hypercalcemia due to vitamin D intoxication and associated acute kidney injury. 2022. 10.1007/s13730-021-00643-5

[B2] Association of hypercalciuria with vitamin D supplementation in patients undergoing ketogenic dietary therapy. 2022. 10.3389/fnut.2022.970467

[B2] Hypercalcemia worsened after vitamin D supplementation in a sarcoidosis patient: A case report. 2022. 10.1097/md.0000000000030883

[B2] Metabolic effects of cholecalciferol supplementation in patients with calcium nephrolithiasis and vitamin D deficiency. 2021. 10.1007/s00345-020-03222-y

[B2] Hypercalcemia Without Hypervitaminosis D During Cholecalciferol Supplementation in Critically Ill Patients. 2020. 10.1002/ncp.10407

[B3] Ascorbic Acid Supplements and Kidney Stones Incidence Among Men and Women: A systematic review and meta-analysis. 2019. 10.22037/uj.v0i0.4275

[B3] Ascorbic acid-induced oxalate nephropathy: a case report and discussion of pathologic mechanisms. 2019. 10.1007/s13730-018-0366-6

[B3] No Reported Renal Stones with Intravenous Vitamin C Administration: A Prospective Case Series Study. 2018. 10.3390/antiox7050068

[B3] A case report of renal oxalosis and secondary hyperoxaluria due to chronic high vitamin C consumption. 2025. 10.5414/cncs111462

[B3] Vitamin C-induced hyperoxaluria causing reversible tubulointerstitial nephritis and chronic renal failure: a case report. 2007. 10.1186/1752-1947-1-155

[B3] Ascorbate increases human oxaluria and kidney stone risk. 2005. 10.1093/jn/135.7.1673

[B3] Ascorbic acid in idiopathic recurrent calcium urolithiasis in humans--does it have an abettor role in oxalate, and calcium oxalate crystallization?. 2000. 10.1007/s002400000101

[B3] Ascorbic acid overdosing: a risk factor for calcium oxalate nephrolithiasis. 1992. 10.1016/s0022-5347(17)37521-3

[B3] Public Interest in Vitamin C Supplementation During the COVID-19 Pandemic as a Potential Risk for Oxalate Nephrolithiasis. 2025. 10.7759/cureus.79452

[B3] Vitamin C with metabolites reduce oxalate levels compared to ascorbic acid: a preliminary and novel clinical urologic finding. 2009. https://pubmed.ncbi.nlm.nih.gov/19507407/

[B3] No contribution of ascorbic acid to renal calcium oxalate stones. 1997. 10.1159/000177954

[B3] Acute oxalate nephropathy due to high vitamin C doses and exocrine pancreatic insufficiency. 2019. 10.1136/bcr-2019-231504

[B3] Is it safe to prescribe ascorbic acid for urinary acidification in stone-forming patients with alkaline urine?. 2017. 10.5152/tud.2017.02700

[B3] Total, Dietary, and Supplemental Vitamin C Intake and Risk of Incident Kidney Stones. 2016. 10.1053/j.ajkd.2015.09.005

[B3] A case of reversible hyperoxaluria nephropathy early after roux-en-y-gastric bypass induced by vitamin C intake. 2016. 10.1093/omcr/omw054

[B3] Urinary oxalate excretion increases in home parenteral nutrition patients on a higher intravenous ascorbic acid dose. 2004. 10.1177/0148607104028006435

[B3] Effect of megadoses of ascorbic acid on serum and urinary oxalate. 1980. 10.1159/000473318

[B3] Vitamin C-induced oxalate nephropathy. 2011. 10.4061/2011/146927

[B3] Ascorbic acid is an abettor in calcium urolithiasis: an experimental study. 1993. https://pubmed.ncbi.nlm.nih.gov/8146605/

[B3] Oxalate absorption and endogenous oxalate synthesis from ascorbate in calcium oxalate stone formers and non-stone formers. 2004. 10.1053/j.ajkd.2004.08.028

[B3] The effect of ascorbic acid ingestion on the biochemical and physicochemical risk factors associated with calcium oxalate kidney stone formation. 1998. 10.1515/cclm.1998.027

[B3] Postprandial hyperinsulinaemia, insulin resistance and inappropriately high phosphaturia are features of younger males with idiopathic calcium urolithiasis: attenuation by ascorbic acid supplementation of a test meal. 1997. 10.1007/bf00941906

[B3] Relation of serum ascorbic acid to serum vitamin B12, serum ferritin, and kidney stones in US adults. 1999. 10.1001/archinte.159.6.619

[B3] Relative hyperoxaluria, crystalluria and haematuria after megadose ingestion of vitamin C. 1998. 10.1046/j.1365-2362.1998.00349.x

[B3] Oxalate metabolism in end-stage renal disease: the effect of ascorbic acid and pyridoxine. 1988. https://pubmed.ncbi.nlm.nih.gov/3132636/

[B3] The diurnal urinary excretion of oxalate and the effect of pyridoxine and ascorbate on oxalate excretion. 1977. 10.1159/000472053

## 부록. 재현 파일