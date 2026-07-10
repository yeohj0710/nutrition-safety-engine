#!/usr/bin/env python3
"""Prove PubMed normalization preserves populated dedup/linkage queues."""

import csv
import json
import tempfile
from pathlib import Path

from normalize_pubmed_exports import write_or_preserve_human_queue


def main() -> int:
    fields = ["id", "static", "decision"]
    generated = [{"id": "1", "static": "same", "decision": ""}]
    tests = {}
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        path = root / "queue.csv"
        tests["missing_initialized"] = write_or_preserve_human_queue(path, generated, fields, "id", ["decision"], ["id", "static"]) == "generated_no_human_data"
        with path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
            writer.writeheader(); writer.writerow({"id": "1", "static": "same", "decision": "human"})
        before = path.read_bytes()
        tests["human_bytes_preserved"] = write_or_preserve_human_queue(path, generated, fields, "id", ["decision"], ["id", "static"]) == "preserved_existing_human_data" and path.read_bytes() == before
        changed = [{"id": "1", "static": "changed", "decision": ""}]
        try:
            write_or_preserve_human_queue(path, changed, fields, "id", ["decision"], ["id", "static"])
            rejected = False
        except ValueError:
            rejected = path.read_bytes() == before
        tests["lineage_change_rejected_without_write"] = rejected
    errors = [] if all(tests.values()) else ["Phase 03 queue preservation failed"]
    print(json.dumps({"errors": errors, "tests": tests}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
