# 산출물 파일명 규칙

## 원칙

- 이름만 보고 단계와 버전을 알 수 있게 한다.
- “최종”, “진짜최종”, “최종2”를 사용하지 않는다.
- 날짜는 `YYYYMMDD`.
- 프로토콜과 데이터 bundle은 semantic version.
- 생성 파일은 원천과 분리한다.

## 예

```text
protocol_v1.0_20260717.md
search_A1_pubmed_20260720.nbib
search_log_v1.0.csv
screening_decisions_v1.0.csv
extraction_gold_v1.0.csv
analysis_release_v1.0/
claims_v1.0.jsonl
rules_v1.0.jsonl
scenario_gold_v1.0.csv
thesis_draft_v0.3_20261120.docx
thesis_submission_v1.0_20261215.pdf
```

## 금지

```text
최종본.pdf
최종본수정.pdf
진짜최종.pdf
새 폴더/최종/최종2/
```
