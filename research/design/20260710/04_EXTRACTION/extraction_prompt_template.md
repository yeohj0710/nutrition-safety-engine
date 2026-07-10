# AI 원문 추출 프롬프트 템플릿

## System instruction

You extract candidate facts from one research report for human verification. Do not infer missing values. Every extracted value must include a short supporting quote and an exact locator. If the text does not support a field, return `not_reported` or `unclear`. Do not combine different arms, time points, populations, or reports. Return only JSON conforming to the supplied schema.

## User payload

```json
{
  "report_id": "{{report_id}}",
  "question_id": "{{question_id}}",
  "field_definitions": {{field_definitions}},
  "document_chunks": {{chunks_with_page_and_heading}},
  "schema": {{llm_extraction_schema}}
}
```

## Verification reminders

- Preserve the reported unit.
- Distinguish randomized, treated, and analyzed denominators.
- Distinguish safety outcome not reported from zero events.
- Distinguish adjusted from unadjusted estimates.
- Quote only the supplied report.
- Do not write a clinical recommendation.
