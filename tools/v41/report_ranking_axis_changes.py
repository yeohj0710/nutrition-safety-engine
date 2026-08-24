"""v40 핵심 목록과 v41 주제순위·축 판정의 변화를 표로 만든다."""

from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from tools.v41 import base_builder as base


ROOT = Path(__file__).resolve().parents[2]
OLD_CORE = ROOT / "research" / "systematic_review_v40" / "core_evidence.csv"
NEW_CORPUS = ROOT / "data" / "recollect_v41" / "evidence_map.csv"
NEW_CORE = ROOT / "research" / "systematic_review_v41" / "core_evidence.csv"
OUT_JSON = ROOT / "research" / "systematic_review_v41" / "ranking_axis_comparison.json"
OUT_MD = ROOT / "research" / "systematic_review_v41" / "ranking_axis_comparison.md"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def top_by_question(rows: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    result: dict[str, list[dict[str, str]]] = {}
    for question_id in base.QUESTION_CONFIG:
        candidates = [row for row in rows if row["question_id"] == question_id]
        candidates.sort(key=lambda row: (
            -int(row.get("priority_score", "0") or 0),
            -int(row.get("year", "0") or 0),
            row["record_id"],
        ))
        result[question_id] = candidates[:base.MAX_CORE_PER_QUESTION]
    return result


def axis_counts(rows: list[dict[str, str]], extractor) -> dict[str, dict[str, int]]:
    counts: dict[str, Counter[str]] = {question: Counter() for question in base.QUESTION_CONFIG}
    for row in rows:
        counts[row["question_id"]].update(extractor(row))
    return {question: dict(sorted(counter.items())) for question, counter in counts.items()}


def markdown_table(question_id: str, old: list[dict[str, str]], new: list[dict[str, str]]) -> str:
    lines = [
        f"### {question_id}",
        "",
        "| 순위 | 옛 record_id | 옛 제목 | 새 record_id | 새 제목 | 새 I 적중 | 새 P 적중 | 변경 |",
        "|---:|---|---|---|---|---:|---:|:---:|",
    ]
    for index in range(base.MAX_CORE_PER_QUESTION):
        before = old[index] if index < len(old) else {}
        after = new[index] if index < len(new) else {}
        old_id = before.get("record_id", "—")
        new_id = after.get("record_id", "—")
        old_title = before.get("title", "—").replace("|", "\\|")
        new_title = after.get("title", "—").replace("|", "\\|")
        matches = base.topic_match_counts(after) if after else {"i_hits": 0, "p_hits": 0}
        changed = "예" if old_id != new_id else "아니오"
        lines.append(
            f"| {index + 1} | {old_id} | {old_title} | {new_id} | {new_title} | "
            f"{matches['i_hits']} | {matches['p_hits']} | {changed} |"
        )
    return "\n".join(lines)


def main() -> None:
    for path in (OLD_CORE, NEW_CORPUS, NEW_CORE):
        if not path.is_file():
            raise FileNotFoundError(path)
    old_top = top_by_question(read_csv(OLD_CORE))
    new_top = top_by_question(read_csv(NEW_CORE))
    corpus = read_csv(NEW_CORPUS)
    before_axes = axis_counts(corpus, base.legacy_extract_observed_axes)
    after_axes = axis_counts(corpus, base.extract_observed_axes)

    ranking: dict[str, dict[str, object]] = {}
    for question_id in base.QUESTION_CONFIG:
        old_ids = [row["record_id"] for row in old_top[question_id]]
        new_ids = [row["record_id"] for row in new_top[question_id]]
        ranking[question_id] = {
            "old_count": len(old_ids),
            "new_count": len(new_ids),
            "changed_positions": sum(
                left != right for left, right in zip(old_ids, new_ids)
            ),
            "old": [
                {"rank": index + 1, "record_id": row["record_id"], "title": row["title"],
                 "priority_score": int(row.get("priority_score", "0") or 0)}
                for index, row in enumerate(old_top[question_id])
            ],
            "new": [
                {"rank": index + 1, "record_id": row["record_id"], "title": row["title"],
                 "priority_score": int(row.get("priority_score", "0") or 0),
                 **base.topic_match_counts(row)}
                for index, row in enumerate(new_top[question_id])
            ],
        }

    axes: dict[str, dict[str, dict[str, int]]] = {}
    for question_id in base.QUESTION_CONFIG:
        names = set(before_axes[question_id]) | set(after_axes[question_id])
        axes[question_id] = {
            axis: {
                "before": before_axes[question_id].get(axis, 0),
                "after": after_axes[question_id].get(axis, 0),
                "delta": after_axes[question_id].get(axis, 0) - before_axes[question_id].get(axis, 0),
            }
            for axis in sorted(names)
        }

    payload = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "scope": {
            "old_core": "research/systematic_review_v40/core_evidence.csv",
            "new_core": "research/systematic_review_v41/core_evidence.csv",
            "axis_counts": "all 257,060 corpus rows",
            "core_limit_per_question": base.MAX_CORE_PER_QUESTION,
        },
        "ranking": ranking,
        "axis_counts": axes,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    changed_total = sum(int(item["changed_positions"]) for item in ranking.values())
    lines = [
        "# v40·v41 핵심 목록과 축 판정 비교",
        "",
        f"순위가 바뀐 자리: {changed_total}개 / {len(base.QUESTION_CONFIG) * base.MAX_CORE_PER_QUESTION}개",
        "축 적중 건수는 재수집 코퍼스 257,060행에서 계산했다.",
        "",
    ]
    for question_id in base.QUESTION_CONFIG:
        lines.append(markdown_table(question_id, old_top[question_id], new_top[question_id]))
        lines.append("")
        lines.append("| 축 | 변경 전 | 변경 후 | 증감 |")
        lines.append("|---|---:|---:|---:|")
        for axis, values in axes[question_id].items():
            lines.append(
                f"| {axis} | {values['before']:,} | {values['after']:,} | {values['delta']:+,} |"
            )
        lines.append("")
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({
        "changed_positions": changed_total,
        "ranking_report": str(OUT_MD),
        "axis_counts": axes,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
