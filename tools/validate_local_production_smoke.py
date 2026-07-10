#!/usr/bin/env python3
"""Validate captured local production smoke provenance without a live server."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "research/validation/local_production_smoke.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors: list[str] = []
    value = json.loads(REPORT.read_text(encoding="utf-8"))
    if value.get("status") != "local_production_smoke_not_validated_deployment" or value.get("validated_deployment") is not False:
        errors.append("local smoke is overstated as validated deployment")
    checks = value.get("checks", {})
    if len(checks) != 11 or not all(checks.values()) or value.get("all_passed") is not True:
        errors.append("local production smoke checks incomplete or failed")
    if value.get("browser") != "Playwright Chromium" or value.get("browser_pages_inspected") != ["/", "/legacy"]:
        errors.append("browser inspection evidence missing")
    for name, expected in value.get("source_hashes", {}).items():
        if not (ROOT / name).is_file() or sha(ROOT / name) != expected:
            errors.append(f"stale local smoke source hash: {name}")
    result = {"errors": errors, "checks": len(checks), "all_passed": not errors,
              "validated_deployment": False}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
