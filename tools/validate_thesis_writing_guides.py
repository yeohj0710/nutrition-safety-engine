#!/usr/bin/env python3
"""Validate readable thesis writing guidance and pre-freeze prohibition."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "style": ROOT / "research/design/20260710/08_THESIS/human_style_guide.md",
    "outline": ROOT / "research/design/20260710/08_THESIS/thesis_outline.md",
    "status": ROOT / "research/thesis/thesis_draft_status.md",
}


def main() -> int:
    errors = []
    text = {name: path.read_text(encoding="utf-8") for name, path in FILES.items()}
    if any("�" in value for value in text.values()):
        errors.append("replacement-character corruption detected")
    required = {
        "style": ("결과와 해석", "source locator", "synthetic proxy", "legacy_unverified", "DOCX와 PDF"),
        "outline": ("A1·A2·B1·B2·B3", "source→extraction→GRADE→claim→rule", "연구결과", "독립 scenario"),
        "status": ("blocked_before_results_freeze", "results_freeze_review.csv", "finalization_ready", "final DOCX/PDF 경로도 만들지 않는다"),
    }
    for name, terms in required.items():
        if any(term not in text[name] for term in terms):
            errors.append(f"{name}: mandatory writing/freeze language missing")
    forbidden_paths = (ROOT / "output/final/thesis.docx", ROOT / "output/final/thesis.pdf")
    if any(path.exists() for path in forbidden_paths):
        errors.append("final thesis artifact exists before validated results freeze")
    result = {"errors": errors, "files": {name: path.relative_to(ROOT).as_posix() for name, path in FILES.items()},
              "final_artifacts_present": any(path.exists() for path in forbidden_paths),
              "status": "valid" if not errors else "invalid"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
