#!/usr/bin/env python3
"""Validate synthesis templates and human authoring guides."""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT / "research/design/20260710/05_SYNTHESIS"
ACTIVE = ROOT / "research/synthesis"


def header(path: Path) -> list[str]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return next(csv.reader(handle))


def main() -> int:
    errors = []
    pairs = (("certainty_assessment_template.csv", "certainty_assessments.csv", 22),
             ("claim_registry_template.csv", "claim_registry.csv", 18),
             ("rule_registry_template.csv", "rule_registry.csv", 19))
    results = {}
    for template_name, active_name, count in pairs:
        template, active = header(DESIGN / template_name), header(ACTIVE / active_name)
        results[active_name] = {"expected": count, "actual": len(active), "exact_template_match": active == template}
        if len(active) != count or active != template:
            errors.append(f"{active_name}: template/header mismatch")
    claim = (DESIGN / "claim_writing_checklist.md").read_text(encoding="utf-8")
    rule = (DESIGN / "rule_authoring_manual.md").read_text(encoding="utf-8")
    required_claim = ("source·report·study·extraction·certainty ID", "verification_status=validated", "AI", "legacy")
    required_rule = ("rule_id → claim_id → certainty_id → extraction_id", "independent scenario", "thesis mode", "legacy")
    if any(term not in claim for term in required_claim) or any(term not in rule for term in required_rule):
        errors.append("authoring guides omit mandatory provenance/safety language")
    if "�" in claim + rule:
        errors.append("replacement-character corruption detected")
    result = {"errors": errors, "registries": results, "status": "valid" if not errors else "invalid"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
