# 핵심 데이터 계약

## 1. 공통 규칙

- 모든 ID는 불변이다.
- 날짜는 ISO 8601이다.
- 원자료 값과 정규화 값을 구분한다.
- 빈 문자열과 `null`의 의미를 통일한다.
- 다중 값은 구분자로 억지 저장하지 않고 JSON 배열 또는 연결 테이블을 사용한다.
- 각 파일은 `schema_version` 또는 release manifest에 연결된다.

## 2. Record

```text
record_id
search_run_id
source_database
source_native_id
raw_title
raw_abstract
raw_authors
raw_year
raw_doi
raw_pmid
raw_trial_id
raw_file_sha256
normalized_title
canonical_record_id
duplicate_cluster_id
```

Record는 검색 결과다. 연구 결과 단위가 아니다.

## 3. Report

```text
report_id
source_id
record_ids[]
full_text_status
publication_status
report_type
file_sha256
```

## 4. Study

```text
study_id
report_ids[]
trial_registration_ids[]
study_name
recruitment_period
population_summary
linkage_evidence
```

## 5. Screening decision

```text
record_or_report_id
stage
reviewer_id
decision
reason_code
decided_at
adjudication_status
final_decision
```

원래 독립 판단을 삭제하지 않는다.

## 6. Extraction

한 행은 한 연구·보고물·질문·결과·시점의 값이다. 효과크기와 사건 수를 같은 셀의 문장으로 저장하지 않는다.

## 7. Source

```text
source_id
layer
source_type
bibliographic identifiers
access status
version/update date
license/access note
```

## 8. Evidence claim

Claim은 사람이 읽을 수 있는 하나의 검증된 주장이다. 원문 support 배열을 필수로 가진다. `supporting_quote`와 locator가 없는 claim은 `validated`가 될 수 없다.

## 9. Rule

Rule은 조건과 고정 행동을 담는다. claim ID를 필수로 참조하고, scope와 validation 상태를 가진다.

## 10. Scenario

Scenario는 입력과 gold output, 실제 output을 분리한다. gold를 수정해 실제 출력에 맞추지 않는다.

## 11. Run metadata

모든 자동 실행은 다음을 기록한다.

```text
run_id
run_type
started_at
finished_at
operator_or_agent
code_commit
input_manifest_sha256
configuration_sha256
model_metadata_if_any
output_manifest_sha256
status
```

## 12. 단위

- vitamin D: IU와 microgram 원값 보존, 변환값 별도
- calcium: elemental calcium 여부 필수
- omega-3: total oil, EPA, DHA를 분리
- vitamin K: microgram과 형태 분리
- vitamin C: mg/day 기준 정규화 가능하되 원본 보존
- laboratory values: 단위와 기준범위 보존

단위가 불명확하면 추정하지 않고 `unit_unknown`으로 둔다.
