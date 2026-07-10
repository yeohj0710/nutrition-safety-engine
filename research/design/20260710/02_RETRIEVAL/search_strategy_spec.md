# 문헌검색 실행 규격

## 1. 목적

검색은 문헌 수를 크게 보이게 만드는 절차가 아니다. 사전 지정 포함 기준에 맞는 연구를 가능한 한 놓치지 않고 찾고, 다른 연구자가 같은 플랫폼에서 다시 실행할 수 있도록 기록하는 절차다.

## 2. 검색 전 준비

1. 다섯 질문의 population, exposure, outcome 정의를 확정한다.
2. 기존 10개 핵심근거와 알려진 sentinel study를 질문별로 정리한다.
3. 검색식이 sentinel study를 회수하는지 확인한다.
4. MEDLINE 검색식을 정보전문가 또는 경험 있는 검토자에게 동료 검토받는다.
5. 데이터베이스 접근, 내보내기 제한, 원문 접근 경로를 `access_matrix.csv`에 기록한다.

## 3. 데이터베이스

### 필수

- MEDLINE: PubMed 또는 기관 플랫폼. 사용 플랫폼을 명시한다.
- Cochrane CENTRAL
- ClinicalTrials.gov
- WHO ICTRP

### 접근 가능 시 필수

- Embase
- Scopus 또는 Web of Science 중 하나

### 국내 보완

- KoreaMed
- KMbase
- RISS

국내 자료원은 같은 내용을 중복 검색할 수 있으므로 실제 제공 범위와 내보내기 형식을 먼저 확인한다.

## 4. 검색 개념 수

기본 검색은 population과 exposure 두 개의 중심 개념을 사용한다. 안전성 outcome 단어를 반드시 AND로 묶으면 관련 연구를 놓칠 수 있으므로, outcome block은 다음 경우에만 사용한다.

- 파일럿에서 결과 수가 현실적으로 처리 불가능할 때
- outcome 없이 검색한 결과의 정밀도가 극히 낮을 때
- outcome block을 추가해도 sentinel study 회수가 유지될 때

연구설계 필터도 같은 원칙을 적용한다. 사용 시 검증된 고감도 필터를 우선한다.

## 5. PubMed 초안

아래 검색식은 시작점이다. 최종 실행 전 MeSH 폭발, 구문, 필드, 철자, 상품명, 지역 약물명을 검토한다.

### A1: Vitamin K와 VKA

```text
(
  "Warfarin"[Mesh] OR warfarin[tiab]
  OR "Vitamin K Antagonists"[Mesh]
  OR "vitamin K antagonist"[tiab] OR "vitamin K antagonists"[tiab]
  OR VKA[tiab] OR VKAs[tiab]
  OR acenocoumarol[tiab] OR phenprocoumon[tiab]
)
AND
(
  "Vitamin K"[Mesh] OR "vitamin K"[tiab]
  OR phylloquinone[tiab] OR menaquinone*[tiab]
  OR "MK-7"[tiab] OR MK7[tiab]
  OR "vitamin K supplement"[tiab] OR "vitamin K supplementation"[tiab]
  OR "vitamin K intake"[tiab] OR "dietary vitamin K"[tiab]
)
```

### A2: Omega-3와 경구 항응고제

```text
(
  "Anticoagulants"[Mesh]
  OR anticoagulan*[tiab] OR warfarin[tiab]
  OR "vitamin K antagonist"[tiab] OR VKA[tiab]
  OR "direct oral anticoagulant"[tiab] OR DOAC[tiab] OR DOACs[tiab]
  OR apixaban[tiab] OR rivaroxaban[tiab] OR edoxaban[tiab] OR dabigatran[tiab]
)
AND
(
  "Fatty Acids, Omega-3"[Mesh]
  OR omega-3[tiab] OR omega3[tiab] OR n-3[tiab]
  OR "fish oil"[tiab] OR "fish oils"[tiab]
  OR eicosapentaenoic[tiab] OR EPA[tiab]
  OR docosahexaenoic[tiab] OR DHA[tiab]
  OR icosapent[tiab]
)
```

### B1: 보충제 칼슘과 신결석 위험

```text
(
  "Kidney Calculi"[Mesh] OR nephrolithiasis[tiab] OR urolithiasis[tiab]
  OR "kidney stone"[tiab] OR "kidney stones"[tiab]
  OR "renal stone"[tiab] OR "renal stones"[tiab]
  OR hypercalciuria[tiab] OR "calcium oxalate"[tiab]
)
AND
(
  "Calcium, Dietary"[Mesh] OR "Calcium Carbonate"[Mesh]
  OR "calcium supplement"[tiab] OR "calcium supplements"[tiab]
  OR "calcium supplementation"[tiab]
  OR "supplemental calcium"[tiab]
  OR "calcium carbonate"[tiab] OR "calcium citrate"[tiab]
)
```

### B2: 비타민 D와 신결석 위험

```text
(
  "Kidney Calculi"[Mesh] OR nephrolithiasis[tiab] OR urolithiasis[tiab]
  OR "kidney stone"[tiab] OR "kidney stones"[tiab]
  OR hypercalciuria[tiab] OR hypercalcemia[tiab]
  OR "calcium oxalate"[tiab]
)
AND
(
  "Vitamin D"[Mesh] OR "vitamin D"[tiab]
  OR cholecalciferol[tiab] OR ergocalciferol[tiab]
  OR calcifediol[tiab] OR "vitamin D supplement"[tiab]
  OR "vitamin D supplementation"[tiab]
)
```

### B3: 비타민 C와 신결석 위험

```text
(
  "Kidney Calculi"[Mesh] OR nephrolithiasis[tiab] OR urolithiasis[tiab]
  OR "kidney stone"[tiab] OR "kidney stones"[tiab]
  OR hyperoxaluria[tiab] OR oxalate[tiab]
  OR "calcium oxalate"[tiab]
)
AND
(
  "Ascorbic Acid"[Mesh] OR "vitamin C"[tiab]
  OR "ascorbic acid"[tiab] OR ascorbate[tiab]
  OR "vitamin C supplement"[tiab] OR "vitamin C supplementation"[tiab]
)
```

## 6. 변환 원칙

- Embase: MeSH를 Emtree로 번역하고, 자유어는 제목·초록·저자키워드 필드를 사용한다.
- CENTRAL: RCT 색인 자료원이므로 불필요한 RCT 필터를 추가하지 않는다.
- Scopus/Web of Science: 제목·초록·키워드를 사용하며 인용추적을 별도 기록한다.
- 국내 자료원: 한글 성분명, 질환명, 약물명과 영문을 함께 사용한다.
- 등록자료원: 간결한 population-exposure 검색을 여러 번 실행하고 각 실행을 따로 기록한다.

## 7. 제한

- 검색 단계에서 언어 제한을 두지 않는다.
- 시작 연도 제한은 원칙적으로 두지 않는다.
- 사람 필터는 데이터베이스 특성과 누락 위험을 검토한 뒤 사용한다.
- 검색 결과를 관련도 상위 N개로 자르지 않는다.
- 플랫폼 내보내기 한계가 있으면 날짜·ID 범위로 나누어 전수 내보내고 결합한다.

## 8. 원본 보존

권장 경로:

```text
research/searches/<question_id>/<database>/<run_id>/
  query.txt
  results_original.<ris|nbib|xml|csv>
  response_metadata.json
  checksum.sha256
  notes.md
```

원본은 수정하지 않는다. 정규화 자료는 `data/interim`에 새 파일로 만든다.

## 9. 검색 업데이트

최종 검색 후 논문 제출 전 3개월 이상 지났으면 업데이트 검색을 수행한다. 기존 검색 종료일 다음 날부터 검색하고, 신규 결과를 같은 절차로 선별한다.

## 10. 검색 완료 기준

- 다섯 질문의 모든 계획 자료원에서 실행 완료 또는 차단 사유 기록
- 각 검색식 전문 저장
- 총 결과 수와 내보낸 수 설명 가능
- 원본 파일 해시 존재
- sentinel study 회수 확인
- 동료 검토 의견과 수정 기록 존재
- 상위 N 제한 없음
