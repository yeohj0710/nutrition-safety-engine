# 플랫폼 변환 초안

상태: `pending_PRESS_and_access_confirmation`. PubMed 원문은 질문별 `.txt`가 정본이다.

## Embase.com

- PubMed population/exposure 두 블록 구조를 유지한다.
- MeSH는 Emtree preferred term과 explosion으로 변환한다.
- 자유어는 `:ti,ab,kw`를 사용한다.
- A2의 `EPA`는 약어 단독 오탐을 sentinel/표본으로 점검한다.
- 등록·회의초록을 임의 제외하지 않는다. 실제 syntax는 인증 접근에서 Emtree 매핑 후 동결한다.

## CENTRAL

- MeSH descriptor와 title/abstract/keyword 자유어를 결합한다.
- CENTRAL 자체가 시험 레지스터이므로 별도 RCT 필터를 추가하지 않는다.
- 질문별 population AND exposure를 유지한다.

## Scopus 또는 Web of Science

- Scopus: `TITLE-ABS-KEY(population) AND TITLE-ABS-KEY(exposure)`.
- Web of Science: `TS=(population) AND TS=(exposure)`.
- 기관이 실제 제공하는 한 플랫폼만 최종 필수 보완원으로 동결한다.

## ClinicalTrials.gov API v2

질문별로 간결한 `query.cond`와 `query.intr` 조합을 나누어 실행한다. 한 번의 긴 OR 검색에 의존하지 않는다. `pageSize=1000`과 `nextPageToken`으로 전 페이지를 회수한다.

| 질문 | condition 초안 | intervention/other terms 초안 |
|---|---|---|
| A1 | anticoagulation OR warfarin | vitamin K OR phylloquinone |
| A2 | anticoagulation OR atrial fibrillation OR venous thromboembolism | omega-3 OR fish oil OR EPA OR DHA OR icosapent |
| B1 | kidney stone OR nephrolithiasis OR hypercalciuria | calcium supplement OR calcium carbonate OR calcium citrate |
| B2 | kidney stone OR nephrolithiasis OR hypercalciuria | vitamin D OR cholecalciferol OR ergocalciferol |
| B3 | kidney stone OR nephrolithiasis OR hyperoxaluria | vitamin C OR ascorbic acid |

## WHO ICTRP

표준검색은 title/condition/intervention 등 여러 필드를 검색하고 따옴표·Boolean·괄호를 지원한다. 각 질문을 population과 exposure의 짧은 조합 여러 개로 실행하고 XML 원본을 합친다. 자동 crawling은 자격증명이 필요하므로 수동 XML export 또는 승인된 bulk access를 기록한다.

## KoreaMed·KMbase·RISS

질환 블록: `(신결석 OR 요로결석 OR 콩팥결석 OR nephrolithiasis OR urolithiasis OR kidney stone)`.

- A1: `(와파린 OR warfarin OR 비타민 K OR vitamin K)` 조합을 분할 실행한다.
- A2: `(항응고제 OR 와파린 OR DOAC) AND (오메가-3 OR 어유 OR EPA OR DHA)`.
- B1: 질환 블록 AND `(칼슘 보충제 OR calcium supplement)`.
- B2: 질환 블록 AND `(비타민 D OR vitamin D OR cholecalciferol)`.
- B3: 질환 블록 AND `(비타민 C OR vitamin C OR ascorbic acid)`.

플랫폼별 구문과 export 한계는 실제 접근 세션에서 PRESS 검토와 함께 동결한다. 접근하지 못한 플랫폼의 번역을 최종 검색식으로 가장하지 않는다.
