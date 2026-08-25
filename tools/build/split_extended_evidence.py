"""확장 근거 합본을 질문별 파일로 쪼갠다.

`build_extended_evidence.py` 가 만든 합본은 40MB 다. 라우트가 그것을 통째로
읽으니 프로덕션 콜드 요청이 6.3초였다. 방문자는 한 번에 상황 하나만 보므로
자기 질문 몫만 읽으면 된다. 쪼갠 파일은 3.7MB 에서 17MB 사이다.

배포에 들어가는 것은 쪼갠 쪽이다. 합본은 이 스크립트의 입력으로만 남기고
git 에서 뺐다(.gitignore). `build_extended_evidence.py` 를 다시 돌린 뒤에는
이 스크립트도 같이 돌려야 한다.

유료 호출 없음. 같은 입력에 같은 출력이다.
"""

from __future__ import annotations

import hashlib
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(
    ROOT, "research", "systematic_review", "extended_evidence.json"
)
OUT_DIR = os.path.join(
    ROOT, "research", "systematic_review", "extended_evidence"
)


def main() -> None:
    with open(SRC, encoding="utf-8") as handle:
        payload = json.load(handle)

    questions = payload.pop("questions")
    os.makedirs(OUT_DIR, exist_ok=True)

    total = 0
    for question_id, items in sorted(questions.items()):
        one = dict(payload)
        one["question_id"] = question_id
        one["records"] = len(items)
        one["evidence"] = items
        text = json.dumps(one, ensure_ascii=False, indent=1) + "\n"
        path = os.path.join(OUT_DIR, f"{question_id}.json")
        with open(path, "w", encoding="utf-8", newline="") as handle:
            handle.write(text)
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        size = len(text.encode("utf-8"))
        total += len(items)
        print(f"{question_id} rows={len(items)} bytes={size:,} sha256={digest[:16]}")

    print(f"total rows={total} out={OUT_DIR}")


if __name__ == "__main__":
    main()
