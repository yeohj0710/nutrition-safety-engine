#!/usr/bin/env python3
"""Prove Phase 06 remains safely empty until evidence inputs are verified."""

import csv
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def count_rows(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return sum(1 for _ in csv.DictReader(handle))


def main() -> int:
    paths = {
        "human_extractions": REPO / "data/interim/extractions_human.csv",
        "risk_of_bias": REPO / "data/interim/risk_of_bias.csv",
        "certainty": REPO / "research/synthesis/certainty_assessments.csv",
        "claims": REPO / "research/synthesis/claim_registry.csv",
        "rules": REPO / "research/synthesis/rule_registry.csv",
    }
    counts = {name: count_rows(path) for name, path in paths.items()}
    bundle = json.loads((REPO / "src/generated/thesis-bundle.json").read_text(encoding="utf-8-sig"))
    errors = []
    if any(counts.values()):
        errors.append("unverified Phase 06 registry unexpectedly populated")
    if bundle.get("claims") or bundle.get("rules"):
        errors.append("thesis bundle contains claims/rules without verified synthesis")
    decisions = count_rows(REPO / "research/synthesis/meta_analysis_decisions.csv")
    if decisions != 5:
        errors.append("meta-analysis decision log must cover all five questions")
    print(json.dumps({"errors": errors, "phase_status": "blocked_external", "counts": counts, "meta_analysis_decisions": decisions, "legacy_promotions": 0}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
