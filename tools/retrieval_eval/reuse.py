"""앞선 판정을 다시 쓰고, 새로 판정할 것만 남긴다.

판정은 제목과 초록만 보고 하므로 조건 색인이 바뀌어도 같은 문헌의 같은 질문은
답이 같다. 같은 상황의 같은 문헌은 주제 판정을, 같은 조건은 조건 판정을 그대로
가져온다. 빠진 것만 judge_items_todo.json 으로 내보낸다.

    python -m tools.retrieval_eval.reuse 261020          # 할 일 만들기
    python -m tools.retrieval_eval.reuse 261020 --merge  # 새 판정과 합치기
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "research" / "retrieval_eval"
JUDGES = ("codex", "claude")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("previous")
    parser.add_argument("--merge", action="store_true")
    args = parser.parse_args()
    prev_dir = ROOT / args.previous
    prev_items = {
        (i["situation"], i["record_id"]): i
        for i in json.loads((prev_dir / "judge_items.json").read_text(encoding="utf-8"))
    }
    items = json.loads((ROOT / "judge_items.json").read_text(encoding="utf-8"))

    def previous(judge: str) -> dict[tuple[str, str], dict]:
        rows = json.loads((prev_dir / "judge" / f"judgments_{judge}.json").read_text(encoding="utf-8"))
        by_id = {row["item_id"]: row for row in rows}
        return {key: by_id[item["item_id"]] for key, item in prev_items.items()}

    if not args.merge:
        old = previous("codex")
        todo = []
        for item in items:
            key = (item["situation"], item["record_id"])
            known = old.get(key)
            missing = [axis for axis in item["axis_checks"] if not known or axis not in known["axes"]]
            if known and not missing:
                continue
            todo.append({**item, "axis_checks": missing, "topic_known": bool(known)})
        (ROOT / "judge_items_todo.json").write_text(json.dumps(todo, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"items {len(items)}, to judge {len(todo)} (new topic {sum(not t['topic_known'] for t in todo)})")
        return

    for judge in JUDGES:
        old = previous(judge)
        fresh = {
            row["item_id"]: row
            for row in json.loads((ROOT / "judge" / f"todo_{judge}.json").read_text(encoding="utf-8"))
        }
        merged = []
        for item in items:
            key = (item["situation"], item["record_id"])
            known = old.get(key)
            new = fresh.get(item["item_id"])
            topic = known["topic"] if known else new["topic"]
            reason = known["reason"] if known else new["reason"]
            axes = {}
            for axis in item["axis_checks"]:
                if known and axis in known["axes"]:
                    axes[axis] = known["axes"][axis]
                else:
                    axes[axis] = new["axes"][axis]
            merged.append({"item_id": item["item_id"], "topic": topic, "axes": axes, "reason": reason,
                           "reused": bool(known)})
        (ROOT / "judge" / f"judgments_{judge}.json").write_text(
            json.dumps(merged, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(judge, "merged", len(merged), "reused", sum(m["reused"] for m in merged))


if __name__ == "__main__":
    main()
