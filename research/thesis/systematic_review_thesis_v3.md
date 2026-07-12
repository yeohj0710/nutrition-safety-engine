# 항응고제 복용자 및 신장 관련 고위험군에서의 영양소 보충제 안전성 체계적 근거 검토와 개인맞춤 조회 시스템 구축



## 국문초록



본 연구는 항응고제를 복용하는 성인과 신장결석·고칼슘뇨 등 신장 관련 고위험군에서 비타민 K, 오메가-3, 칼슘, 비타민 D 및 비타민 C 보충제의 안전성 근거를 체계적으로 검색·구조화하고, 개인의 복용 조건에 따라 확인사항과 근거 문헌을 제시하는 웹 시스템을 구축하는 것을 목적으로 하였다. PubMed, ClinicalTrials.gov와 KoreaMed에서 수집한 공개 서지자료를 연구계획서의 PICOS에 따라 자동 선별하고 대상자, 보충제, 용량, 안전성 결과와 근거 위치를 추출하였다. 직접 관련 후보는 4,593건이었고, 용량 정보가 확인된 문헌은 369건, 공개 원문 위치가 연결된 문헌은 1,507건이었다. 제목 직접관련성, 연구설계, 용량·결과 및 원문 접근성을 기준으로 핵심 근거 121건을 선정하였다. 조회 시스템은 보충제, 일일 용량, 병용 약물, 질환·결석 병력과 검사값을 입력받아 질문별 확인사항, 맞춤형 요약과 근거 원문을 제공하도록 구현하였다. 64개 자동 테스트, TypeScript 검사와 Production 빌드를 통과한 버전을 Vercel 고정 주소에 배포하였다. 본 연구는 체계적인 검색·선별·추출과 소프트웨어 검증을 수행했으나 독립된 두 명의 사람 선별자가 없으므로 자동 선별 결과를 최종 임상 권고로 해석할 수 없다.

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

Next.js App Router로 구현하였다. 입력은 보충제, 일일 용량, 병용 약물, 질환·결석 병력과 검사값이며, 출력은 현재 상태의 쉬운 요약, 우선 확인사항, 다음 단계와 근거 문헌이다. AI API는 구조화된 근거를 쉬운 한국어로 문장화하는 데만 사용하였다. 생성문에 입력·근거에 없는 숫자, URL, 안전성 단정 또는 복용 시작·중단·증감 지시가 있으면 폐기하고 결정론적 요약으로 대체하였다. 화면에는 개인식별정보를 입력하지 않도록 안내하였다.

### 2.8 검증과 배포

단위·계약·경계·개인맞춤 API 테스트 64개, lint, TypeScript 검사와 Production 빌드를 수행하였다. 최종 시스템은 https://nutrition-safety-engine.vercel.app 에 배포하였다.

### 2.9 자동화 절차를 선택한 이유

본 연구는 독립된 두 명의 사람 선별자를 확보하지 못한 상황에서 자동화 결과를 사람의 최종 포함 결정으로 바꾸어 표시하지 않았다. 대신 모든 검색 레코드를 보존한 상태에서 대상자, 노출, 안전성 결과가 함께 관찰되는지를 재현 가능한 규칙으로 분류하고, 그 결과를 ‘직접 후보’와 ‘핵심 근거 후보’로 구분하였다. 이 선택은 사람 선별을 대체하기 위한 것이 아니라 어떤 기준이 어떤 레코드에 적용됐는지 다시 계산할 수 있게 하기 위한 것이다. 따라서 자동화된 적격성 값은 임상적 최종 포함이 아니며, 사람 검토가 수행되면 원래 자동화 값과 별도 열에서 비교되어야 한다.

### 2.10 데이터 계보와 불변성

원자료에서 생성 자료까지의 계보는 record_id와 SHA-256으로 유지하였다. 원 evidence map은 수정하지 않고, PICOS 추출표와 핵심 근거표를 생성 스크립트로 다시 만들었다. 핵심 근거 수, 질문별 분포, 용량 관찰 수와 공개 원문 연결 수는 CSV를 읽어 manifest에서 계산했으며 논문과 웹 화면은 같은 manifest를 사용하였다. 이 구조에서는 숫자가 바뀔 때 문서나 화면을 직접 고치는 대신 원자료 또는 변환 규칙을 수정하고 전체 산출물을 재생성해야 한다. 구버전 자료는 legacy_unverified 경계에 남겨 현재 연구 결과와 혼합하지 않았다.

### 2.11 직접성 필터와 거짓양성 교정

초기 자동 후보에는 용어가 같지만 연구질문과 다른 문헌이 포함될 수 있었다. 예를 들어 vitamin K antagonist라는 약물 분류만 언급한 논문, 영양 섭취가 아닌 과다항응고 역전치료, 항응고제를 사용하지 않은 수술 출혈, 칼슘결석 기전만 다루고 칼슘 노출이 없는 연구가 이에 해당했다. 이에 A1은 식이·보충·항응고 안정성 노출을, A2는 항응고제와 출혈·응고 결과의 동시 표기를, B1은 경구·식이·보충 칼슘 노출을 요구하도록 직접성 규칙을 강화하였다. 소아·임신·동물 제목은 성인 핵심 집합에서 제외하되 원 검색 후보에서는 삭제하지 않았다. 질문별 30건을 채우기 위해 직접성이 낮은 문헌을 보충하지 않았다.

### 2.12 용량 추출과 단위 정규화

용량은 성분명과 투여·섭취 맥락이 같은 문장에 있을 때만 관찰값으로 기록하였다. 숫자 뒤의 mg, mcg, µg, μg, g 또는 IU를 인식하되 검사 농도인 mg/dL은 제외하였다. 천 단위 쉼표와 공백을 모두 인식해 50,000 IU 또는 50 000 IU가 000 IU로 잘리는 오류를 막았고, 유전자 대립유전자 표기인 대문자 G는 gram으로 해석하지 않았다. 이 교정으로 과도하게 넓었던 용량 관찰 수는 987건에서 369건으로 바뀌었다. 이 값은 ‘유효하거나 안전한 용량’이 아니라 초록에서 성분 투여 맥락과 단위를 함께 관찰한 레코드 수다.

### 2.13 합성 방법과 메타분석 결정

질문별 문헌은 대상자, 노출 형태, 연구설계와 결과 정의가 이질적이었고 사람 원문 선별·중복 보고 연결·비뚤림 위험 평가가 완료되지 않았다. 따라서 효과크기를 임의로 통합하거나 검색 레코드 수를 임상 효과의 크기로 해석하지 않았다. 본 단계의 합성은 질문별 직접 후보 수, 용량 관찰 여부, 원문 locator와 연구설계 후보를 구조화해 보여주는 방식으로 제한하였다. 향후 원문 이중 선별과 study-report 연결이 완료된 뒤, 동일한 비교와 결과를 보고한 독립 연구가 충분한 질문에서만 별도의 메타분석 적합성을 검토해야 한다.

### 2.14 AI 문장화의 안전 경계

생성형 모델은 검색·포함 판단이나 임상 규칙을 만들지 않고 이미 구조화된 확인사항을 일반 사용자가 읽기 쉬운 한국어 한 문단으로 바꾸는 데만 사용하였다. 서버는 생성문에 나타난 숫자를 입력·근거의 숫자 집합과 비교하고, 새 숫자·URL·안전성 단정·복용 시작·중단·증량·감량 지시가 있으면 생성문을 폐기한다. 모델 호출 실패나 검증 실패 시에는 고정된 결정론적 문장을 반환한다. 사용자가 입력한 조건은 영구 저장하거나 애플리케이션 로그에 남기지 않으며, 화면에서 이름·연락처·주민등록번호 등 개인식별정보를 입력하지 않도록 안내하였다.

### 2.15 검증 전략

검증은 연구 데이터와 소프트웨어를 분리해 수행하였다. 데이터 validator는 필수 열, 질문 집합, record 중복, DOI·provider ID·URL 형식, extraction authority, 사람 선별 허위표기, 질문별 직접성, 규칙과 문헌의 참조 무결성을 검사하였다. API 회귀검사는 다섯 질문의 routing, 입력 수치 보존, 지원하지 않는 성분, 잘못된 JSON, 과도한 입력, 비문자 필드와 생성형 모델의 허위 수치·복용 지시를 확인하였다. 브라우저 검증에서는 예시 입력, 결과 접힘, 키보드 접근, 모바일 390×844 화면과 개인정보 안내를 확인하였다. 이러한 기술 검증은 전문가 내용 타당도나 실제 환자 결과 검증을 의미하지 않는다.

## 3. 연구 결과

### 3.1 문헌 선별과 추출

PICOS 직접 후보는 4,593건이었다. 이 중 369건에서 단위가 있는 용량을 관찰했고 1,507건에 공개 원문 위치를 연결하였다. 제목 직접관련성 필터를 통과한 핵심 문헌은 121건이었다.

### 3.2 질문별 핵심 근거

### 3.2.1 비타민 K와 항응고제

A1 질문의 핵심 문헌은 30건이었다. 아래 문헌은 연구설계, 직접관련성, 용량·결과 및 원문 접근성을 종합해 우선 배치하였다.

이 가운데 명시적 용량이 관찰된 문헌은 10건, 공개 원문 위치가 연결된 문헌은 8건이었다. 용량이 공란인 경우 수치가 없다고 단정하지 않고, 현재 확보한 초록에서 명시적 단위를 추출하지 못한 상태로 해석하였다.

핵심 문헌 목록은 임상 권고 순위가 아니라 후속 원문 확인의 우선순위다. 연구설계와 제목의 직접관련성을 우선하되, 실제 효과 방향과 적용 가능성은 대상자 특성, 비교군, 용량 및 결과 정의를 원문에서 확인해야 한다.

Interaction Between Dietary Vitamin K Intake and Anticoagulation by Vitamin K Antagonists: Is It Really True?: A Systematic Review (2016). 보고 용량: 150 μg/day | 76 to 217 μg/day

Vitamin K1 supplementation to improve the stability of anticoagulation therapy with vitamin K antagonists: a dose-finding study (2011). 보고 용량: 100 μg | 150 μg | 200 μg

Over-the-counter vitamin K1-containing multivitamin supplements disrupt warfarin anticoagulation in vitamin K1-depleted patients. A prospective, controlled trial (2004). 보고 용량: 25 mcg

Anticoagulation control with daily low-dose vitamin k to reduce clinically adverse outcomes and international normalized ratio variability: a systematic review and meta-analysis (2013). 보고 용량: 100 to 200 μg

Role of dietary vitamin K intake in chronic oral anticoagulation: prospective evidence from observational and randomized protocols (2004). 초록 내 명시적 용량 없음.

### 3.2.2 오메가-3와 항응고제

A2 질문의 핵심 문헌은 5건이었다. 아래 문헌은 연구설계, 직접관련성, 용량·결과 및 원문 접근성을 종합해 우선 배치하였다.

이 가운데 명시적 용량이 관찰된 문헌은 1건, 공개 원문 위치가 연결된 문헌은 0건이었다. 용량이 공란인 경우 수치가 없다고 단정하지 않고, 현재 확보한 초록에서 명시적 단위를 추출하지 못한 상태로 해석하였다.

핵심 문헌 목록은 임상 권고 순위가 아니라 후속 원문 확인의 우선순위다. 연구설계와 제목의 직접관련성을 우선하되, 실제 효과 방향과 적용 가능성은 대상자 특성, 비교군, 용량 및 결과 정의를 원문에서 확인해야 한다.

No Effect of Omega-3 Carboxylic Acids on Pharmacokinetics/Pharmacodynamics of Warfarin or on Platelet Function When Co-administered with Acetylsalicylic Acid: Results of Two Phase I Studies in Healthy Volunteers (2017). 보고 용량: 4 g | 40 mg | 81 mg

The assessment of risk for gastrointestinal injury with anticoagulant and antiplatelet drugs: the possible beneficial effect of eicosapentaenoic Acid for the risk of gastrointestinal injury (2013). 초록 내 명시적 용량 없음.

Plasma triacylglycerol and coagulation factor concentrations predict the anticoagulant effect of dietary fish oil in overweight subjects (2007). 초록 내 명시적 용량 없음.

Extremely prolonged INR associated with warfarin in combination with both trazodone and omega-3 fatty acids (2007). 초록 내 명시적 용량 없음.

Effects of Marine Fish Oils on the Anticoagulation Status of Patients Receiving Chronic Warfarin Therapy (1998). 초록 내 명시적 용량 없음.

### 3.2.3 칼슘과 신장결석

B1 질문의 핵심 문헌은 30건이었다. 아래 문헌은 연구설계, 직접관련성, 용량·결과 및 원문 접근성을 종합해 우선 배치하였다.

이 가운데 명시적 용량이 관찰된 문헌은 9건, 공개 원문 위치가 연결된 문헌은 11건이었다. 용량이 공란인 경우 수치가 없다고 단정하지 않고, 현재 확보한 초록에서 명시적 단위를 추출하지 못한 상태로 해석하였다.

핵심 문헌 목록은 임상 권고 순위가 아니라 후속 원문 확인의 우선순위다. 연구설계와 제목의 직접관련성을 우선하되, 실제 효과 방향과 적용 가능성은 대상자 특성, 비교군, 용량 및 결과 정의를 원문에서 확인해야 한다.

Why oral calcium supplements may reduce renal stone disease: report of a clinical pilot study (2001). 보고 용량: 500 mg

Incidence of hypercalciuria and hypercalcemia during vitamin D and calcium supplementation in older women (2014). 보고 용량: 1,200 mg | 1,200 mg/day | 200 mg

Risk of calcium oxalate nephrolithiasis in postmenopausal women supplemented with calcium or combined calcium and estrogen (2002). 보고 용량: 0.625 mg/day | 250 mg | 5 mg | 625 mg

Substituting milk for apple juice does not increase kidney stone risk in most normocalciuric adults who form calcium oxalate stones (1998). 보고 용량: 400 mg | 800 mg

Calcium supplementation and kidney stone risk in osteoporosis: a systematic literature review (2012). 보고 용량: 1.500 mg | 120 mg

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

본 연구는 다섯 영양보충제 안전성 질문에 대해 4,593건의 PICOS 직접 후보에서 대상자·용량·안전성 결과와 근거 위치를 구조화하고 핵심 문헌 121건을 선정하였다. 이를 개인 조건 기반 웹 조회 시스템으로 구현해 Production에 배포하였다. 결과는 임상 처방을 대신하지 않지만 상담 전에 확인할 조건과 근거 문헌을 빠르게 정리하는 재현 가능한 도구를 제공한다.

## 참고문헌

[A1] Violi F, Lip GY, Pignatelli P, Pastori D. Interaction Between Dietary Vitamin K Intake and Anticoagulation by Vitamin K Antagonists: Is It Really True?: A Systematic Review. Medicine. 2016. doi: 10.1097/md.0000000000002895

[A1] Gebuis EP, Rosendaal FR, van Meegen E, van der Meer FJ. Vitamin K1 supplementation to improve the stability of anticoagulation therapy with vitamin K antagonists: a dose-finding study. Haematologica. 2011. doi: 10.3324/haematol.2010.035162

[A1] Kurnik D, Loebstein R, Rabinovitz H, Austerweil N, Halkin H, Almog S. Over-the-counter vitamin K1-containing multivitamin supplements disrupt warfarin anticoagulation in vitamin K1-depleted patients. A prospective, controlled trial. Thrombosis and haemostasis. 2004. doi: 10.1160/th04-06-0346

[A1] Lam J, Schulman S, Witt DM, Vandvik PO, Qayyum F, Holbrook AM. Anticoagulation control with daily low-dose vitamin k to reduce clinically adverse outcomes and international normalized ratio variability: a systematic review and meta-analysis. Pharmacotherapy. 2013. doi: 10.1002/phar.1302

[A1] Franco V, Polanczyk CA, Clausell N, Rohde LE. Role of dietary vitamin K intake in chronic oral anticoagulation: prospective evidence from observational and randomized protocols. The American journal of medicine. 2004. doi: 10.1016/j.amjmed.2003.12.036

[A1] Dentali F, Crowther M, Galli M, Pomero F, Garcia D, Clark N 외. Effect of Vitamin K Intake on the Stability of Treatment with Vitamin K Antagonists: A Systematic Review of the Literature. Seminars in thrombosis and hemostasis. 2016. doi: 10.1055/s-0036-1581105

[A1] Boonyawat K, Wang L, Lazo-Langner A, Kovacs MJ, Yeo E, Schnurr T 외. The effect of low-dose oral vitamin K supplementation on INR stability in patients receiving warfarin. A randomised trial. Thrombosis and haemostasis. 2016. doi: 10.1160/th16-04-0320

[A1] Mahtani KR, Heneghan CJ, Nunan D, Roberts NW. Vitamin K for improved anticoagulation control in patients receiving warfarin. The Cochrane database of systematic reviews. 2014. doi: 10.1002/14651858.cd009917.pub2

[A1] Amiri SV, Sidelmann JJ, Bor MV. Does vitamin K supplementation improve vitamin K antagonist therapy? A case report and update of the literature. Journal of cardiology cases. 2022. doi: 10.1016/j.jccase.2021.12.011

[A1] Saito R, Takeda K, Yamamoto K, Nakagawa A, Aoki H, Fujibayashi K 외. Nutri-pharmacogenomics of warfarin anticoagulation therapy: VKORC1 genotype-dependent influence of dietary vitamin K intake. Journal of thrombosis and thrombolysis. 2014. doi: 10.1007/s11239-013-0978-9

[A1] Park JN, Lee JS, Noh MY, Sung MK. Association Between Usual Vitamin K Intake and Anticoagulation in Patients Under Warfarin Therapy. Clinical nutrition research. 2015. doi: 10.7762/cnr.2015.4.4.235

[A1] Sconce E, Avery P, Wynne H, Kamali F. Vitamin K supplementation can improve stability of anticoagulation for patients with unexplained variability in response to warfarin. Blood. 2007. doi: 10.1182/blood-2006-09-049262

[A1] Rombouts EK, Rosendaal FR, Van Der Meer FJ. Daily vitamin K supplementation improves anticoagulant stability. Journal of thrombosis and haemostasis : JTH. 2007. doi: 10.1111/j.1538-7836.2007.02715.x

[A1] Majeed H, Rodger M, Forgie M, Carrier M, Taljaard M, Scarvelis D 외. Effect of 200μG/day of vitamin K1 on the variability of anticoagulation control in patients on warfarin: a randomized controlled trial. Thrombosis research. 2013. doi: 10.1016/j.thromres.2013.07.019

[A1] Lurie Y, Loebstein R, Kurnik D, Almog S, Halkin H. Warfarin and vitamin K intake in the era of pharmacogenetics. British journal of clinical pharmacology. 2010. doi: 10.1111/j.1365-2125.2010.03672.x

[A1] Mwita JC, Damasceno A, Chillo P, Ogah OS, Cohen K, Oyekunle A 외. Vitamin K-dependent anticoagulant use and level of anticoagulation control in sub-Saharan Africa: protocol for a retrospective cohort study. BMJ open. 2022. doi: 10.1136/bmjopen-2021-057166

[A1] Kim KH, Choi WS, Lee JH, Lee H, Yang DH, Chae SC. Relationship between dietary vitamin K intake and the stability of anticoagulation effect in patients taking long-term warfarin. Thrombosis and haemostasis. 2010. doi: 10.1160/th10-04-0257

[A1] Tajer C, Ceresetto J, Bottaro FJ, Martí A, Casey M, TERRA Trial investigators. Assessment of the Quality of Chronic Anticoagulation Control With Time in Therapeutic Range in Atrial Fibrillation Patients Treated With Vitamin K Antagonists by Hemostasis Specialists: The TERRA Registry: Tiempo en rango en la República Argentina. Clinical and applied thrombosis/hemostasis : official journal of the International Academy of Clinical and Applied Thrombosis/Hemostasis. 2017. doi: 10.1177/1076029615623378

[A1] Kabagambe EK, Beasley TM, Limdi NA. Vitamin K intake, body mass index and warfarin maintenance dose. Cardiology. 2013. doi: 10.1159/000354218

[A1] Rombouts EK, Rosendaal FR, van der Meer FJ. Influence of dietary vitamin K intake on subtherapeutic oral anticoagulant therapy. British journal of haematology. 2010. doi: 10.1111/j.1365-2141.2010.08108.x

[A1] Pedersen FM, Hamberg O, Hess K, Ovesen L. The effect of dietary vitamin K on warfarin-induced anticoagulation. Journal of internal medicine. 1991. doi: 10.1111/j.1365-2796.1991.tb00388.x

[A1] Evans CE, Getchell KE, Ivy DR. Proposed Criteria for the Use of Low-Dose Vitamin K Supplementation in Patients Using Vitamin K Antagonists: A Literature Review of a Clinical Controversy. Journal of pharmacy practice. 2018. doi: 10.1177/0897190017711518

[A1] Ford SK, Moll S. Vitamin K supplementation to decrease variability of International Normalized Ratio in patients on vitamin K antagonists: a literature review. Current opinion in hematology. 2008. doi: 10.1097/moh.0b013e328304b3c5

[A1] Rohde LE, de Assis MC, Rabelo ER. Dietary vitamin K intake and anticoagulation in elderly patients. Current opinion in clinical nutrition and metabolic care. 2007. doi: 10.1097/mco.0b013e328011c46c

[A1] Reese AM, Farnett LE, Lyons RM, Patel B, Morgan L, Bussey HI. Low-dose vitamin K to augment anticoagulation control. Pharmacotherapy. 2005. doi: 10.1592/phco.2005.25.12.1746

[A1] Lubetsky A, Dekel-Stern E, Chetrit A, Lubin F, Halkin H. Vitamin K intake and sensitivity to warfarin in patients consuming regular diets. Thrombosis and haemostasis. 1999. https://pubmed.ncbi.nlm.nih.gov/10102468/

[A1] Prochaska JH, Hausner C, Nagler M, Göbel S, Eggebrecht L, Panova-Noeva M 외. Subtherapeutic Anticoagulation Control under Treatment with Vitamin K-Antagonists-Data from a Specialized Coagulation Service. Thrombosis and haemostasis. 2019. doi: 10.1055/s-0039-1692175

[A1] Holmes MV, Hunt BJ, Shearer MJ. The role of dietary vitamin K in the management of oral vitamin K antagonists. Blood reviews. 2012. doi: 10.1016/j.blre.2011.07.002

[A1] Couris R, Tataronis G, McCloskey W, Oertel L, Dallal G, Dwyer J 외. Dietary vitamin K variability affects International Normalized Ratio (INR) coagulation indices. International journal for vitamin and nutrition research. Internationale Zeitschrift fur Vitamin- und Ernahrungsforschung. Journal international de vitaminologie et de nutrition. 2006. doi: 10.1024/0300-9831.76.2.65

[A1] Khan T, Wynne H, Wood P, Torrance A, Hankey C, Avery P 외. Dietary vitamin K influences intra-individual variability in anticoagulant response to warfarin. British journal of haematology. 2004. doi: 10.1046/j.1365-2141.2003.04787.x

[A2] Offman E, Davidson M, Nilsson C. No Effect of Omega-3 Carboxylic Acids on Pharmacokinetics/Pharmacodynamics of Warfarin or on Platelet Function When Co-administered with Acetylsalicylic Acid: Results of Two Phase I Studies in Healthy Volunteers. American journal of cardiovascular drugs : drugs, devices, and other interventions. 2017. doi: 10.1007/s40256-017-0217-4

[A2] Tanaka M, Tanaka A, Suemaru K, Araki H. The assessment of risk for gastrointestinal injury with anticoagulant and antiplatelet drugs: the possible beneficial effect of eicosapentaenoic Acid for the risk of gastrointestinal injury. Biological & pharmaceutical bulletin. 2013. doi: 10.1248/bpb.b12-00584

[A2] Vanschoonbeek K, Feijge MA, Saris WH, de Maat MP, Heemskerk JW. Plasma triacylglycerol and coagulation factor concentrations predict the anticoagulant effect of dietary fish oil in overweight subjects. The Journal of nutrition. 2007. doi: 10.1093/jn/137.1.7

[A2] Jalili M, Dehpour AR. Extremely prolonged INR associated with warfarin in combination with both trazodone and omega-3 fatty acids. Archives of medical research. 2007. doi: 10.1016/j.arcmed.2007.05.004

[A2] Bender NK, Kraynak MA, Chiquette E, Linn WD, Clark GM, Bussey HI. Effects of Marine Fish Oils on the Anticoagulation Status of Patients Receiving Chronic Warfarin Therapy. Journal of thrombosis and thrombolysis. 1998. doi: 10.1023/a:1008852127668

[B1] Williams CP, Child DF, Hudson PR, Davies GK, Davies MG, John R 외. Why oral calcium supplements may reduce renal stone disease: report of a clinical pilot study. Journal of clinical pathology. 2001. doi: 10.1136/jcp.54.1.54

[B1] Gallagher JC, Smith LM, Yalamanchili V. Incidence of hypercalciuria and hypercalcemia during vitamin D and calcium supplementation in older women. Menopause (New York, N.Y.). 2014. doi: 10.1097/gme.0000000000000270

[B1] Domrongkitchaiporn S, Ongphiphadhanakul B, Stitchantrakul W, Chansirikarn S, Puavilai G, Rajatanavin R. Risk of calcium oxalate nephrolithiasis in postmenopausal women supplemented with calcium or combined calcium and estrogen. Maturitas. 2002. doi: 10.1016/s0378-5122(01)00277-8

[B1] Massey LK, Kynast-Gales SA. Substituting milk for apple juice does not increase kidney stone risk in most normocalciuric adults who form calcium oxalate stones. Journal of the American Dietetic Association. 1998. doi: 10.1016/s0002-8223(98)00071-6

[B1] Candelas G, Martinez-Lopez JA, Rosario MP, Carmona L, Loza E. Calcium supplementation and kidney stone risk in osteoporosis: a systematic literature review. Clinical and experimental rheumatology. 2012. https://pubmed.ncbi.nlm.nih.gov/23137489/

[B1] Heaney RP. Calcium supplementation and incident kidney stone risk: a systematic review. Journal of the American College of Nutrition. 2008. doi: 10.1080/07315724.2008.10719734

[B1] Coe FL, Parks JH, Webb DR. Stone-forming potential of milk or calcium-fortified orange juice in idiopathic hypercalciuric adults. Kidney international. 1992. doi: 10.1038/ki.1992.18

[B1] Sakhaee K, Griffith C, Pak CY. Biochemical control of bone loss and stone-forming propensity by potassium-calcium citrate after bariatric surgery. Surgery for obesity and related diseases : official journal of the American Society for Bariatric Surgery. 2012. doi: 10.1016/j.soard.2011.05.001

[B1] Domrongkitchaiporn S, Sopassathit W, Stitchantrakul W, Prapaipanich S, Ingsathit A, Rajatanavin R. Schedule of taking calcium supplement and the risk of nephrolithiasis. Kidney international. 2004. doi: 10.1111/j.1523-1755.2004.00587.x

[B1] Heller HJ, Doerner MF, Brinkley LJ, Adams-Huet B, Pak CY. Effect of dietary calcium on stone forming propensity. The Journal of urology. 2003. doi: 10.1097/01.ju.0000043669.63989.22

[B1] Müller D, Eggert P. Prolonged dietary calcium restriction: a diagnostic approach in idiopathic hypercalciuria. Nephron. 2001. doi: 10.1159/000046108

[B1] Rodgers AL. Effect of mineral water containing calcium and magnesium on calcium oxalate urolithiasis risk factors. Urologia internationalis. 1997. doi: 10.1159/000282958

[B1] Heilberg IP, Martini LA, Draibe SA, Ajzen H, Ramos OL, Schor N. Sensitivity to calcium intake in calcium stone forming patients. Nephron. 1996. doi: 10.1159/000189031

[B1] Messa P, Castellano G, Vettoretti S, Alfieri CM, Giannese D, Panichi V 외. Vitamin D and Calcium Supplementation and Urolithiasis: A Controversial and Multifaceted Relationship. Nutrients. 2023. doi: 10.3390/nu15071724

[B1] Hesswani C, Noureldin YA, Elkoushy MA, Andonian S. Combined vitamin D and calcium supplementation in vitamin D inadequate patients with urolithiasis: Impact on hypercalciuria and de novo stone formation. Canadian Urological Association journal = Journal de l'Association des urologues du Canada. 2015. doi: 10.5489/cuaj.3332

[B1] Stitchantrakul W, Sopassathit W, Prapaipanich S, Domrongkitchaiporn S. Effects of calcium supplements on the risk of renal stone formation in a population with low oxalate intake. The Southeast Asian journal of tropical medicine and public health. 2004. https://pubmed.ncbi.nlm.nih.gov/15916110/

[B1] Curhan GC, Willett WC, Rimm EB, Stampfer MJ. A prospective study of dietary calcium and other nutrients and the risk of symptomatic kidney stones. The New England journal of medicine. 1993. doi: 10.1056/nejm199303253281203

[B1] Nakada T, Sasagawa I, Furuta H, Katayama T, Shimazaki J. Effect of high-calcium diet on urinary oxalate excretion in urinary stone formers. European urology. 1988. doi: 10.1159/000473449

[B1] Tantasith C, Tubsaeng P, Boonkam K, Madared N, Boonla C. Measurement of precipitated calcium citrate in 24-hour urine samples is clinically useful for ruling out calcium oxalate urolithiasis. Science progress. 2026. doi: 10.1177/00368504251363660

[B1] Zhang W, Lou B, Peng Y, Wu F, Zhang D, Wang Q. High dietary calcium to phosphorus ratio is associated with high prevalence of kidney stone. Medicine. 2024. doi: 10.1097/md.0000000000040778

[B1] Borin JF, Knight J, Holmes RP, Joshi S, Goldfarb DS, Loeb S. Plant-Based Milk Alternatives and Risk Factors for Kidney Stones and Chronic Kidney Disease. Journal of renal nutrition : the official journal of the Council on Renal Nutrition of the National Kidney Foundation. 2022. doi: 10.1053/j.jrn.2021.03.011

[B1] Khooblall P, Morcos D, Mahmood F, Ricchiuti VS. Staged treatment for substantial bilateral calcium carbonate nephrolithiasis in vegan patient. Urology case reports. 2021. doi: 10.1016/j.eucr.2021.101831

[B1] Seeger H, Kaelin A, Ferraro PM, Weber D, Jaeger P, Ambuehl P 외. Changes in urinary risk profile after short-term low sodium and low calcium diet in recurrent Swiss kidney stone formers. BMC nephrology. 2017. doi: 10.1186/s12882-017-0755-7

[B1] Taylor EN, Curhan GC. Dietary calcium from dairy and nondairy sources, and risk of symptomatic kidney stones. The Journal of urology. 2013. doi: 10.1016/j.juro.2013.03.074

[B1] Sorensen MD, Eisner BH, Stone KL, Kahn AJ, Lui LY, Sadetsky N 외. Impact of calcium intake and intestinal calcium absorption on kidney stones in older women: the study of osteoporotic fractures. The Journal of urology. 2012. doi: 10.1016/j.juro.2011.11.109

[B1] Nishiura JL, Martini LA, Mendonça CO, Schor N, Heilberg IP. Effect of calcium intake on urinary oxalate excretion in calcium stone-forming patients. Brazilian journal of medical and biological research = Revista brasileira de pesquisas medicas e biologicas. 2002. doi: 10.1590/s0100-879x2002000600006

[B1] Harvey JA, Zobitz MM, Pak CY. Calcium citrate: reduced propensity for the crystallization of calcium oxalate in urine resulting from induced hypercalciuria of calcium supplementation. The Journal of clinical endocrinology and metabolism. 1985. doi: 10.1210/jcem-61-6-1223

[B1] Bataille P, Charransol G, Gregoire I, Daigre JL, Coevoet B, Makdassi R 외. Effect of calcium restriction on renal excretion of oxalate and the probability of stones in the various pathophysiological groups with calcium stones. The Journal of urology. 1983. doi: 10.1016/s0022-5347(17)51073-3

[B1] Allie S, Rodgers A. Effects of calcium carbonate, magnesium oxide and sodium citrate bicarbonate health supplements on the urinary risk factors for kidney stone formation. Clinical chemistry and laboratory medicine. 2003. doi: 10.1515/cclm.2003.008

[B1] Messa P, Marangella M, Paganin L, Codardini M, Cruciatti A, Turrin D 외. Different dietary calcium intake and relative supersaturation of calcium oxalate in the urine of patients forming renal stones. Clinical science (London, England : 1979). 1997. doi: 10.1042/cs0930257

[B2] Sardari Masihi L, Borumandnia N, Taheri M, Basiri A, Imani H, Jalali S 외. Effect of two vitamin D repletion protocols on 24-h urine calcium in patients with recurrent calcium kidney stones and vitamin D deficiency: a randomized clinical trial. European journal of medical research. 2023. doi: 10.1186/s40001-023-01226-z

[B2] Chandler PD, Scott JB, Drake BF, Ng K, Forman JP, Chan AT 외. Risk of hypercalcemia in blacks taking hydrochlorothiazide and vitamin D. The American journal of medicine. 2014. doi: 10.1016/j.amjmed.2014.02.044

[B2] Gallagher JC, Smith LM, Yalamanchili V. Incidence of hypercalciuria and hypercalcemia during vitamin D and calcium supplementation in older women. Menopause (New York, N.Y.). 2014. doi: 10.1097/gme.0000000000000270

[B2] Zwart SR, Parsons H, Kimlin M, Innis SM, Locke JP, Smith SM. A 250 μg/week dose of vitamin D was as effective as a 50 μg/d dose in healthy adults, but a regimen of four weekly followed by monthly doses of 1250 μg raised the risk of hypercalciuria. The British journal of nutrition. 2013. doi: 10.1017/s000711451300113x

[B2] Malihi Z, Lawes CMM, Wu Z, Huang Y, Waayer D, Toop L 외. Monthly high-dose vitamin D supplementation does not increase kidney stone risk or serum calcium: results from a randomized controlled trial. The American journal of clinical nutrition. 2019. doi: 10.1093/ajcn/nqy378

[B2] Ferroni MC, Rycyna KJ, Averch TD, Semins MJ. Vitamin D Repletion in Kidney Stone Formers: A Randomized Controlled Trial. The Journal of urology. 2017. doi: 10.1016/j.juro.2016.10.057

[B2] Malihi Z, Wu Z, Stewart AW, Lawes CM, Scragg R. Hypercalcemia, hypercalciuria, and kidney stones in long-term studies of vitamin D supplementation: a systematic review and meta-analysis. The American journal of clinical nutrition. 2016. doi: 10.3945/ajcn.116.134981

[B2] Alzaben N, Mokhtar A, Altwijri F, Alawaji S, Almannie R, Binsaleh S 외. Association Between Vitamin D Supplementation and Urolithiasis Recurrence Outcomes in Known Stone Formers: A Retrospective Cohort Study With Dose-Response Analysis. Cureus. 2025. doi: 10.7759/cureus.90853

[B2] Milart J, Jobs K, Tłustochowicz M, Pogonowska M, Kalicki B. The impact of vitamin D supplementation on vitamin D level, urinary calcium excretion and bone density in patients with hypercalciuria and vitamin D deficiency - preliminary report. Developmental period medicine. 2018. doi: 10.34763/devperiodmed.20182202.144152

[B2] Dickerson RN, Turner SC, Holmes WL, Van Matre ET, Swanson JM, Byerly S 외. Reduction in Hypercalcemia Following Readjustment of Target Serum 25-Hydroxy Vitamin D Concentration during Cholecalciferol Therapy in Vitamin D-Deficient Critically Ill Patients. Nutrients. 2022. doi: 10.3390/nu14081650

[B2] Chagnac A, Ori Y, Weinstein T, Zevin D, Korzets A, Hirsh J 외. Hypercalcemia during pulse vitamin D3 therapy in CAPD patients treated with low calcium dialysate: the role of the decreasing serum parathyroid hormone level. Journal of the American Society of Nephrology : JASN. 1997. doi: 10.1681/asn.v8101579

[B2] Theilade S, Yahyavi SK, Jensen MB, Eldrup E. Exacerbated hypercalcemia, nephrolithiasis, and renal impairment after vitamin D supplementation in granulomatous disease: a case report. Journal of medical case reports. 2025. doi: 10.1186/s13256-025-05078-5

[B2] Ferraro PM, Taylor EN, Gambaro G, Curhan GC. Vitamin D Intake and the Risk of Incident Kidney Stones. The Journal of urology. 2017. doi: 10.1016/j.juro.2016.08.084

[B2] Leaf DE, Korets R, Taylor EN, Tang J, Asplin JR, Goldfarb DS 외. Effect of vitamin D repletion on urinary calcium excretion among kidney stone formers. Clinical journal of the American Society of Nephrology : CJASN. 2012. doi: 10.2215/cjn.11331111

[B2] Shi L, Bao Y, Deng X, Xu X, Hu J. Association between calcium and vitamin D supplementation and increased risk of kidney stone formation in patients with osteoporosis in Southwest China: a cross-sectional study. BMJ open. 2025. doi: 10.1136/bmjopen-2024-092901

[B2] Sha S, Degen M, Vlaski T, Fan Z, Brenner H, Schöttker B. The Safety Profile of Vitamin D Supplements Using Real-World Data from 445,493 Participants of the UK Biobank: Slightly Higher Hypercalcemia Prevalence but Neither Increased Risks of Kidney Stones nor Atherosclerosis. Nutrients. 2024. doi: 10.3390/nu16142251

[B2] Messa P, Castellano G, Vettoretti S, Alfieri CM, Giannese D, Panichi V 외. Vitamin D and Calcium Supplementation and Urolithiasis: A Controversial and Multifaceted Relationship. Nutrients. 2023. doi: 10.3390/nu15071724

[B2] de Carvalho JF, Churilov LP. Safety of megadose of vitamin D in patients with nephrolithiasis. Nutrition (Burbank, Los Angeles County, Calif.). 2021. doi: 10.1016/j.nut.2021.111201

[B2] Bargagli M, Ferraro PM, Vittori M, Lombardi G, Gambaro G, Somani B. Calcium and Vitamin D Supplementation and Their Association with Kidney Stone Disease: A Narrative Review. Nutrients. 2021. doi: 10.3390/nu13124363

[B2] Hesswani C, Noureldin YA, Elkoushy MA, Andonian S. Combined vitamin D and calcium supplementation in vitamin D inadequate patients with urolithiasis: Impact on hypercalciuria and de novo stone formation. Canadian Urological Association journal = Journal de l'Association des urologues du Canada. 2015. doi: 10.5489/cuaj.3332

[B2] Haghighi A, Samimagham H, Gohardehi G. Calcium and vitamin D supplementation and risk of kidney stone formation in postmenopausal women. Iranian journal of kidney diseases. 2013. https://pubmed.ncbi.nlm.nih.gov/23689153/

[B2] Matsumoto N, Otomaru M, Asai K, Hara K, Tsuchiya T, Takebayashi K 외. Hypercalcemia with the Oral Administration of Active Vitamin D3 and Chinese Herbal Medicine. Internal medicine (Tokyo, Japan). 2025. doi: 10.2169/internalmedicine.4431-24

[B2] Repas SJ, Schmeusser BN, McCullough WP, Lehrer DS, Travers JB, McCullough PJ. Normal 24-hour urine calcium concentrations after long-term daily oral intake of vitamin D in doses ranging from 5000 to 50,000 international units in 14 adult hospitalized psychiatric patients. The Journal of steroid biochemistry and molecular biology. 2023. doi: 10.1016/j.jsbmb.2023.106329

[B2] Barth K, Sedivy M, Lindner G, Schwarz C. Successful treatment with denosumab for two cases with hypercalcemia due to vitamin D intoxication and associated acute kidney injury. CEN case reports. 2022. doi: 10.1007/s13730-021-00643-5

[B2] Lee M, Lee HI, Song K, Choi HS, Suh J, Kim SH 외. Association of hypercalciuria with vitamin D supplementation in patients undergoing ketogenic dietary therapy. Frontiers in nutrition. 2022. doi: 10.3389/fnut.2022.970467

[B2] Mio K, Haruhara K, Shimizu A, Oshiro K, Kawai R, Ikeda M 외. Hypercalcemia worsened after vitamin D supplementation in a sarcoidosis patient: A case report. Medicine. 2022. doi: 10.1097/md.0000000000030883

[B2] Vitale C, Marangella M, Bermond F, Fabbrini L, Tricerri A. Metabolic effects of cholecalciferol supplementation in patients with calcium nephrolithiasis and vitamin D deficiency. World journal of urology. 2021. doi: 10.1007/s00345-020-03222-y

[B2] Holmes WL, Maish GO, Minard G, Croce MA, Dickerson RN. Hypercalcemia Without Hypervitaminosis D During Cholecalciferol Supplementation in Critically Ill Patients. Nutrition in clinical practice : official publication of the American Society for Parenteral and Enteral Nutrition. 2020. doi: 10.1002/ncp.10407

[B2] Häusler D, Torke S, Weber MS. High-Dose Vitamin D-Mediated Hypercalcemia as a Potential Risk Factor in Central Nervous System Demyelinating Disease. Frontiers in immunology. 2020. doi: 10.3389/fimmu.2020.00301

[B2] Lynch Cronin I, Byrne F, Doyle R, Fraser WD, Chipchase A, Eustace JA. The Effect of Short-Term Vitamin D Supplementation on Calcium Status in Vitamin D Insufficient Renal Transplant Recipients at Risk of Hypercalcemia. Journal of renal nutrition : the official journal of the Council on Renal Nutrition of the National Kidney Foundation. 2019. doi: 10.1053/j.jrn.2018.11.012

[B3] Jiang K, Tang K, Liu H, Xu H, Ye Z, Chen Z. Ascorbic Acid Supplements and Kidney Stones Incidence Among Men and Women: A systematic review and meta-analysis. Urology journal. 2019. doi: 10.22037/uj.v0i0.4275

[B3] Lin WV, Turin CG, McCormick DW, Haas C, Constantine G. Ascorbic acid-induced oxalate nephropathy: a case report and discussion of pathologic mechanisms. CEN case reports. 2019. doi: 10.1007/s13730-018-0366-6

[B3] Prier M, Carr AC, Baillie N. No Reported Renal Stones with Intravenous Vitamin C Administration: A Prospective Case Series Study. Antioxidants (Basel, Switzerland). 2018. doi: 10.3390/antiox7050068

[B3] Neofytou IE, Lioulios G, Almaliotis E, Daikidou DV, Mplatsa A, Minasidis E. A case report of renal oxalosis and secondary hyperoxaluria due to chronic high vitamin C consumption. Clinical nephrology. Case studies. 2025. doi: 10.5414/cncs111462

[B3] Rathi S, Kern W, Lau K. Vitamin C-induced hyperoxaluria causing reversible tubulointerstitial nephritis and chronic renal failure: a case report. Journal of medical case reports. 2007. doi: 10.1186/1752-1947-1-155

[B3] Massey LK, Liebman M, Kynast-Gales SA. Ascorbate increases human oxaluria and kidney stone risk. The Journal of nutrition. 2005. doi: 10.1093/jn/135.7.1673

[B3] Schwille PO, Schmiedl A, Herrmann U, Manoharan M, Fan J, Sharma V 외. Ascorbic acid in idiopathic recurrent calcium urolithiasis in humans--does it have an abettor role in oxalate, and calcium oxalate crystallization?. Urological research. 2000. doi: 10.1007/s002400000101

[B3] Urivetzky M, Kessaris D, Smith AD. Ascorbic acid overdosing: a risk factor for calcium oxalate nephrolithiasis. The Journal of urology. 1992. doi: 10.1016/s0022-5347(17)37521-3

[B3] Kemble JP, Liaw CW, Alamiri JM, Ungerer GN, Potretzke AM, Koo K. Public Interest in Vitamin C Supplementation During the COVID-19 Pandemic as a Potential Risk for Oxalate Nephrolithiasis. Cureus. 2025. doi: 10.7759/cureus.79452

[B3] Moyad MA, Combs MA, Crowley DC, Baisley JE, Sharma P, Vrablic AS 외. Vitamin C with metabolites reduce oxalate levels compared to ascorbic acid: a preliminary and novel clinical urologic finding. Urologic nursing. 2009. https://pubmed.ncbi.nlm.nih.gov/19507407/

[B3] Gerster H. No contribution of ascorbic acid to renal calcium oxalate stones. Annals of nutrition & metabolism. 1997. doi: 10.1159/000177954

[B3] Fijen L, Weijmer M. Acute oxalate nephropathy due to high vitamin C doses and exocrine pancreatic insufficiency. BMJ case reports. 2019. doi: 10.1136/bcr-2019-231504

[B3] Noureldin YA, da Silva A, Fahmy N, Andonian S. Is it safe to prescribe ascorbic acid for urinary acidification in stone-forming patients with alkaline urine?. Turkish journal of urology. 2017. doi: 10.5152/tud.2017.02700

[B3] Ferraro PM, Curhan GC, Gambaro G, Taylor EN. Total, Dietary, and Supplemental Vitamin C Intake and Risk of Incident Kidney Stones. American journal of kidney diseases : the official journal of the National Kidney Foundation. 2016. doi: 10.1053/j.ajkd.2015.09.005

[B3] Farhat S, Houssam A, Ghassaoui A, Khaled EA, El Khoury M. A case of reversible hyperoxaluria nephropathy early after roux-en-y-gastric bypass induced by vitamin C intake. Oxford medical case reports. 2016. doi: 10.1093/omcr/omw054

[B3] Peña de la Vega L, Lieske JC, Milliner D, Gonyea J, Kelly DG. Urinary oxalate excretion increases in home parenteral nutrition patients on a higher intravenous ascorbic acid dose. JPEN. Journal of parenteral and enteral nutrition. 2004. doi: 10.1177/0148607104028006435

[B3] Hatch M, Mulgrew S, Bourke E, Keogh B, Costello J. Effect of megadoses of ascorbic acid on serum and urinary oxalate. European urology. 1980. doi: 10.1159/000473318

[B3] Lamarche J, Nair R, Peguero A, Courville C. Vitamin C-induced oxalate nephropathy. International journal of nephrology. 2011. doi: 10.4061/2011/146927

[B3] Singh PP, Kiran R, Pendse AK, Gosh R, Surana SS. Ascorbic acid is an abettor in calcium urolithiasis: an experimental study. Scanning microscopy. 1993. https://pubmed.ncbi.nlm.nih.gov/8146605/

[B3] Chai W, Liebman M, Kynast-Gales S, Massey L. Oxalate absorption and endogenous oxalate synthesis from ascorbate in calcium oxalate stone formers and non-stone formers. American journal of kidney diseases : the official journal of the National Kidney Foundation. 2004. doi: 10.1053/j.ajkd.2004.08.028

[B3] Auer BL, Auer D, Rodgers AL. The effect of ascorbic acid ingestion on the biochemical and physicochemical risk factors associated with calcium oxalate kidney stone formation. Clinical chemistry and laboratory medicine. 1998. doi: 10.1515/cclm.1998.027

[B3] Schwille PO, Schmiedl A, Herrmann U, Wipplinger J. Postprandial hyperinsulinaemia, insulin resistance and inappropriately high phosphaturia are features of younger males with idiopathic calcium urolithiasis: attenuation by ascorbic acid supplementation of a test meal. Urological research. 1997. doi: 10.1007/bf00941906

[B3] Simon JA, Hudes ES. Relation of serum ascorbic acid to serum vitamin B12, serum ferritin, and kidney stones in US adults. Archives of internal medicine. 1999. doi: 10.1001/archinte.159.6.619

[B3] Auer BL, Auer D, Rodgers AL. Relative hyperoxaluria, crystalluria and haematuria after megadose ingestion of vitamin C. European journal of clinical investigation. 1998. doi: 10.1046/j.1365-2362.1998.00349.x

[B3] Morgan SH, Maher ER, Purkiss P, Watts RW, Curtis JR. Oxalate metabolism in end-stage renal disease: the effect of ascorbic acid and pyridoxine. Nephrology, dialysis, transplantation : official publication of the European Dialysis and Transplant Association - European Renal Association. 1988. https://pubmed.ncbi.nlm.nih.gov/3132636/

[B3] Tiselius HG, Almgård LE. The diurnal urinary excretion of oxalate and the effect of pyridoxine and ascorbate on oxalate excretion. European urology. 1977. doi: 10.1159/000472053

## 부록. 재현 파일

재현 환경은 Node.js, Python과 requirements-v3.txt에 고정한 패키지로 구성한다. 먼저 build_systematic_review_v3.py와 build_core_evidence_v3.py를 순서대로 실행하고, validate_core_evidence_v3.py로 스키마·식별자·질문 범위·규칙 연결을 검사한다. 이어 capture_software_quality_v3.mjs로 테스트, lint, TypeScript와 Production build 결과를 고정한 뒤 논문 생성·PDF 렌더링·논문 검증을 수행한다.

아래 SHA-256은 본 문서를 생성한 입력을 식별한다. 해시가 달라지면 수치와 표를 수동 수정하지 않고 전체 생성 절차를 다시 실행해야 한다. 공개할 수 없는 원문은 저장소에 포함하지 않으며, 공개 locator와 서지정보만 보존한다.