#!/usr/bin/env python3
"""Validate source -> evidence claim -> rule provenance for JSONL registries."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def load_jsonl(path: Path) -> list[dict]:
    items = []
    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                items.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{line_no}: {exc}") from exc
    return items


def load_source_ids(path: Path) -> set[str]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return {row["source_id"] for row in csv.DictReader(f) if row.get("source_id")}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", required=True, type=Path)
    ap.add_argument("--claims", required=True, type=Path)
    ap.add_argument("--rules", required=True, type=Path)
    args = ap.parse_args()

    errors: list[str] = []
    source_ids = load_source_ids(args.sources)
    claims = load_jsonl(args.claims)
    rules = load_jsonl(args.rules)

    claim_by_id: dict[str, dict] = {}
    for c in claims:
        cid = c.get("claim_id")
        if not cid:
            errors.append("claim without claim_id")
            continue
        if cid in claim_by_id:
            errors.append(f"duplicate claim_id: {cid}")
        claim_by_id[cid] = c
        support = c.get("support") or []
        if c.get("verification_status") in {"human_verified", "validated"} and not support:
            errors.append(f"verified claim has no support: {cid}")
        for s in support:
            sid = s.get("source_id")
            if sid not in source_ids:
                errors.append(f"claim {cid} references missing source {sid}")
            if not s.get("locator") or not s.get("supporting_quote"):
                errors.append(f"claim {cid} has support without locator/quote")

    rule_ids: set[str] = set()
    for r in rules:
        rid = r.get("rule_id")
        if not rid:
            errors.append("rule without rule_id")
            continue
        if rid in rule_ids:
            errors.append(f"duplicate rule_id: {rid}")
        rule_ids.add(rid)
        for cid in r.get("claim_ids") or []:
            if cid not in claim_by_id:
                errors.append(f"rule {rid} references missing claim {cid}")
            elif r.get("validation_status") == "validated" and claim_by_id[cid].get("verification_status") != "validated":
                errors.append(f"validated rule {rid} references non-validated claim {cid}")
        if r.get("scope_status") == "validated_thesis_scope" and r.get("validation_status") != "validated":
            errors.append(f"thesis-scope rule not validated: {rid}")

    print(f"Sources: {len(source_ids)}; claims: {len(claims)}; rules: {len(rules)}")
    print(f"Errors: {len(errors)}")
    for e in errors:
        print(f"ERROR: {e}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
