"""P3 참조표준 통계 함수 단위 테스트.

층화 가중, Rogan-Gladen 보정, 층화 부트스트랩 CI, 종합 라벨 도출 규칙,
층별 표본 배분, 라운드 간 kappa 를 검증한다.

    python -m unittest tools.v30.test_agent_reference_stats -v
"""

from __future__ import annotations

import math
import unittest

from tools.v30.agent_reference_sample import (
    allocate,
    bootstrap_ci,
    cohen_kappa,
    derive_label,
    percentile,
    rogan_gladen,
    weighted_rates,
)


def unit(weight, classifier_positive, reference_positive):
    return {
        "weight": weight,
        "classifier_positive": classifier_positive,
        "reference_positive": reference_positive,
    }


class TestWeightedRates(unittest.TestCase):
    def test_perfect_agreement(self):
        units = [unit(3.0, True, True), unit(5.0, False, False)]
        rates = weighted_rates(units)
        self.assertEqual(rates["sensitivity_vs_ai_reference"], 1.0)
        self.assertEqual(rates["specificity_vs_ai_reference"], 1.0)
        self.assertEqual(rates["agreement_vs_ai_reference"], 1.0)

    def test_weighting_is_not_a_simple_average(self):
        # 층 A: 가중치 1, 참조양성 2건 중 1건만 분류기가 잡음 -> 층내 민감도 0.5
        # 층 B: 가중치 9, 참조양성 2건 모두 분류기가 잡음 -> 층내 민감도 1.0
        units = [
            unit(1.0, True, True),
            unit(1.0, False, True),
            unit(9.0, True, True),
            unit(9.0, True, True),
        ]
        weighted = weighted_rates(units)["sensitivity_vs_ai_reference"]
        unweighted = 3 / 4  # 가중치를 무시한 단순 비율
        self.assertAlmostEqual(weighted, (1.0 + 9.0 + 9.0) / (1.0 + 1.0 + 9.0 + 9.0))
        self.assertNotAlmostEqual(weighted, unweighted)
        self.assertGreater(weighted, unweighted)

    def test_cell_counts_use_reference_naming(self):
        units = [unit(2.0, True, True), unit(4.0, True, False)]
        rates = weighted_rates(units)
        self.assertEqual(rates["reference_positive_classifier_positive"], 2.0)
        self.assertEqual(rates["reference_negative_classifier_positive"], 4.0)
        self.assertEqual(rates["specificity_vs_ai_reference"], 0.0)

    def test_empty_denominator_gives_nan(self):
        rates = weighted_rates([unit(1.0, True, False)])
        self.assertTrue(math.isnan(rates["sensitivity_vs_ai_reference"]))


class TestRoganGladen(unittest.TestCase):
    def test_perfect_test_returns_apparent(self):
        self.assertAlmostEqual(rogan_gladen(0.4, 1.0, 1.0), 0.4)

    def test_known_value(self):
        # (0.60 + 0.80 - 1) / (0.90 + 0.80 - 1) = 0.40 / 0.70
        self.assertAlmostEqual(rogan_gladen(0.60, 0.90, 0.80), 0.40 / 0.70)

    def test_uninformative_test_is_nan(self):
        self.assertTrue(math.isnan(rogan_gladen(0.5, 0.5, 0.5)))
        self.assertTrue(math.isnan(rogan_gladen(0.5, 0.3, 0.4)))

    def test_result_is_clamped_to_unit_interval(self):
        self.assertEqual(rogan_gladen(0.99, 0.60, 0.60), 1.0)
        self.assertEqual(rogan_gladen(0.01, 0.60, 0.60), 0.0)


class TestBootstrap(unittest.TestCase):
    def setUp(self):
        self.strata = {
            "a": [unit(2.0, True, True)] * 8 + [unit(2.0, False, True)] * 2,
            "b": [unit(5.0, False, False)] * 9 + [unit(5.0, True, False)] * 1,
        }

    def test_deterministic_for_a_given_seed(self):
        first = bootstrap_ci(self.strata, 0.5, 200, seed=7)
        second = bootstrap_ci(self.strata, 0.5, 200, seed=7)
        self.assertEqual(first["sensitivity"], second["sensitivity"])
        self.assertNotEqual(
            first["sensitivity"], bootstrap_ci(self.strata, 0.5, 200, seed=8)["sensitivity"]
        )

    def test_iteration_count_and_bounds(self):
        draws = bootstrap_ci(self.strata, 0.5, 500, seed=11)
        self.assertEqual(len(draws["sensitivity"]), 500)
        self.assertTrue(all(0.0 <= v <= 1.0 for v in draws["sensitivity"]))
        self.assertTrue(all(0.0 <= v <= 1.0 for v in draws["specificity"]))

    def test_ci_brackets_the_point_estimate(self):
        point = weighted_rates(
            [u for pool in self.strata.values() for u in pool]
        )["sensitivity_vs_ai_reference"]
        draws = bootstrap_ci(self.strata, 0.5, 2000, seed=13)
        lo = percentile(draws["sensitivity"], 0.025)
        hi = percentile(draws["sensitivity"], 0.975)
        self.assertLessEqual(lo, point)
        self.assertGreaterEqual(hi, point)

    def test_resampling_stays_inside_strata(self):
        # 층 b 에만 있는 가중치 5.0 이 층 a 크기를 바꾸지 않아야 한다.
        draws = bootstrap_ci({"a": self.strata["a"]}, 0.5, 50, seed=3)
        self.assertTrue(all(math.isnan(v) or 0.0 <= v <= 1.0 for v in draws["specificity"]))


class TestPercentile(unittest.TestCase):
    def test_interpolates_between_order_statistics(self):
        self.assertAlmostEqual(percentile([0.0, 1.0], 0.5), 0.5)
        self.assertAlmostEqual(percentile([1.0, 2.0, 3.0, 4.0], 0.25), 1.75)

    def test_ignores_nan(self):
        self.assertAlmostEqual(percentile([float("nan"), 2.0, 4.0], 0.5), 3.0)


class TestDeriveLabel(unittest.TestCase):
    def axes(self, **kw):
        base = {
            "population": "yes",
            "intervention": "yes",
            "comparator": "no",
            "outcome": "yes",
            "design": "human_clinical",
        }
        base.update(kw)
        return base

    def test_all_yes_is_retain(self):
        self.assertEqual(derive_label(self.axes()), "reference_retain")

    def test_comparator_does_not_gate(self):
        self.assertEqual(derive_label(self.axes(comparator="no")), "reference_retain")
        self.assertEqual(derive_label(self.axes(comparator="unclear")), "reference_retain")

    def test_any_no_on_core_axis_is_deprioritize(self):
        for axis in ("population", "intervention", "outcome"):
            self.assertEqual(derive_label(self.axes(**{axis: "no"})), "reference_deprioritize")

    def test_animal_or_in_vitro_overrides_yes_axes(self):
        self.assertEqual(derive_label(self.axes(design="animal")), "reference_deprioritize")
        self.assertEqual(derive_label(self.axes(design="in_vitro")), "reference_deprioritize")

    def test_unclear_without_no_is_uncertain(self):
        self.assertEqual(derive_label(self.axes(outcome="unclear")), "reference_uncertain")
        self.assertEqual(
            derive_label(self.axes(population="unclear", design="unclear")),
            "reference_uncertain",
        )


class TestAllocate(unittest.TestCase):
    def test_hits_target_and_respects_bounds(self):
        sizes = {"a": 900, "b": 90, "c": 9, "d": 1}
        alloc = allocate(sizes, 300, 5)
        self.assertEqual(sum(alloc.values()), 300)
        self.assertEqual(alloc["d"], 1)  # 층 크기보다 크게 뽑을 수 없다
        for key, size in sizes.items():
            self.assertLessEqual(alloc[key], size)

    def test_small_strata_get_the_minimum(self):
        sizes = {"big": 2000, "tiny": 20}
        alloc = allocate(sizes, 100, 5)
        self.assertGreaterEqual(alloc["tiny"], 5)
        self.assertEqual(sum(alloc.values()), 100)


class TestCohenKappa(unittest.TestCase):
    def test_perfect_agreement(self):
        labels = ["a", "b", "a", "c"]
        self.assertAlmostEqual(cohen_kappa(labels, labels), 1.0)

    def test_no_agreement_beyond_chance(self):
        a = ["x", "x", "y", "y"]
        b = ["x", "y", "x", "y"]
        self.assertAlmostEqual(cohen_kappa(a, b), 0.0)

    def test_single_label_everywhere(self):
        self.assertEqual(cohen_kappa(["a", "a"], ["a", "a"]), 1.0)


if __name__ == "__main__":
    unittest.main()
