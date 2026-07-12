# 사람 자료추출 데이터 사전

상태: `human_extraction_template_v1_not_results`

이 사전은 `data/interim/extractions_human.csv`의 55개 열과 정확히 대응한다. 한 행은 한 보고서의 한 질문·한 결과·한 시점을 뜻한다. 값이 없다는 이유로 0을 입력하지 않는다. 보고되지 않았으면 빈칸으로 두고 `notes`에 이유를 적는다.

## 입력 원칙

1. `study_id`, `report_id`, `source_id`는 검증된 study–report–source 계보에서만 가져온다.
2. 사건수·분모·효과추정치·신뢰구간을 입력하면 이를 지지하는 `supporting_quote`, 위치정보, `source_file_sha256`을 함께 기록한다.
3. 원 보고값과 정규화값을 구분한다. `dose_reported`는 원문 그대로, `dose_normalized`와 `dose_unit`은 사전 정의된 변환 후 값이다.
4. 한 행에 여러 결과나 여러 시점을 합치지 않는다.
5. 추출자와 검증자는 서로 달라야 한다. `verification_status=verified` 전에는 분석·claim·rule 입력으로 승격할 수 없다.
6. AI 출력은 이 파일에 자동 입력하지 않는다. 사람이 원문과 locator를 대조한 값만 기록한다.

## 55개 필드

정확한 자료형·허용값·조건부 필수 규칙은 같은 폴더의 `data_dictionary.csv`를 따른다. 주요 묶음은 다음과 같다.

- 계보: `extraction_id`부터 `question_id`
- 연구설계·대상자: `evidence_layer`부터 `indication`
- 노출·비교: `exposure_ingredient`부터 `comparator`
- 결과·시점: `outcome_canonical`부터 `covariates`
- 원문 위치: `supporting_quote`부터 `source_file_sha256`
- 사람 검증: `extracted_by`부터 `notes`

## 수치와 locator 규칙

- 이분형 결과: 각 군의 사건수와 해당 결과 분모를 같은 행에 기록한다.
- 연속형 결과: 원문에 제시된 요약값을 JSON 또는 `평균 (SD)`처럼 손실 없이 기록하고 `notes`에 형식을 설명한다.
- 효과크기: `effect_measure`, `effect_estimate`, `ci_lower`, `ci_upper`를 함께 기록한다. 신뢰구간이 없으면 임의 계산하지 않는다.
- 페이지 문서: `page`와 `section`을 기록한다. 표·그림이면 `table_figure`도 기록한다.
- XML/HTML: `page`에는 재현 가능한 XML locator 또는 문단 locator를 기록하고 `section`에 절 제목을 기록한다.
- 모든 추출 행은 실제 source byte의 SHA-256을 `source_file_sha256`에 기록한다.

이 파일과 CSV 사전은 입력 안내일 뿐 연구 결과가 아니다.
