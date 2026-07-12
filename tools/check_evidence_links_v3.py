from __future__ import annotations

import csv
import hashlib
import json
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "research/systematic_review_v3/core_evidence.csv"
OUTPUT = ROOT / "research/validation/evidence_link_check_v3.json"


def check(url: str) -> dict[str, object]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "nutrition-safety-engine-link-audit/3.0 (academic validation)"},
        method="GET",
    )
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            status = int(response.status)
            final_url = response.geturl()
    except urllib.error.HTTPError as error:
        status = int(error.code)
        final_url = error.geturl()
    except Exception as error:  # network failures are preserved, not relabelled as broken links
        return {"url": url, "status": None, "final_url": None, "classification": "network_error", "error": type(error).__name__, "elapsed_ms": round((time.monotonic() - started) * 1000)}
    classification = "reachable" if 200 <= status < 400 else "access_blocked" if status in {401, 403, 429} else "broken"
    return {"url": url, "status": status, "final_url": final_url, "classification": classification, "error": None, "elapsed_ms": round((time.monotonic() - started) * 1000)}


with SOURCE.open(encoding="utf-8-sig", newline="") as handle:
    rows = list(csv.DictReader(handle))
urls = sorted({row["source_url"].strip() for row in rows if row["source_url"].strip()})
with ThreadPoolExecutor(max_workers=10) as pool:
    results = list(pool.map(check, urls))
counts: dict[str, int] = {}
for result in results:
    label = str(result["classification"])
    counts[label] = counts.get(label, 0) + 1
payload = {
    "schema_version": "evidence-link-check-v3.0",
    "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
    "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "records": len(rows),
    "unique_urls": len(urls),
    "classification_counts": counts,
    "interpretation": "HTTP 401/403/429 is access blocking, not proof of a broken citation. Network errors require later recheck.",
    "results": results,
}
OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: payload[key] for key in ("records", "unique_urls", "classification_counts")}, ensure_ascii=False))
