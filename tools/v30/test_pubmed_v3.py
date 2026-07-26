from __future__ import annotations

import unittest

from tools.v30.pubmed_v3 import MAX_TOTAL_ROWS, parse_pubmed_xml, validate_query


SAMPLE_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>12345</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2024</Year></PubDate></JournalIssue><Title>Test Journal</Title></Journal>
        <ArticleTitle>Safety &amp; outcomes.</ArticleTitle>
        <Abstract><AbstractText Label="RESULTS">No serious adverse events.</AbstractText></Abstract>
        <AuthorList><Author><LastName>Kim</LastName><Initials>HJ</Initials></Author></AuthorList>
        <PublicationTypeList><PublicationType>Clinical Trial</PublicationType></PublicationTypeList>
      </Article>
    </MedlineCitation>
    <PubmedData><ArticleIdList><ArticleId IdType="doi">10.1/test</ArticleId><ArticleId IdType="pmc">PMC123</ArticleId></ArticleIdList></PubmedData>
  </PubmedArticle>
</PubmedArticleSet>"""


class PubMedV3Tests(unittest.TestCase):
    def test_query_requires_mesh_tiab_and_humans(self) -> None:
        validate_query('(\"Dietary Supplements\"[Mesh] AND safety[tiab] AND humans[Mesh])')
        with self.assertRaises(ValueError):
            validate_query('supplements[tiab] AND humans[Mesh]')

    def test_parse_pubmed_xml_matches_v3_fields(self) -> None:
        rows = parse_pubmed_xml(
            SAMPLE_XML,
            question_id="HRS_TEST",
            raw_source_path="research/searches_v3/test.xml",
            raw_source_sha256="abc",
        )
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["record_id"], "pubmed:12345")
        self.assertEqual(row["question_id"], "HRS_TEST")
        self.assertEqual(row["observability"], "abstract_available")
        self.assertEqual(row["fulltext_locator_status"], "pmc_locator_available")
        self.assertEqual(row["doi"], "10.1/test")

    def test_title_only_is_not_dropped(self) -> None:
        xml = SAMPLE_XML.replace(
            b'<Abstract><AbstractText Label="RESULTS">No serious adverse events.</AbstractText></Abstract>',
            b'',
        )
        row = parse_pubmed_xml(
            xml,
            question_id="HRS_TEST",
            raw_source_path="test.xml",
            raw_source_sha256="abc",
        )[0]
        self.assertEqual(row["observability"], "title_only")

    def test_cap_constant_is_ten_thousand(self) -> None:
        self.assertEqual(MAX_TOTAL_ROWS, 10_000)


if __name__ == "__main__":
    unittest.main()
