# Safety Engine Reference Pack v0.1

생성시각: 2026-03-22T16:58:00Z

## 이 팩이 하는 일
이 팩은 건강기능식품/영양소 **안전 검증 엔진**을 만들 때 바로 개발에 넣을 수 있도록,
다음 4개 핵심 테이블을 정규화해서 제공합니다.

1. `source_registry.json`
   - 논문/정부문서/규정/데이터셋 메타데이터
2. `ingredients.json`
   - 원료/영양소 표준 ID와 alias
3. `evidence_chunks.json`
   - **논문의 어떤 부분 / 문서의 어느 위치**를 근거로 쓸지 저장하는 청크 레이어
4. `safety_rules.json`
   - 실제 엔진 규칙 레이어

즉, **JSON 하나로 끝내는 구조가 아니라, 확장 가능한 정규화 구조 + SQL 스키마 + 엑셀 뷰**를 같이 줍니다.

## 왜 단일 JSON보다 이 구조가 더 좋은가
단일 JSON은 빨리 시작하기엔 편하지만, 아래 문제가 생깁니다.

- 같은 논문을 여러 규칙이 재사용할 때 중복이 커짐
- 한국/미국/EU 기준이 충돌할 때 관리가 어려움
- 나중에 premium DB(Micromedex/Natural Medicines/USP) 연동 시 구조가 깨짐
- “이 규칙이 정확히 어떤 문장/어느 줄에서 왔는지” 추적이 어려움

그래서 이 팩은 다음 원칙으로 설계했습니다.

- `source` 와 `evidence_chunk` 분리
- `ingredient` 와 `rule` 분리
- `rule -> evidence_chunk -> source`로 역추적 가능
- `jurisdiction`, `threshold_scope`, `review_status` 독립 보관
- 샘플 엔진 입출력(`sample_evaluation_input.json`, `sample_engine_output.json`) 포함

## 폴더 구조
- `schemas/`
  - JSON Schema
- `data/`
  - 실제 데이터(JSON)
- `exports/`
  - CSV / XLSX
- `docs/`
  - SQL 스키마, 확장 가이드

## 핵심 엔티티 관계
```text
source_registry (문헌/규정/DB)
    1 --- N evidence_chunks (문헌 내 위치 단위 근거)

ingredients (원료/영양소 사전)
    1 --- N safety_rules (해당 원료 규칙)

evidence_chunks
    N --- N safety_rules
    (현재는 rule row에 evidence_chunk_ids 배열로 연결)
```

## 주요 필드 설명

### source_registry
- `source_id`: 고유 소스 ID
- `title`: 논문/문서 제목
- `source_type`: rct, review, government_fact_sheet, regulation_notice 등
- `jurisdiction`: KR / US / EU / GLOBAL
- `evidence_tier`: national_reference, regulation, systematic_review_meta_analysis 등
- `access_model`: public / licensed
- `ingestion_status`: ingested_chunked / catalog_only / planned

### evidence_chunks
- `chunk_id`: 고유 청크 ID
- `source_id`: 어떤 문헌에서 왔는지
- `locator_type`: lines / abstract / section / pdf_page / manual_note
- `locator_value`: **논문/문서 내 위치**
- `excerpt_summary_ko`: 한국어 요약
- `structured_claim`: 엔진이 바로 쓰기 쉬운 구조화 claim

### safety_rules
- `rule_id`: 고유 규칙 ID
- `ingredient_id`: 대상 성분
- `rule_category`: dose_limit / interaction / pregnancy_lactation / disease_caution 등
- `severity`: contraindicated / avoid / warn / monitor
- `applies_when`: 연령, 성별, 질환, 약물, 흡연력 등 조건 JSON
- `threshold_*`: 수치 기준
- `evidence_chunk_ids`: 어떤 chunk가 근거인지
- `review_status`: starter_validated / starter_hypothesis

## 현재 포함된 성분 범위
비타민/미네랄 + 대표 위험원료 중심 24개 성분:
- 비타민 A(프리폼드), 베타카로틴, 비타민 D, 칼슘, 마그네슘, 철, 엽산, 비타민 K
- 오메가3, 아연, 셀레늄, 요오드, 나이아신, 비타민 B6
- St. John’s wort, Red yeast rice, Green tea extract, Melatonin, Probiotics
- Ashwagandha, Asian ginseng, Glucosamine/Chondroitin, CoQ10, Garcinia cambogia

## review_status 해석
- `starter_validated`: 공개 근거와 현재 수집 범위에서 엔진 스타터팩으로 사용 가능
- `starter_hypothesis`: 추가 검증 전 hard-stop으로 쓰기보다 manual review 대상으로 권장

## 확장 방법
1. 새 문헌을 `source_registry`에 추가
2. 문헌에서 쓸 문장/표/절을 `evidence_chunks`로 추가
3. 성분 alias를 `ingredients`에 추가
4. `safety_rules`에 rule row 추가
5. 샘플 엔진 테스트를 돌려 regression 확인

## 권장 다음 작업
- 2025 한국인 영양소 섭취기준을 nutrient x age x sex x life_stage row로 완전 분해
- 식품안전나라 제품별 섭취주의를 제품 레벨 테이블로 분리
- MFDS 이상사례 데이터를 signal table로 추가
- 질환/검사값/약물 표준코드(RxNorm, ATC, ICD, LOINC 등) 매핑 레이어 추가

## 주의
이 팩은 **엔진 스타터팩**입니다.
의료행위 대체용이 아니라, 안전 필터링/근거 추적/개발 스키마 구축용 초기 베이스입니다.
