import unittest
from tools.build.base_builder import split_sentences, regex_passes, translation_is_valid, direction_is_valid


class SentenceExcerptTests(unittest.TestCase):
    def test_comparison_is_complete_and_remains_verbatim(self):
        source = 'RESULTS: Median stay was 7 vs. 9 days (p = 0.04). No deaths occurred.'
        self.assertEqual(split_sentences(source), [
            'RESULTS: Median stay was 7 vs. 9 days (p = 0.04).', 'No deaths occurred.'])

    def test_citation_abbreviation_does_not_split(self):
        source = 'Trials included Smith et al. [3] and Lee. Results varied.'
        self.assertEqual(split_sentences(source), [
            'Trials included Smith et al. [3] and Lee.', 'Results varied.'])


class ReviewedScopeTests(unittest.TestCase):
    def test_daily_dose_unit_alias_preserves_dose(self):
        source = 'TU-100 7.5 g/d was not associated with a significant difference.'
        self.assertTrue(translation_is_valid(source, 'TU-100 7.5 g/일은 유의한 차이와 관련되지 않았다.'))
        self.assertFalse(translation_is_valid(source, 'TU-100 7.5 mg/일은 유의한 차이와 관련되지 않았다.'))

    def test_daily_dose_in_korean_word_order(self):
        self.assertTrue(translation_is_valid('DHA >650 mg/day.', 'DHA를 하루 650 mg 초과 보충했다.'))

    def test_equivalent_decimal_and_disease_label(self):
        self.assertTrue(translation_is_valid('13.0% in T2DM.', '제2형 당뇨병에서 13%였다.'))
        self.assertFalse(translation_is_valid('13.0% in T2DM.', '제2형 당뇨병에서 14%였다.'))

    def test_korean_adjective_is_not_a_number(self):
        self.assertTrue(translation_is_valid('Results improved.', '유의한 개선을 보였다.'))

    def test_reductase_is_not_a_decrease_claim(self):
        self.assertTrue(direction_is_valid('Folate with reductase inhibitors.', '환원효소 억제제와 엽산.'))
        self.assertFalse(direction_is_valid('Folate reduced risk.', '엽산과 위험.'))

    def test_bleeding_risk_does_not_require_an_anticoagulant_drug_name(self):
        row={'question_id':'HRS5_ANTICOAGULATION',
             'title':'Vitamin K treatment for elevated INR in chronic liver disease.',
             'abstract':'Hospitalized adults received vitamin K to reduce bleeding risk.'}
        self.assertTrue(regex_passes(row)[0])

    def test_lactation_is_within_the_maternal_exposure_scope(self):
        row={'question_id':'HRS3_PREGNANCY',
             'title':'Vitamin supplementation during breastfeeding.',
             'abstract':'Adverse events were monitored during supplementation.'}
        self.assertTrue(regex_passes(row)[0])


if __name__ == '__main__':
    unittest.main()
