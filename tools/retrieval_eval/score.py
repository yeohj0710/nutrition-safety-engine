"""두 판정자의 판정으로 조회 결과 적합성을 집계한다.

화면에 실제로 나온 자리(조건 25개, 결과 220건)를 단위로 센다. 같은 문헌이 여러
조건에 나오면 나온 횟수만큼 센다. 판정자 사이 일치도는 판정 단위(상황별 문헌
130건, 조건 확인 176건)로 계산한다.

    python -m tools.retrieval_eval.score
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "research" / "retrieval_eval"
JUDGES = {"codex": "judgments_codex.json", "claude": "judgments_claude.json"}


def kappa(pairs: list[tuple[str, str]]) -> float:
    n = len(pairs)
    observed = sum(a == b for a, b in pairs) / n
    left = Counter(a for a, _ in pairs)
    right = Counter(b for _, b in pairs)
    expected = sum(left[k] * right[k] for k in set(left) | set(right)) / (n * n)
    return (observed - expected) / (1 - expected) if expected < 1 else 1.0


def rate(hit: int, total: int) -> dict:
    return {"hit": hit, "total": total, "pct": round(100 * hit / total, 1) if total else None}


def main() -> None:
    queries = json.loads((ROOT / "queries.json").read_text(encoding="utf-8"))
    items = json.loads((ROOT / "judge_items.json").read_text(encoding="utf-8"))
    key_of = {(i["situation"], i["record_id"]): i["item_id"] for i in items}
    labels = {}
    for judge, name in JUDGES.items():
        rows = json.loads((ROOT / "judge" / name).read_text(encoding="utf-8"))
        labels[judge] = {row["item_id"]: row for row in rows}
        assert set(labels[judge]) == {i["item_id"] for i in items}, judge

    def topic(item_id: str, mode: str) -> bool:
        values = [labels[j][item_id]["topic"] for j in JUDGES]
        ok = (lambda v: v == "relevant") if mode == "strict" else (lambda v: v in ("relevant", "partial"))
        return all(ok(v) for v in values)

    def axis_yes(item_id: str, axis: str, judge: str | None) -> bool:
        judges = [judge] if judge else list(JUDGES)
        return all(labels[j][item_id]["axes"].get(axis) == "yes" for j in judges)

    report: dict = {"judges": list(JUDGES), "per_judge": {}, "consensus": {}}

    def summarize(topic_ok, axis_ok) -> dict:
        overall = defaultdict(lambda: [0, 0])
        for query in queries:
            for result in query["results"]:
                item_id = key_of[(query["situation"], result["record_id"])]
                buckets = ["all", result["layer"], query["situation"]]
                if result["rank"] <= 5:
                    buckets.append("top5")
                for bucket in buckets:
                    overall[bucket][1] += 1
                    overall[bucket][0] += topic_ok(item_id)
                for axis in query["axes"]:
                    for bucket in (f"axis:{axis}", "axis:all", f"axis:{result['layer']}"):
                        overall[bucket][1] += 1
                        overall[bucket][0] += axis_ok(item_id, axis)
        return {k: rate(*v) for k, v in sorted(overall.items())}

    for judge in JUDGES:
        report["per_judge"][judge] = {
            "topic_relevant": summarize(lambda i, j=judge: labels[j][i]["topic"] == "relevant", lambda i, a, j=judge: axis_yes(i, a, j)),
            "topic_relevant_or_partial": summarize(
                lambda i, j=judge: labels[j][i]["topic"] in ("relevant", "partial"), lambda i, a, j=judge: axis_yes(i, a, j)
            ),
            "item_topic_counts": Counter(labels[judge][i]["topic"] for i in labels[judge]),
        }
    report["consensus"] = {
        "both_relevant": summarize(lambda i: topic(i, "strict"), lambda i, a: axis_yes(i, a, None)),
        "both_relevant_or_partial": summarize(lambda i: topic(i, "lenient"), lambda i, a: axis_yes(i, a, None)),
    }

    a, b = list(JUDGES)
    topic_pairs = [(labels[a][i]["topic"], labels[b][i]["topic"]) for i in labels[a]]
    binary_pairs = [(x == "relevant", y == "relevant") for x, y in topic_pairs]
    axis_pairs = [
        (labels[a][i["item_id"]]["axes"].get(axis), labels[b][i["item_id"]]["axes"].get(axis))
        for i in items
        for axis in i["axis_checks"]
    ]
    report["agreement"] = {
        "topic_3class": {"n": len(topic_pairs), "raw_pct": round(100 * sum(x == y for x, y in topic_pairs) / len(topic_pairs), 1), "kappa": round(kappa(topic_pairs), 3)},
        "topic_relevant_vs_not": {"n": len(binary_pairs), "raw_pct": round(100 * sum(x == y for x, y in binary_pairs) / len(binary_pairs), 1), "kappa": round(kappa(binary_pairs), 3)},
        "axis": {"n": len(axis_pairs), "raw_pct": round(100 * sum(x == y for x, y in axis_pairs) / len(axis_pairs), 1), "kappa": round(kappa(axis_pairs), 3)},
        "topic_confusion": Counter(f"{x}|{y}" for x, y in topic_pairs),
    }
    (ROOT / "score.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({"consensus": report["consensus"], "agreement": report["agreement"]}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
