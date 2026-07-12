#!/usr/bin/env python3
"""Validate the transparent AI-only exploratory protocol amendment."""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROTOCOL = ROOT / "research/protocol/protocol-v2.0-ai-exploratory.md"
MATRIX = ROOT / "research/protocol/ai_exploratory_role_matrix.md"
AMENDMENTS = ROOT / "research/protocol/amendments.csv"


def main() -> int:
    errors = []
    for path in (PROTOCOL, MATRIX, AMENDMENTS, ROOT / "research/protocol/protocol-v1.0.md"):
        if not path.is_file():
            errors.append(f"missing protocol artifact: {path.relative_to(ROOT).as_posix()}")
    protocol = PROTOCOL.read_text(encoding="utf-8") if PROTOCOL.is_file() else ""
    matrix = MATRIX.read_text(encoding="utf-8") if MATRIX.is_file() else ""
    required_protocol = (
        "AI 기반 탐색적 문헌지도",
        "체계적 문헌고찰이 아니다",
        "사람 선별을 수행하지 않는다",
        "PRISMA 최종 포함",
        "GRADE",
        "임상 권고",
        "legacy_unverified",
        "protocol-v1.0.md",
        "2026-07-12",
    )
    for phrase in required_protocol:
        if phrase not in protocol:
            errors.append(f"protocol boundary missing: {phrase}")
    required_matrix = ("ai_exploratory", "decision_authority", "prohibited", "사람 검토 완료로 표시하지 않음")
    for phrase in required_matrix:
        if phrase not in matrix:
            errors.append(f"role matrix boundary missing: {phrase}")
    if AMENDMENTS.is_file():
        with AMENDMENTS.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        amendment = next((row for row in rows if row.get("amendment_id") == "AM-002"), None)
        if not amendment:
            errors.append("AM-002 protocol amendment missing")
        elif (amendment.get("protocol_version_after") != "2.0-ai-exploratory"
              or amendment.get("approved_by") != "user_explicit_instruction_2026-07-12"
              or amendment.get("status") != "adopted"):
            errors.append("AM-002 authority/version/status mismatch")
    forbidden = ("pending_human_approval", "human consensus required", "AI 결과를 사람 판정으로")
    if any(phrase in protocol for phrase in forbidden):
        errors.append("v2 protocol retains a contradictory human-authority clause")
    result = {"errors": errors, "status": "valid_ai_exploratory_protocol" if not errors else "invalid", "systematic_review_claim_allowed": False, "human_review_claim_allowed": False}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
