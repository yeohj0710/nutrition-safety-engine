#!/usr/bin/env python3
"""Build protocol-v2 AI exploratory classifications without human authority."""

import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTERIM = ROOT / "data/interim"
OUTDIR = ROOT / "data/curated_v2"
OUTPUT = OUTDIR / "ai_screening_classifications.csv"
MANIFEST = ROOT / "research/screening/ai_exploratory_screening_manifest.json"
SOURCES = {
    "sensitivity": INTERIM / "screening_proxy_sensitivity_first.csv",
    "conservative": INTERIM / "screening_proxy_structured_conservative.csv",
    "context": INTERIM / "screening_review_context.csv",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def classify(a: str, b: str) -> str:
    if a == b == "include_candidate":
        return "ai_agreement_retain"
    if a == b == "low_priority_review":
        return "ai_agreement_deprioritize"
    return "ai_disagreement_uncertain"


def main() -> int:
    sensitivity, conservative, context = (read(SOURCES[name]) for name in ("sensitivity", "conservative", "context"))
    key = lambda row: (row["record_id"], row["question_id"])
    left, right = {key(row): row for row in sensitivity}, {key(row): row for row in conservative}
    context_keys = {key(row) for row in context}
    if set(left) != set(right) or set(left) != context_keys or len(left) != len(context):
        raise RuntimeError("v2 screening inputs do not have exact one-to-one key coverage")
    fields = ["record_id", "question_id", "classification", "sensitivity_recommendation", "conservative_recommendation",
              "sensitivity_score", "conservative_score", "sensitivity_reason_codes", "conservative_reason_codes",
              "ai_method", "decision_authority", "human_screening_claim", "systematic_review_inclusion_claim", "status"]
    rows = []
    for record_id, question_id in sorted(left):
        a, b = left[(record_id, question_id)], right[(record_id, question_id)]
        rows.append({
            "record_id": record_id, "question_id": question_id,
            "classification": classify(a["recommendation"], b["recommendation"]),
            "sensitivity_recommendation": a["recommendation"], "conservative_recommendation": b["recommendation"],
            "sensitivity_score": a["priority_score"], "conservative_score": b["priority_score"],
            "sensitivity_reason_codes": a["reason_codes"], "conservative_reason_codes": b["reason_codes"],
            "ai_method": "deterministic_dual_profile_v1", "decision_authority": "ai_exploratory_only",
            "human_screening_claim": "false", "systematic_review_inclusion_claim": "false",
            "status": "protocol_v2_ai_exploratory_classification",
        })
    OUTDIR.mkdir(exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows(rows)
    counts = Counter(row["classification"] for row in rows)
    payload = {
        "schema_version": "1.0.0", "protocol_version": "2.0-ai-exploratory",
        "status": "complete_ai_exploratory_classification_no_human_authority",
        "row_count": len(rows), "classifications": dict(sorted(counts.items())),
        "input_sha256": {name: sha(path) for name, path in SOURCES.items()},
        "output_path": OUTPUT.relative_to(ROOT).as_posix(), "output_sha256": sha(OUTPUT),
        "human_screening_decisions": 0, "systematic_review_inclusions": None, "prisma_allowed": False,
    }
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"rows": len(rows), "classifications": payload["classifications"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
