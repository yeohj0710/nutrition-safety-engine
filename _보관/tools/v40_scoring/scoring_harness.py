"""v4.0 채점 arm 하네스 — 카드 배포, 판정 검증, 라벨 잠금.

판정은 이 스크립트가 하지 않는다. 채점자가 카드를 읽고 rounds/round_NNN.json 에 판정을 쓴다.
이 스크립트는 배포 순서 고정, 스키마 검증, 중복·누락 확인, 잠금 해시와 시각 기록만 한다.

사용법
  python scoring_harness.py cards            다음 미채점 묶음을 출력 (최대 30건, 문자 예산 내)
  python scoring_harness.py cards --round N  N번 묶음을 다시 출력
  python scoring_harness.py status           진행률
  python scoring_harness.py validate         모든 라운드 파일 검증
  python scoring_harness.py lock             전량 채점 확인 후 라벨 잠금 (해시·시각 기록)
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "validation" / "screening_ai_reference_v40"
CARDS_PATH = OUT / "blinded_cards.json"
ROUNDS_DIR = OUT / "rounds"

MAX_PER_ROUND = 30
CHAR_BUDGET = 60000

DECISIONS = ("retain", "deprioritize", "uncertain")
REASON_CODES = (
    "population", "exposure", "outcome", "human_signal", "design_signal",
    "animal_term_present", "off_topic", "insufficient_abstract",
)
CONFIDENCE = ("high", "medium", "low")


def load_cards() -> list[dict]:
    return json.loads(CARDS_PATH.read_text(encoding="utf-8"))


def card_sha() -> str:
    return hashlib.sha256(CARDS_PATH.read_bytes()).hexdigest()


def load_rounds() -> dict[int, list[dict]]:
    ROUNDS_DIR.mkdir(parents=True, exist_ok=True)
    out: dict[int, list[dict]] = {}
    for fp in sorted(ROUNDS_DIR.glob("round_*.json")):
        n = int(fp.stem.split("_")[1])
        payload = json.loads(fp.read_text(encoding="utf-8"))
        out[n] = payload["judgments"] if isinstance(payload, dict) else payload
    return out


def scored_keys(rounds: dict[int, list[dict]]) -> dict[str, dict]:
    seen: dict[str, dict] = {}
    for n in sorted(rounds):
        for j in rounds[n]:
            key = f"{j['question_id']}|{j['record_id']}"
            if key in seen:
                raise SystemExit(f"중복 판정: round_{n:03d} 의 {key}")
            seen[key] = j
    return seen


def plan_rounds(cards: list[dict]) -> list[list[int]]:
    """카드 배포 묶음을 결정적으로 계획한다. 문자 예산을 넘기지 않아 잘림이 없다."""
    plan: list[list[int]] = []
    cur: list[int] = []
    cur_chars = 0
    for i, c in enumerate(cards):
        size = len(c["title"]) + len(c["abstract"]) + len(c["mesh_terms"]) + len(c["publication_types"])
        if cur and (len(cur) >= MAX_PER_ROUND or cur_chars + size > CHAR_BUDGET):
            plan.append(cur)
            cur, cur_chars = [], 0
        cur.append(i)
        cur_chars += size
    if cur:
        plan.append(cur)
    return plan


def cmd_cards(args) -> None:
    """미채점 카드만 문자 예산 안에서 내보낸다.

    계획된 묶음이 아니라 '남은 것'을 기준으로 뽑기 때문에, 묶음 경계가 바뀌어도
    이미 채점한 카드를 다시 배포하지 않는다.
    """
    cards = load_cards()
    rounds = load_rounds()
    seen = scored_keys(rounds)

    remaining = [i for i, c in enumerate(cards)
                 if f"{c['question_id']}|{c['record_id']}" not in seen]
    if not remaining:
        print(f"전량 채점 완료 — {len(seen)}/{len(cards)}. lock 으로 진행하라.")
        return

    group: list[int] = []
    chars = 0
    for i in remaining:
        c = cards[i]
        size = len(c["title"]) + len(c["abstract"]) + len(c["mesh_terms"]) + len(c["publication_types"])
        if group and (len(group) >= MAX_PER_ROUND or chars + size > CHAR_BUDGET):
            break
        group.append(i)
        chars += size

    round_no = (max(rounds) if rounds else 0) + 1
    print(f"### ROUND {round_no}  ({len(group)}건)  누적 {len(seen)}/{len(cards)}"
          f"  남음 {len(remaining)}")
    print(f"### 판정 파일: research/validation/screening_ai_reference_v40/rounds/round_{round_no:03d}.json")
    print(f"### 허용 decision: {', '.join(DECISIONS)}")
    print(f"### 허용 reason_codes: {', '.join(REASON_CODES)}")
    print()
    for i in group:
        c = cards[i]
        print(f"--- [{i}] {c['record_id']} | {c['question_id']}")
        print(f"TITLE: {c['title']}")
        pt = c["publication_types"] or "(없음)"
        print(f"PUBTYPES: {pt}")
        mt = c["mesh_terms"] or "(MeSH 없음 — 미색인)"
        print(f"MESH: {mt}")
        ab = c["abstract"] or "(초록 없음 — title_only)"
        print(f"ABSTRACT: {ab}")
        print()


def cmd_status(args) -> None:
    cards = load_cards()
    rounds = load_rounds()
    seen = scored_keys(rounds)
    done = sum(1 for c in cards if f"{c['question_id']}|{c['record_id']}" in seen)
    print(f"카드 {len(cards)}건")
    print(f"채점 완료 {done}건  남음 {len(cards)-done}건  ({done/len(cards)*100:.1f}%)")
    print(f"기록된 라운드 파일 {len(rounds)}개: {sorted(rounds)}")


def validate(cards: list[dict], rounds: dict[int, list[dict]]) -> dict[str, dict]:
    valid_keys = {f"{c['question_id']}|{c['record_id']}" for c in cards}
    basis = {f"{c['question_id']}|{c['record_id']}": ("abstract" if c["abstract"] else "title_only")
             for c in cards}
    seen = scored_keys(rounds)

    problems: list[str] = []
    for key, j in seen.items():
        if key not in valid_keys:
            problems.append(f"카드에 없는 키: {key}")
            continue
        if j.get("decision") not in DECISIONS:
            problems.append(f"{key}: decision 부적합 {j.get('decision')!r}")
        rc = j.get("reason_codes")
        if not isinstance(rc, list) or not rc or len(rc) != len(set(rc)) or not set(rc) <= set(REASON_CODES):
            problems.append(f"{key}: reason_codes 부적합 {rc!r}")
        if j.get("confidence") not in CONFIDENCE:
            problems.append(f"{key}: confidence 부적합 {j.get('confidence')!r}")
        # 동결 프롬프트 6절: 초록이 없으면 confidence=low, insufficient_abstract 필수.
        if basis[key] == "title_only":
            if j.get("confidence") != "low":
                problems.append(f"{key}: title_only 인데 confidence={j.get('confidence')!r} (low 여야 함)")
            if isinstance(rc, list) and "insufficient_abstract" not in rc:
                problems.append(f"{key}: title_only 인데 insufficient_abstract 누락")
    if problems:
        for p in problems[:25]:
            print("  !", p)
        raise SystemExit(f"검증 실패 {len(problems)}건")
    return seen


def cmd_validate(args) -> None:
    cards = load_cards()
    rounds = load_rounds()
    seen = validate(cards, rounds)
    print(f"검증 통과 — 판정 {len(seen)}건 / 카드 {len(cards)}건")
    missing = [f"{c['question_id']}|{c['record_id']}" for c in cards
               if f"{c['question_id']}|{c['record_id']}" not in seen]
    if missing:
        print(f"미채점 {len(missing)}건 (예: {missing[:3]})")


def cmd_lock(args) -> None:
    cards = load_cards()
    rounds = load_rounds()
    seen = validate(cards, rounds)

    keys = [f"{c['question_id']}|{c['record_id']}" for c in cards]
    missing = [k for k in keys if k not in seen]
    if missing:
        raise SystemExit(f"미채점 {len(missing)}건 남음 — 잠금 불가")

    locked = {}
    for c in cards:
        key = f"{c['question_id']}|{c['record_id']}"
        j = seen[key]
        locked[key] = {
            "decision": j["decision"],
            "reason_codes": sorted(j["reason_codes"]),
            "confidence": j["confidence"],
            "evidence_basis": "abstract" if c["abstract"] else "title_only",
        }

    payload = json.dumps(locked, ensure_ascii=False, indent=2, sort_keys=True)
    lp = OUT / "scored_labels_locked.json"
    lp.write_text(payload, encoding="utf-8")
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    locked_at = dt.datetime.now(dt.timezone.utc).isoformat()

    receipt = {
        "schema_version": "1.0.0",
        "event": "scoring_labels_locked",
        "locked_at_utc": locked_at,
        "scored_rows": len(locked),
        "scored_labels_sha256": digest,
        "blinded_cards_sha256": card_sha(),
        "round_files": sorted(rounds),
        "truth_opened_before_lock": False,
        "note": "이 시각 이후에만 v40_truth_sealed.json 을 열어 대조한다.",
    }
    rp = OUT / "lock_receipt.json"
    rp.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"잠금 완료 {len(locked)}건")
    print(f"  라벨 {lp.relative_to(ROOT)}")
    print(f"  sha256 {digest}")
    print(f"  잠금 시각(UTC) {locked_at}")
    print(f"  영수증 {rp.relative_to(ROOT)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("cards"); c.add_argument("--round", type=int, default=None); c.set_defaults(fn=cmd_cards)
    s = sub.add_parser("status"); s.set_defaults(fn=cmd_status)
    v = sub.add_parser("validate"); v.set_defaults(fn=cmd_validate)
    l = sub.add_parser("lock"); l.set_defaults(fn=cmd_lock)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
