#!/usr/bin/env python3
"""Prove non-PubMed generators preserve populated human-review cells."""

import csv
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASES = (
    ("data/interim/clinicaltrials_review_queue.csv", "reviewer_1_id", "PRESERVE_TEST", "tools/build_clinicaltrials_review_queue.py"),
    ("data/interim/koreamed_review_queue.csv", "reviewer_1_id", "PRESERVE_TEST", "tools/normalize_koreamed_observation.py"),
    ("data/interim/koreamed_pubmed_link_candidates.csv", "human_link_decision", "uncertain", "tools/normalize_koreamed_observation.py"),
)


def mutate(path: Path, field: str, value: str) -> None:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise RuntimeError(f"empty preservation fixture: {path}")
    fieldnames = list(rows[0])
    rows[0][field] = value
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def cell(path: Path, field: str) -> str:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return next(csv.DictReader(handle))[field]


def main() -> int:
    originals = {name: (ROOT / name).read_bytes() for name, *_ in CASES}
    passed = []
    try:
        for name, field, value, script in CASES:
            path = ROOT / name
            mutate(path, field, value)
            subprocess.run([sys.executable, str(ROOT / script)], cwd=ROOT, check=True, capture_output=True, text=True)
            if cell(path, field) != value:
                raise RuntimeError(f"human value overwritten: {name}:{field}")
            passed.append(name)
            path.write_bytes(originals[name])
    finally:
        for name, content in originals.items():
            (ROOT / name).write_bytes(content)
        subprocess.run([sys.executable, str(ROOT / "tools/normalize_koreamed_observation.py")], cwd=ROOT, check=True)
    print(f"non-PubMed preservation contract: {len(passed)}/{len(CASES)} passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
