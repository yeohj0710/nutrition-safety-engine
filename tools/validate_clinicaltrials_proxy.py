#!/usr/bin/env python3
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


errors = []
with (ROOT / "research/searches/clinicaltrials_search_log.csv").open(encoding="utf-8", newline="") as f:
    runs = list(csv.DictReader(f))

if len(runs) != 5:
    errors.append(f"expected 5 runs, got {len(runs)}")

reported = exported = verified_files = 0
for run in runs:
    reported += int(run["total_hits_reported"])
    exported += int(run["records_exported"])
    if run["total_hits_reported"] != run["records_exported"]:
        errors.append(f"count mismatch: {run['search_run_id']}")
    raw_dir = ROOT / run["raw_file"]
    manifest = raw_dir / "checksum.sha256"
    if not manifest.exists():
        errors.append(f"missing checksum manifest: {raw_dir}")
        continue
    for line in manifest.read_text(encoding="utf-8").splitlines():
        expected, rel = line.split("  ", 1)
        target = raw_dir / rel
        if not target.exists() or sha256(target) != expected:
            errors.append(f"checksum mismatch: {target}")
        else:
            verified_files += 1

summary = json.loads((ROOT / "data/interim/clinicaltrials_summary.json").read_text(encoding="utf-8"))
expected = {
    "retrieval_instances": 207,
    "unique_registry_records": 201,
    "cross_question_duplicate_instances": 6,
    "registry_to_pubmed_link_candidates": 500,
    "human_registry_decisions": 0,
    "human_linkage_decisions": 0,
}
for key, value in expected.items():
    if summary.get(key) != value:
        errors.append(f"{key}: expected {value}, got {summary.get(key)}")
if reported != 207 or exported != 207:
    errors.append(f"aggregate counts: reported={reported}, exported={exported}")
if summary.get("checksum_verified_files") != verified_files:
    errors.append(
        f"verified file count: summary={summary.get('checksum_verified_files')}, actual={verified_files}"
    )

result = {
    "status": "pass" if not errors else "fail",
    "runs": len(runs),
    "reported": reported,
    "exported": exported,
    "checksum_verified_files": verified_files,
    "errors": errors,
}
(ROOT / "research/searches/clinicaltrials_validation.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(result, ensure_ascii=False))
raise SystemExit(1 if errors else 0)
