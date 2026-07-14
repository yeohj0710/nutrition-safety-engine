from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from tools.search_pipeline.curation import _matched_terms
from tools.search_pipeline.dedup import dedup_retrieved_records
from tools.search_pipeline.pubmed_adapter import parse_pubmed_xml
from tools.search_pipeline.ris_parser import parse_ris_file
from tools.search_pipeline.schemas import RETRIEVED_RECORD_COLUMNS
from tools.search_pipeline.storage import write_csv_rows
from tools.build_pubmed_screening_agent_prereview import classify


class PubMedParserTest(unittest.TestCase):
    def test_parse_pubmed_xml_extracts_core_fields(self) -> None:
        xml = """<?xml version="1.0"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>12345</PMID>
      <Article>
        <Journal>
          <Title>Test Journal</Title>
          <JournalIssue><PubDate><Year>2024</Year></PubDate></JournalIssue>
        </Journal>
        <ArticleTitle>Omega-3 and bleeding risk</ArticleTitle>
        <Abstract>
          <AbstractText Label="Background">Warfarin users were studied.</AbstractText>
          <AbstractText>Bleeding outcome was assessed.</AbstractText>
        </Abstract>
        <ELocationID EIdType="doi">10.1000/example</ELocationID>
      </Article>
    </MedlineCitation>
    <PubmedData>
      <ArticleIdList>
        <ArticleId IdType="doi">10.1000/example</ArticleId>
      </ArticleIdList>
    </PubmedData>
  </PubmedArticle>
</PubmedArticleSet>
"""
        records = parse_pubmed_xml(xml, target_id="anticoag", search_run_id="run-1")

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].record_id, "pubmed:12345:run-1")
        self.assertEqual(records[0].doi, "10.1000/example")
        self.assertEqual(records[0].year, "2024")
        self.assertIn("Warfarin users", records[0].abstract_or_summary)


class RisParserTest(unittest.TestCase):
    def test_parse_ris_file_extracts_core_fields(self) -> None:
        ris = """TY  - JOUR
TI  - Warfarin and dietary supplement interactions
AB  - Abstract text.
PY  - 2021
JF  - British Journal of Clinical Pharmacology
DO  - 10.1111/example
UR  - https://example.org/article
AN  - L2005415619
ER  -
"""
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sample.ris"
            path.write_text(ris, encoding="utf-8")
            records = parse_ris_file(path, source="embase", target_id="anticoag", search_run_id="run-2")

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].record_id, "embase:L2005415619:run-2")
        self.assertEqual(records[0].doi, "10.1111/example")
        self.assertEqual(records[0].journal_or_source, "British Journal of Clinical Pharmacology")


class DedupTest(unittest.TestCase):
    def test_dedup_marks_later_duplicate_by_doi(self) -> None:
        rows = [
            {
                "record_id": "pubmed:1",
                "source": "pubmed",
                "title": "Same paper",
                "doi": "10.1000/ABC",
            },
            {
                "record_id": "embase:L1",
                "source": "embase",
                "title": "Same paper",
                "doi": "https://doi.org/10.1000/abc",
            },
        ]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_csv_rows(root / "retrieved_records.csv", rows, RETRIEVED_RECORD_COLUMNS)
            result = dedup_retrieved_records(root)

        self.assertEqual(result.total_records, 2)
        self.assertEqual(result.duplicate_records, 1)


class CurationTermMatchTest(unittest.TestCase):
    def test_short_terms_match_word_boundaries_only(self) -> None:
        text = "atrial stratification in anticoagulant users"

        self.assertEqual(_matched_terms(text, ("rat", "cat")), [])
        self.assertEqual(_matched_terms("rat model and cat study", ("rat", "cat")), ["rat", "cat"])


class PubMedAgentPrereviewTest(unittest.TestCase):
    def record(self, *, title: str, abstract: str, publication_types: str = "Journal Article") -> dict[str, str]:
        return {"title": title, "abstract": abstract, "publication_types": publication_types}

    def test_missing_abstract_always_requires_manual_review(self) -> None:
        result = classify(self.record(title="Mouse vitamin D study", abstract=""), "B2", False)
        self.assertEqual(result["agent_recommendation"], "uncertain_manual_review")
        self.assertIn("abstract_missing", result["uncertainty_flags"])

    def test_question_specific_exposure_and_outcome_advance(self) -> None:
        record = self.record(
            title="Vitamin C supplements and kidney stones",
            abstract="Adults taking ascorbic acid were followed for incident nephrolithiasis.",
        )
        result = classify(record, "B3", False)
        self.assertEqual(result["agent_recommendation"], "advance_to_human_screening")
        self.assertIn("vitamin c", result["matched_exposure_terms"])
        self.assertIn("stone", result["matched_outcome_terms"])

    def test_animal_only_is_recommendation_not_final_exclusion(self) -> None:
        record = self.record(title="Vitamin D in mice", abstract="Murine cell line experiment without human data.")
        result = classify(record, "B2", False)
        self.assertEqual(result["agent_recommendation"], "likely_exclude_needs_validation")
        self.assertIn("possible_animal_only", result["uncertainty_flags"])

    def test_sentinel_is_never_likely_exclude(self) -> None:
        record = self.record(title="Ambiguous safety report", abstract="Details remain unclear.")
        result = classify(record, "A1", True)
        self.assertEqual(result["agent_recommendation"], "uncertain_manual_review")
        self.assertIn("sentinel_record", result["uncertainty_flags"])


if __name__ == "__main__":
    unittest.main()
