#!/usr/bin/env python3
"""Build a fail-closed Phase 07 release-readiness record."""

import csv
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "research/validation/release_readiness.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rows(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def current_head() -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()


def ancestor(commit: str, head: str) -> bool:
    return subprocess.run(["git", "merge-base", "--is-ancestor", commit, head], cwd=ROOT,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def committed_bundle_sha(commit: str) -> str | None:
    result = subprocess.run(["git", "show", f"{commit}:src/generated/thesis-bundle.json"], cwd=ROOT, capture_output=True)
    return hashlib.sha256(result.stdout).hexdigest() if result.returncode == 0 else None


def main() -> int:
    errors = []
    head = current_head()
    bundle_path = ROOT / "src/generated/thesis-bundle.json"
    bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    performance = json.loads((ROOT / "research/validation/independent_gold_performance.json").read_text(encoding="utf-8"))
    expert = rows(ROOT / "research/validation/synthetic_scenario_blind_expert_review.csv")
    deployments = rows(ROOT / "research/validation/deployment_verification.csv")
    expert_complete = sum(row.get("status") == "complete_external_human_review_synthetic_not_gold" for row in expert)
    metrics = performance.get("metrics") or {}
    predeploy = {
        "validated_claims_present": bundle.get("meta", {}).get("claimCount", 0) > 0,
        "validated_rules_present": bundle.get("meta", {}).get("ruleCount", 0) > 0,
        "independent_gold_120": performance.get("gold_scenarios") == 120 and bool(metrics),
        "critical_false_negatives_zero": metrics.get("critical_false_negative_count") == 0,
        "determinism_100_percent": metrics.get("determinism", {}).get("rate") == 1,
        "expert_reviews_120": expert_complete == 120,
    }
    deployment_valid = False
    deployment_summary = None
    if len(deployments) > 1:
        errors.append("deployment verification must contain at most one release row")
    if deployments:
        row = deployments[0]
        report_path = (ROOT / row["postdeploy_report_path"]).resolve()
        path_ok = report_path.is_relative_to(ROOT) and report_path.is_file()
        deployment_valid = all((row["deployment_id"], row["deployment_url"], row["provider"], row["deployed_at"],
                                row["verified_by"], row["verified_at"])) and row["status"] == "validated" and \
            ancestor(row["release_commit"], head) and row["thesis_bundle_sha256"] == sha(bundle_path) and \
            committed_bundle_sha(row["release_commit"]) == row["thesis_bundle_sha256"] and path_ok and \
            row["postdeploy_report_sha256"] == (sha(report_path) if path_ok else "")
        if not deployment_valid:
            errors.append("deployment verification row does not match commit/bundle/postdeploy evidence")
        deployment_summary = {key: row[key] for key in ("deployment_id", "deployment_url", "provider", "release_commit", "deployed_at", "status")}
    ready = all(predeploy.values()) and deployment_valid and not errors
    state_tests = {"empty_blocked": not (all(predeploy.values()) and False),
                   "missing_human_blocked": not all({**predeploy, "expert_reviews_120": False}.values()),
                   "all_predeploy_required": all({name: True for name in predeploy}.values()),
                   "head_is_ancestor": ancestor(head, head), "head_bundle_reproduced": committed_bundle_sha(head) == sha(bundle_path)}
    release_commit = deployments[0]["release_commit"] if deployments else None
    payload = {"schema_version": "1.0.0", "status": "complete_candidate_requires_release_acceptance" if ready else "blocked_external",
               "release_ready": ready, "release_commit": release_commit, "thesis_bundle_sha256": sha(bundle_path),
               "predeploy_gates": predeploy, "deployment_verified": deployment_valid,
               "deployment": deployment_summary, "errors": errors, "state_contract_tests": state_tests,
               "final_release_manifest": None if not ready else "pending_final_manifest_generation"}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
