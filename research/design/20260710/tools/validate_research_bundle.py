#!/usr/bin/env python3
"""Validate structure, parseability, and basic internal quality of the research bundle."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover - dependency availability varies
    yaml = None

try:
    from jsonschema.validators import validator_for  # type: ignore
except ImportError:  # pragma: no cover - dependency availability varies
    validator_for = None

REQUIRED = [
    "README_FIRST.md",
    "MASTER_BLUEPRINT.md",
    "PROJECT_STATUS.yaml",
    "TASK_BOARD.csv",
    "00_AUDIT/current_state_audit.md",
    "01_PROTOCOL/research_protocol_v1.md",
    "02_RETRIEVAL/search_strategy_spec.md",
    "03_SCREENING/screening_manual.md",
    "04_EXTRACTION/llm_extraction_schema.json",
    "05_SYNTHESIS/evidence_to_rule_schema.json",
    "06_VALIDATION/validation_protocol.md",
    "07_REPO/repo_redesign_spec.md",
    "08_THESIS/thesis_outline.md",
    "09_CODEX/CODEX_MASTER_INSTRUCTIONS.md",
    "10_QA/acceptance_criteria.md",
]


def validate_json(path: Path, root: Path, errors: list[str], warnings: list[str]) -> None:
    try:
        obj = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"invalid JSON {path.relative_to(root)}: {exc}")
        return

    if path.name.endswith("_schema.json"):
        if validator_for is None:
            warnings.append(f"jsonschema not installed; schema meta-validation skipped: {path.relative_to(root)}")
            return
        try:
            cls = validator_for(obj)
            cls.check_schema(obj)
        except Exception as exc:
            errors.append(f"invalid JSON Schema {path.relative_to(root)}: {exc}")


def validate_yaml(path: Path, root: Path, errors: list[str], warnings: list[str]) -> None:
    if yaml is None:
        warnings.append(f"PyYAML not installed; YAML parse check skipped: {path.relative_to(root)}")
        return
    try:
        value = yaml.safe_load(path.read_text(encoding="utf-8"))
        if value is None:
            errors.append(f"empty YAML document: {path.relative_to(root)}")
    except Exception as exc:
        errors.append(f"invalid YAML {path.relative_to(root)}: {exc}")


def validate_csv(path: Path, root: Path, errors: list[str]) -> None:
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            if not header:
                errors.append(f"missing CSV header: {path.relative_to(root)}")
                return
            if len(header) != len(set(header)):
                errors.append(f"duplicate CSV header: {path.relative_to(root)}")
            if any(not c.strip() for c in header):
                errors.append(f"blank CSV header: {path.relative_to(root)}")
            expected = len(header)
            for row_no, row in enumerate(reader, 2):
                if len(row) != expected:
                    errors.append(
                        f"CSV column mismatch {path.relative_to(root)}:{row_no}: "
                        f"expected {expected}, found {len(row)}"
                    )
                    if sum(1 for e in errors if str(path.relative_to(root)) in e) >= 10:
                        break
    except Exception as exc:
        errors.append(f"invalid CSV {path.relative_to(root)}: {exc}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", type=Path)
    args = ap.parse_args()
    root = args.root.resolve()
    errors: list[str] = []
    warnings: list[str] = []

    for rel in REQUIRED:
        p = root / rel
        if not p.is_file():
            errors.append(f"missing required file: {rel}")
        elif p.stat().st_size == 0:
            errors.append(f"empty required file: {rel}")

    for p in root.rglob("*.json"):
        validate_json(p, root, errors, warnings)

    for pattern in ("*.yaml", "*.yml"):
        for p in root.rglob(pattern):
            validate_yaml(p, root, errors, warnings)

    for p in root.rglob("*.csv"):
        validate_csv(p, root, errors)

    phase_files = sorted((root / "09_CODEX").glob("phase_*.md")) if (root / "09_CODEX").exists() else []
    if len(phase_files) < 8:
        warnings.append(f"expected at least 8 phase files, found {len(phase_files)}")

    for p in root.rglob("*.md"):
        if p.stat().st_size == 0:
            errors.append(f"empty Markdown file: {p.relative_to(root)}")

    print(f"Bundle: {root}")
    print(f"Errors: {len(errors)}")
    for e in errors:
        print(f"ERROR: {e}")
    print(f"Warnings: {len(warnings)}")
    for w in warnings:
        print(f"WARNING: {w}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
