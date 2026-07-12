#!/usr/bin/env python3
"""Validate the human extraction dictionary against the authoritative 55-column template."""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "data/interim/extractions_human.csv"
DICTIONARY = ROOT / "research/design/20260710/04_EXTRACTION/data_dictionary.csv"
GUIDE = ROOT / "research/design/20260710/04_EXTRACTION/data_dictionary.md"


def main() -> int:
    errors = []
    with TEMPLATE.open(encoding="utf-8-sig", newline="") as handle:
        template_fields = next(csv.reader(handle))
    with DICTIONARY.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    dictionary_fields = [row["field_name"] for row in rows]
    if len(template_fields) != 55 or len(rows) != 55:
        errors.append("template and dictionary must each contain exactly 55 fields")
    if dictionary_fields != template_fields:
        errors.append("dictionary field order does not exactly match extraction template")
    if [row["position"] for row in rows] != [str(number) for number in range(1, 56)]:
        errors.append("dictionary positions must be contiguous 1..55")
    if any(not row["korean_label"].strip() or not row["data_type"].strip() or not row["required_rule"].strip() or not row["description"].strip() for row in rows):
        errors.append("dictionary contains incomplete definitions")
    guide = GUIDE.read_text(encoding="utf-8")
    if "�" in guide or "�" in DICTIONARY.read_text(encoding="utf-8"):
        errors.append("replacement-character encoding corruption detected")
    result = {"errors": errors, "template_fields": len(template_fields), "dictionary_rows": len(rows),
              "exact_order_match": dictionary_fields == template_fields,
              "status": "valid" if not errors else "invalid"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
