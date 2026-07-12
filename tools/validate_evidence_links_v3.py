from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "research/systematic_review_v3/core_evidence.csv"
report_path = ROOT / "research/validation/evidence_link_check_v3.json"
report = json.loads(report_path.read_text(encoding="utf-8"))
errors: list[str] = []
if report.get("source_sha256") != hashlib.sha256(source.read_bytes()).hexdigest():
    errors.append("link report source hash does not match core_evidence.csv")
if report.get("records") != 121:
    errors.append(f"unexpected record count: {report.get('records')}")
if report.get("unique_urls") != len(report.get("results", [])):
    errors.append("unique URL count does not match result rows")
for row in report.get("results", []):
    if row.get("classification") == "broken":
        errors.append(f"broken URL: {row.get('url')} status={row.get('status')}")
    if row.get("classification") == "network_error":
        errors.append(f"unverified URL: {row.get('url')} error={row.get('error')}")
payload = {"status": "valid" if not errors else "invalid", "errors": errors, "records": report.get("records"), "unique_urls": report.get("unique_urls"), "classification_counts": report.get("classification_counts")}
print(json.dumps(payload, ensure_ascii=False, indent=2))
raise SystemExit(1 if errors else 0)
