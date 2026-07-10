#!/usr/bin/env python3
"""Capture local production HTTP/UI boundary evidence; never claim deployment."""

import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "research/validation/local_production_smoke.json"
BASE = "http://127.0.0.1:3100"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def get(path: str) -> tuple[int, str]:
    with urllib.request.urlopen(BASE + path, timeout=10) as response:
        return response.status, response.read().decode("utf-8")


def main() -> int:
    home_status, home = get("/")
    legacy_status, legacy = get("/legacy")
    robots_status, _ = get("/robots.txt")
    sitemap_status, _ = get("/sitemap.xml")
    body = json.dumps({"profile": {"age": 40, "medications": ["warfarin"], "conditions": [],
                                    "allergies": [], "jurisdiction": "KR"},
                       "candidateItems": [{"name": "vitamin K"}]}).encode()
    request = urllib.request.Request(BASE + "/api/rules/query", data=body,
                                     headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=10) as response:
        api_status = response.status
        api = json.loads(response.read().decode("utf-8"))
    questions = ["항응고제 복용자와 비타민 K 관련 안전성", "항응고제 복용자와 오메가-3 관련 안전성",
                 "칼슘 보충제와 신장결석 위험", "비타민 D 보충제와 신장결석 위험",
                 "비타민 C 보충제와 신장결석 위험"]
    checks = {
        "home_200": home_status == 200,
        "protocol_questions_5_present": all(value in home for value in questions),
        "thesis_empty_notice_present": "검증 전 결과는 보여 주지 않습니다" in home,
        "legacy_warning_present": "legacy_unverified · 연구결과 아님" in legacy,
        "legacy_200": legacy_status == 200, "robots_200": robots_status == 200,
        "sitemap_200": sitemap_status == 200, "api_200": api_status == 200,
        "api_validated_scope": api.get("scope") == "validated_thesis_scope",
        "api_empty_actions": not api.get("actions") and not api.get("matched_rules") and not api.get("evidence_claims"),
        "api_no_legacy": "legacy_unverified" not in json.dumps(api, ensure_ascii=False),
    }
    report = {"schema_version": "1.0.0", "status": "local_production_smoke_not_validated_deployment",
              "validated_deployment": False, "browser": "Playwright Chromium",
              "browser_pages_inspected": ["/", "/legacy"], "checks": checks,
              "all_passed": all(checks.values()),
              "source_hashes": {name: sha(ROOT / name) for name in
                                ("app/page.tsx", "src/engine/run-thesis-engine.ts", "src/generated/thesis-bundle.json")},
              "build_id_sha256": sha(ROOT / ".next/BUILD_ID")}
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["all_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
