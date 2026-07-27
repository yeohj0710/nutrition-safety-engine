"""Codex 교차검증 arm 검증기 테스트.

실제 블라인드 표본의 blind_id 를 쓰되, 축 판정 값은 형식 검사를 위한 합성값이다.
이 값들은 연구 산출물에 들어가지 않는다.
"""

import json
import os
import tempfile
import unittest

from tools.v30.agent_reference_sample import load_blind
from tools.v30.codex_reference_arm import check

VALID_ROW = {
    "population": "yes",
    "intervention": "yes",
    "comparator": "no",
    "outcome": "yes",
    "design": "human_secondary",
}


def write_rows(rows):
    handle = tempfile.NamedTemporaryFile(
        "w", suffix=".jsonl", delete=False, encoding="utf-8", newline="\n"
    )
    with handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    return handle.name


class CodexArmValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.blind_ids = [record["blind_id"] for record in load_blind()]

    def run_check(self, rows):
        path = write_rows(rows)
        try:
            return check(path)
        finally:
            os.unlink(path)

    def full_rows(self):
        return [{"blind_id": bid, **VALID_ROW} for bid in self.blind_ids]

    def test_complete_valid_file_has_no_errors(self):
        seen, errors = self.run_check(self.full_rows())
        self.assertEqual(errors, [])
        self.assertEqual(len(seen), len(self.blind_ids))

    def test_missing_rows_are_reported(self):
        _, errors = self.run_check(self.full_rows()[:-3])
        self.assertEqual(sum(1 for e in errors if "판정 누락" in e), 3)

    def test_duplicate_blind_id_is_reported(self):
        rows = self.full_rows()
        rows.append(rows[0])
        _, errors = self.run_check(rows)
        self.assertTrue(any("중복" in e for e in errors))

    def test_p2_leakage_fields_are_rejected(self):
        rows = self.full_rows()
        rows[0] = {**rows[0], "confidence": "high", "batch_id": "b001"}
        _, errors = self.run_check(rows)
        self.assertTrue(any("블라인딩 위반" in e for e in errors))

    def test_out_of_vocabulary_axis_values_are_rejected(self):
        rows = self.full_rows()
        rows[0] = {**rows[0], "population": "maybe"}
        rows[1] = {**rows[1], "design": "human_study"}
        _, errors = self.run_check(rows)
        self.assertTrue(any("population 허용값 아님" in e for e in errors))
        self.assertTrue(any("design 허용값 아님" in e for e in errors))

    def test_summary_label_in_response_is_rejected(self):
        # 종합 라벨은 코드가 도출한다. 응답에 들어오면 규칙을 우회한 것이다.
        rows = self.full_rows()
        rows[0] = {**rows[0], "reference_label": "reference_retain"}
        _, errors = self.run_check(rows)
        self.assertTrue(any("허용되지 않은 필드" in e for e in errors))

    def test_unknown_blind_id_is_rejected(self):
        rows = self.full_rows()
        rows.append({"blind_id": "B9999", **VALID_ROW})
        _, errors = self.run_check(rows)
        self.assertTrue(any("표본에 없는 blind_id" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
