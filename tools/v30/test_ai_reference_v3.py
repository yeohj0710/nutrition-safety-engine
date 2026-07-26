from __future__ import annotations

import unittest

from tools.v30.ai_reference_v3 import (
    aggregate_reference_label,
    corrected_retain_count,
    majority_label,
    normalize_element,
    parse_element_response,
    weighted_metrics,
)


class AiReferenceV3Tests(unittest.TestCase):
    def test_parse_element_response_normalizes_values(self) -> None:
        parsed = parse_element_response(
            '{"population":"yes","exposure":"true","comparator":"unclear",'
            '"outcome":"no","design":"yes"}'
        )
        self.assertEqual(parsed["exposure"], "yes")
        self.assertEqual(parsed["comparator"], "uncertain")
        self.assertEqual(parsed["outcome"], "no")

    def test_parse_element_response_repairs_unquoted_allowed_values(self) -> None:
        parsed = parse_element_response(
            '{"population": uncertain, "exposure": "yes", "comparator": uncertain, '
            '"outcome": "yes", "design": "uncertain"}'
        )
        self.assertEqual(parsed["population"], "uncertain")
        self.assertEqual(parsed["exposure"], "yes")

    def test_aggregate_reference_label_uses_fixed_rule(self) -> None:
        self.assertEqual(aggregate_reference_label({
            "population": "yes", "exposure": "yes", "comparator": "uncertain",
            "outcome": "yes", "design": "yes",
        }), "retain")
        self.assertEqual(aggregate_reference_label({
            "population": "yes", "exposure": "no", "comparator": "uncertain",
            "outcome": "yes", "design": "yes",
        }), "deprioritize")
        self.assertEqual(aggregate_reference_label({
            "population": "uncertain", "exposure": "yes", "comparator": "uncertain",
            "outcome": "yes", "design": "yes",
        }), "uncertain")

    def test_three_different_votes_are_unresolved(self) -> None:
        label, unresolved = majority_label(["retain", "deprioritize", "uncertain"])
        self.assertIsNone(label)
        self.assertTrue(unresolved)

    def test_weighted_metrics_use_weights(self) -> None:
        rows = [
            {"weight": 10.0, "p2_decision": "retain", "ai_reference_label": "retain"},
            {"weight": 1.0, "p2_decision": "deprioritize", "ai_reference_label": "retain"},
            {"weight": 2.0, "p2_decision": "deprioritize", "ai_reference_label": "deprioritize"},
            {"weight": 1.0, "p2_decision": "retain", "ai_reference_label": "deprioritize"},
        ]
        metrics = weighted_metrics(rows)
        self.assertAlmostEqual(metrics["sensitivity_vs_ai_reference"], 10 / 11)
        self.assertAlmostEqual(metrics["specificity_vs_ai_reference"], 2 / 3)

    def test_rogan_gladen_correction(self) -> None:
        estimate = corrected_retain_count(0.2, 0.8, 0.9, 1000)
        self.assertAlmostEqual(estimate or 0, 1000 / 7)

    def test_unknown_element_normalizes_to_uncertain(self) -> None:
        self.assertEqual(normalize_element("maybe"), "uncertain")


if __name__ == "__main__":
    unittest.main()
