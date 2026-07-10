#!/usr/bin/env python3
"""Validate the truthful non-final Phase 08 checkpoint manifest."""

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "research/checkpoint_manifest.json"
METHODS_QA = ROOT / "research/thesis/checkpoints/methods_checkpoint_qa.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True, encoding="utf-8").strip()


def tracked_paths() -> set[str]:
    output = subprocess.check_output(
        ["git", "-c", "core.quotepath=false", "ls-files", "-z"], cwd=ROOT
    ).decode("utf-8")
    return {value for value in output.split("\0") if value}


def main() -> int:
    errors: list[str] = []
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    expected_flags = {
        "status": "checkpoint_not_final_release",
        "project_complete": False,
        "validated_claims": 0,
        "validated_thesis_rules": 0,
        "final_docx": None,
        "final_pdf": None,
        "public_validated_deployment": None,
    }
    for key, value in expected_flags.items():
        if manifest.get(key) != value:
            errors.append(f"manifest {key}: expected {value!r}, got {manifest.get(key)!r}")

    entries = manifest.get("files", [])
    if manifest.get("file_count") != len(entries):
        errors.append("manifest file_count mismatch")
    if len({entry.get("path") for entry in entries}) != len(entries):
        errors.append("manifest contains duplicate paths")
    for entry in entries:
        path = ROOT / entry["path"]
        if not path.is_file():
            errors.append(f"missing checkpoint file: {entry['path']}")
        elif path.stat().st_size != entry["size_bytes"] or sha256(path) != entry["sha256"]:
            errors.append(f"checkpoint hash/size mismatch: {entry['path']}")

    tracked_now = tracked_paths() - {"research/checkpoint_manifest.json"}
    tracked_manifest = {entry["path"] for entry in entries if entry["distribution"] == "tracked"}
    missing_tracked = sorted(tracked_now - tracked_manifest)
    extra_tracked = sorted(tracked_manifest - tracked_now)
    if missing_tracked:
        errors.append(f"tracked files missing from checkpoint: {len(missing_tracked)}")
    if extra_tracked:
        errors.append(f"checkpoint tracked files no longer tracked: {len(extra_tracked)}")
    local_count = sum(entry["distribution"] == "local_required" for entry in entries)
    if manifest.get("local_required_file_count") != local_count:
        errors.append("local_required_file_count mismatch")
    if local_count != 104:
        errors.append(f"expected 104 local required PubMed/records payloads, got {local_count}")

    head = manifest.get("implementation_head", "")
    ancestor = subprocess.run(
        ["git", "merge-base", "--is-ancestor", head, "HEAD"], cwd=ROOT, check=False
    ).returncode == 0
    if not ancestor:
        errors.append("manifest implementation_head is not an ancestor of current HEAD")
    forbidden = [ROOT / "output/final/thesis.docx", ROOT / "output/final/thesis.pdf"]
    if any(path.exists() for path in forbidden):
        errors.append("unverified final thesis artifact exists before results freeze")
    methods_qa = json.loads(METHODS_QA.read_text(encoding="utf-8"))
    if methods_qa.get("final_thesis_claim_allowed") is not False:
        errors.append("methods checkpoint incorrectly permits a final-thesis claim")
    if methods_qa.get("department_format_confirmed") is not False:
        errors.append("department format cannot be confirmed before external review")
    if methods_qa.get("results_included") is not False:
        errors.append("methods checkpoint contains pre-freeze results")

    result = {
        "errors": errors,
        "phase_status": "blocked_external",
        "checkpoint_status": "complete_verified" if not errors else "failed_quality_gate",
        "manifest_files": len(entries),
        "tracked_files": len(tracked_manifest),
        "local_required_files": local_count,
        "final_docx": manifest.get("final_docx"),
        "final_pdf": manifest.get("final_pdf"),
        "methods_checkpoint_pages_checked": len(methods_qa.get("inspected_pages", [])),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
