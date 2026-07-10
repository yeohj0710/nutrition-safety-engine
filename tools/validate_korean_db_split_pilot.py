#!/usr/bin/env python3
import hashlib
import json
import re
import gzip
from pathlib import Path

ROOT = Path("research/searches/korean_db_split_designpilot_20260710")
SUMMARY = ROOT / "summary.json"


def main() -> int:
    errors: list[str] = []
    data = json.loads(SUMMARY.read_text(encoding="utf-8"))
    runs = data.get("runs", [])
    if data.get("status") != "split_query_design_pilot_raw_responses_not_final_search":
        errors.append("unsafe or unexpected status")
    if data.get("query_pairs") != 20 or data.get("response_count") != 40 or len(runs) != 40:
        errors.append("expected 20 query pairs and 40 responses")
    if data.get("records_exported") != 0 or data.get("human_screening_decisions") != 0:
        errors.append("design pilot must not claim exports or human decisions")
    if data.get("query_translation_validated") is not False or data.get("final_search_claim_allowed") is not False:
        errors.append("design pilot safety flags must remain false")

    platforms = {"KMbase": 0, "RISS": 0}
    questions = {"A1": 0, "A2": 0, "B1": 0, "B2": 0, "B3": 0}
    paired_queries: dict[tuple[str, str], set[str]] = {}
    for index, run in enumerate(runs):
        platform = run.get("platform")
        question = run.get("question_id")
        if platform not in platforms:
            errors.append(f"run {index}: unknown platform")
            continue
        platforms[platform] += 1
        paired_queries.setdefault((str(question), str(run.get("query"))), set()).add(platform)
        if question not in questions:
            errors.append(f"run {index}: unknown question")
        else:
            questions[question] += 1
        path = ROOT / run.get("response_file", "")
        if not path.is_file():
            errors.append(f"run {index}: missing raw response")
            continue
        payload = path.read_bytes()
        if len(payload) != run.get("response_bytes"):
            errors.append(f"run {index}: byte-size mismatch")
        if hashlib.sha256(payload).hexdigest() != run.get("response_sha256"):
            errors.append(f"run {index}: checksum mismatch")
        if run.get("http_status") not in (200, 500):
            errors.append(f"run {index}: unexpected HTTP status")
        if run.get("hits") is not None and (not isinstance(run["hits"], int) or run["hits"] < 0):
            errors.append(f"run {index}: invalid hit count")
        if platform == "KMbase" and run.get("http_status") == 200:
            try:
                raw = json.loads(payload.decode("utf-8"))
                if int(raw.get("cnt")) != run.get("hits"):
                    errors.append(f"run {index}: KMbase raw/summary count mismatch")
            except (ValueError, TypeError, UnicodeDecodeError, json.JSONDecodeError):
                errors.append(f"run {index}: invalid KMbase JSON response")
        if platform == "RISS":
            if run.get("capture_surface") != "rendered_dom_after_navigation":
                errors.append(f"run {index}: RISS server shell was not replaced by rendered DOM")
            if not isinstance(run.get("hits"), int):
                errors.append(f"run {index}: RISS rendered hit count unresolved")
            if run.get("content_encoding_at_rest") != "gzip" or path.suffix != ".gz":
                errors.append(f"run {index}: RISS raw DOM must be stored as lossless gzip")
                html = ""
            else:
                html = gzip.decompress(payload).decode("utf-8", errors="strict")
            count_match = re.search(
                r"\(검색결과\s*<span[^>]*>\s*([0-9,]+)\s*</span>\s*건\)", html
            )
            raw_hits = int(count_match.group(1).replace(",", "")) if count_match else 0 if "검색결과가 없습니다" in html else None
            if raw_hits != run.get("hits"):
                errors.append(f"run {index}: RISS raw/summary count mismatch")

    if platforms != {"KMbase": 20, "RISS": 20}:
        errors.append(f"platform coverage mismatch: {platforms}")
    if questions != {"A1": 8, "A2": 8, "B1": 8, "B2": 8, "B3": 8}:
        errors.append(f"question coverage mismatch: {questions}")
    if len(paired_queries) != 20 or any(value != {"KMbase", "RISS"} for value in paired_queries.values()):
        errors.append("each of 20 query pairs must cover both platforms exactly")
    print(json.dumps({"errors": errors, "platforms": platforms, "questions": questions}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
