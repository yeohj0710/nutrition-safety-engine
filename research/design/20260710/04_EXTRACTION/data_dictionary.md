# 자료추출 데이터 사전

## 1. 식별자

| 필드 | 정의 |
|---|---|
| record_id | 검색 결과 레코드 ID |
| report_id | 논문·초록·등록자료 등 보고물 ID |
| study_id | 동일 연구를 묶는 ID |
| source_id | 출처 레지스트리 ID |
| question_ids | A1~B3 복수 가능 |

## 2. 서지·연구 상태

- title
- authors
- year
- journal
- DOI, PMID, PMCID, trial registration
- publication_status
- retraction_or_correction_status
- evidence_layer

## 3. 연구설계

- design_family
- design_detail
- recruitment setting and country
- recruitment dates
- follow-up duration
- number of centers
- funding
- conflicts of interest
- protocol/registration availability

설계명을 논문 저자의 표현만 복사하지 않는다. 실제 할당과 추적 구조를 보고 분류한다.

## 4. 대상자

- total randomized/enrolled/analyzed
- arm sizes
- age summary
- sex distribution
- anticoagulant type and indication
- stone history or metabolic risk definition
- inclusion/exclusion criteria
- baseline risk factors
- subgroup extractability

## 5. 노출

- ingredient canonical name
- product/formulation
- EPA/DHA composition or vitamin form
- dose as reported
- normalized dose and unit
- frequency
- duration
- route
- timing with meals
- co-supplements and co-medications
- exposure adherence

단위 변환은 원래 값과 변환 공식을 모두 보존한다.

## 6. 비교군

- placebo/no supplement/usual care/dietary exposure/other dose
- comparator formulation and dose
- background treatment equality

## 7. 결과

각 결과는 long format 한 행으로 관리한다.

- outcome_id and canonical outcome
- author-defined outcome
- clinical versus surrogate
- time point
- arm event count and denominator
- continuous mean, SD, median, IQR
- effect measure and estimate
- lower and upper confidence limits
- adjusted or unadjusted
- covariates
- analysis population
- missing data
- adverse event ascertainment

## 8. 원문 위치

- supporting_quote
- page_number
- section_heading
- table_or_figure
- paragraph_or_row locator
- source_file_sha256

페이지가 없는 HTML은 heading과 인접 문구를 사용한다. “초록 참고”만으로 위치를 대신하지 않는다.

## 9. 해석 필드

해석 필드는 사실 필드와 분리한다.

- directness_to_question
- applicability_notes
- result_direction
- clinical_importance_notes
- extraction_uncertainty
- discrepancy_notes

## 10. 품질과 검증

- extracted_by
- extracted_at
- verified_by
- verified_at
- verification_status
- AI run ID if applicable
- human corrections

핵심 숫자와 규칙으로 연결되는 문장은 반드시 `verified` 상태여야 한다.
