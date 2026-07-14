#!/usr/bin/env python3
"""Build non-decisional report-to-study linkage prereview for advanced PubMed candidates."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCREENING = ROOT / "research/review_queue/pubmed_screening_agent_prereview.csv"
SCREENING_APPROVAL = ROOT / "research/approvals/pubmed_screening_agent_prereview_approval.json"
RECORDS = ROOT / "data/interim/records.csv"
REPORTS = ROOT / "data/interim/report_candidates.csv"
DEDUP_REVIEW = ROOT / "research/review_queue/dedup_agent_prereview.json"
DEDUP_DECISIONS = ROOT / "data/interim/deduplication_decisions.csv"
OUTPUT = ROOT / "research/review_queue/report_study_linkage_agent_prereview.csv"
SUMMARY = ROOT / "research/review_queue/report_study_linkage_agent_prereview_summary.json"

REGISTRATION_PATTERNS = {
    "NCT": re.compile(r"\bNCT\s*[-:]?\s*(\d{8})\b", re.I),
    "ISRCTN": re.compile(r"\bISRCTN\s*[-:]?\s*(\d{8})\b", re.I),
    "ACTRN": re.compile(r"\bACTRN\s*[-:]?\s*(\d{14})\b", re.I),
}


class UnionFind:
    def __init__(self, items: set[str]) -> None:
        self.parent = {item: item for item in items}

    def find(self, item: str) -> str:
        while self.parent[item] != item:
            self.parent[item] = self.parent[self.parent[item]]
            item = self.parent[item]
        return item

    def union(self, left: str, right: str) -> None:
        a, b = self.find(left), self.find(right)
        if a != b:
            self.parent[max(a, b)] = min(a, b)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def registrations(text: str) -> set[str]:
    found = set()
    for prefix, pattern in REGISTRATION_PATTERNS.items():
        found.update(f"{prefix}{match}" for match in pattern.findall(text))
    return found


def main() -> int:
    approval = json.loads(SCREENING_APPROVAL.read_text(encoding="utf-8"))
    if approval.get("bundles_validated") != 5 or approval.get("human_individual_screening_decisions_recorded") != 0:
        raise RuntimeError("valid agent-prereview bundle approval with open human decisions required")
    screening = read_csv(SCREENING)
    advanced = [row for row in screening if row["agent_recommendation"] == "advance_to_human_screening"]
    advanced_ids = {row["record_id"] for row in advanced}
    source_sha_by_record = {row["record_id"]: row["source_record_sha256"] for row in advanced}
    questions: dict[str, set[str]] = defaultdict(set)
    for row in advanced:
        questions[row["record_id"]].add(row["question_id"])
    records = {row["record_id"]: row for row in read_csv(RECORDS) if row["record_id"] in advanced_ids}
    reports = {row["record_id"]: row for row in read_csv(REPORTS) if row["record_id"] in advanced_ids}
    if set(records) != advanced_ids or set(reports) != advanced_ids:
        raise RuntimeError("advanced candidate lineage is incomplete")

    uf = UnionFind(advanced_ids)
    registration_by_record = {record_id: registrations(f"{row['title']} {row['abstract']}") for record_id, row in records.items()}
    records_by_registration: dict[str, list[str]] = defaultdict(list)
    for record_id, ids in registration_by_record.items():
        if len(ids) == 1:
            records_by_registration[next(iter(ids))].append(record_id)
    for members in records_by_registration.values():
        for member in members[1:]:
            uf.union(members[0], member)

    dedup_review = json.loads(DEDUP_REVIEW.read_text(encoding="utf-8"))
    candidates = {row["candidate_id"]: row for row in dedup_review["candidates"]}
    duplicate_clusters: dict[str, set[str]] = defaultdict(set)
    for decision in read_csv(DEDUP_DECISIONS):
        if decision["decision"] != "duplicate":
            continue
        candidate = candidates[decision["candidate_id"]]
        left, right = candidate["record_id_a"], candidate["record_id_b"]
        if left in advanced_ids and right in advanced_ids:
            uf.union(left, right)
            duplicate_clusters[left].add(decision["duplicate_cluster_id"])
            duplicate_clusters[right].add(decision["duplicate_cluster_id"])

    components: dict[str, list[str]] = defaultdict(list)
    for record_id in advanced_ids:
        components[uf.find(record_id)].append(record_id)
    component_ids = {}
    for members in components.values():
        ordered = sorted(members)
        token = hashlib.sha256("|".join(ordered).encode()).hexdigest()[:12].upper()
        provisional_id = f"AGENT-STUDY-{token}"
        for record_id in members:
            component_ids[record_id] = provisional_id

    rows = []
    for record_id in sorted(advanced_ids, key=lambda value: int(records[value]["pmid"])):
        record = records[record_id]
        component = components[uf.find(record_id)]
        shared_registrations = sorted({item for member in component for item in registration_by_record[member]})
        shared_clusters = sorted({item for member in component for item in duplicate_clusters[member]})
        if len(component) == 1:
            recommendation = "provisional_single_report_study_needs_validation"
            evidence = "no_explicit_cross_report_link_detected"
            confidence = "low"
        else:
            recommendation = "provisional_multi_report_study_needs_validation"
            evidence_parts = []
            if shared_registrations:
                evidence_parts.append("shared_trial_registration")
            if shared_clusters:
                evidence_parts.append("approved_duplicate_report_cluster")
            evidence = "|".join(evidence_parts)
            confidence = "high" if shared_registrations else "moderate"
        rows.append({
            "report_id": reports[record_id]["report_id"], "record_id": record_id, "pmid": record["pmid"],
            "question_ids": "|".join(sorted(questions[record_id])), "title": record["title"],
            "agent_provisional_study_id": component_ids[record_id], "agent_recommendation": recommendation,
            "linkage_evidence": evidence, "trial_registration_ids": "|".join(sorted(registration_by_record[record_id])),
            "duplicate_cluster_ids": "|".join(sorted(duplicate_clusters[record_id])),
            "component_report_count": str(len(component)), "confidence": confidence,
            "source_record_sha256": source_sha_by_record[record_id],
            "decision_authority": "agent_prereview_only", "human_link_decision": "", "human_study_id": "",
            "verified_by": "", "verified_at": "",
        })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)

    component_sizes = Counter(len(members) for members in components.values())
    summary = {
        "schema_version": "1.0.0", "status": "agent_linkage_prereview_complete_human_links_open",
        "authority": "agent_prereview_only", "screening_basis": "advance_to_human_screening_not_human_inclusion",
        "advanced_record_question_units": len(advanced), "unique_reports": len(rows),
        "agent_provisional_study_components": len(components),
        "multi_report_components": sum(size > 1 for size in map(len, components.values())),
        "reports_in_multi_report_components": sum(len(members) for members in components.values() if len(members) > 1),
        "components_by_report_count": {str(key): value for key, value in sorted(component_sizes.items())},
        "registration_ids_detected": len(records_by_registration), "human_link_decisions": 0,
        "independent_reviewers_completed": 0, "synthesis_allowed": False,
        "inputs": {"screening_sha256": sha(SCREENING), "screening_approval_sha256": sha(SCREENING_APPROVAL), "reports_sha256": sha(REPORTS)},
        "output_sha256": sha(OUTPUT),
    }
    SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
