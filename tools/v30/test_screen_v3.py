from __future__ import annotations

import unittest

from tools.v30.screen_v3 import (
    MAX_ABSTRACT_CHARS,
    build_prompt,
    load_corpus,
    load_questions,
    parse_model_response,
    verify_coverage,
)


class ScreenV3Tests(unittest.TestCase):
    def test_parse_json_response(self) -> None:
        parsed = parse_model_response(
            '{"decision":"retain","reason_codes":["population","exposure"],"confidence":"high"}'
        )
        self.assertEqual(parsed["decision"], "retain")
        self.assertEqual(parsed["reason_codes"], ["exposure", "population"])

    def test_parse_response_ignores_unknown_reason_code(self) -> None:
        parsed = parse_model_response(
            '```json\n{"decision":"uncertain","reason_codes":["unknown","outcome"],"confidence":"low"}\n```'
        )
        self.assertEqual(parsed["reason_codes"], ["outcome"])

    def test_missing_confidence_defaults_to_low(self) -> None:
        parsed = parse_model_response(
            '{"decision":"retain","reason_codes":["outcome","human_signal"]}'
        )
        self.assertEqual(parsed["confidence"], "low")

    def test_frame_has_exact_unique_keys_and_title_only_rows(self) -> None:
        frame = load_corpus()
        keys = [(row["record_id"], row["question_id"]) for row in frame]
        self.assertEqual(len(frame), 2209)
        self.assertEqual(len(keys), len(set(keys)))
        self.assertGreater(sum(row["evidence_basis"] == "title_only" for row in frame), 0)

    def test_prompt_contains_frozen_question_elements(self) -> None:
        row = load_corpus()[0]
        question = load_questions()[row["question_id"]]
        prompt = build_prompt(row, question)
        self.assertIn(f"P: {question['P']}", prompt)
        self.assertIn("TITLE:", prompt)
        self.assertIn("ABSTRACT:", prompt)

    def test_prompt_truncates_long_abstract_before_chat_template(self) -> None:
        row = load_corpus()[0]
        row = dict(row, abstract="x" * (MAX_ABSTRACT_CHARS + 50))
        question = load_questions()[row["question_id"]]
        prompt = build_prompt(row, question)
        self.assertIn("[ABSTRACT TRUNCATED BY FIXED INPUT LIMIT]", prompt)
        self.assertNotIn("x" * (MAX_ABSTRACT_CHARS + 1), prompt)

    def test_coverage_reports_missing_keys(self) -> None:
        frame = [
            {"record_id": "a", "question_id": "q"},
            {"record_id": "b", "question_id": "q"},
        ]
        result = verify_coverage(frame, {("a", "q"): {}})
        self.assertEqual(result["coverage"], 0.5)
        self.assertEqual(result["missing"], [("b", "q")])


if __name__ == "__main__":
    unittest.main()
