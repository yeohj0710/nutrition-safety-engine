# -*- coding: utf-8 -*-
from __future__ import annotations

import sys
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import make_batches  # noqa: E402
import verify_coverage  # noqa: E402


class AgentScreeningHarnessTest(unittest.TestCase):
    def setUp(self) -> None:
        self.rows = [
            {"record_id": "R1", "question_id": "A1", "title": "T1", "abstract": ""},
            {"record_id": "R2", "question_id": "B2", "title": "T2", "abstract": ""},
        ]
        self.batch = {
            "batch_id": "test_title_only_0001",
            "input_sha256": make_batches.canonical_rows_sha256(self.rows),
            "evidence_basis": "title_only",
            "rows": self.rows,
        }
        self.results = [
            {"record_id": "R2", "question_id": "B2", "decision": "uncertain",
             "reason_codes": "insufficient_abstract", "confidence": "low", "status": "ok"},
            {"record_id": "R1", "question_id": "A1", "decision": "retain",
             "reason_codes": "exposure|outcome|insufficient_abstract",
             "confidence": "low", "status": "ok"},
        ]

    def test_valid_results_are_returned_in_batch_order(self) -> None:
        ordered = verify_coverage.validate_batch_results(self.batch, self.results)
        self.assertEqual([row["record_id"] for row in ordered], ["R1", "R2"])

    def test_title_only_requires_low_confidence_and_reason_code(self) -> None:
        invalid = [dict(row) for row in self.results]
        invalid[0]["confidence"] = "medium"
        with self.assertRaises(SystemExit):
            verify_coverage.validate_batch_results(self.batch, invalid)

    def test_duplicate_return_is_rejected(self) -> None:
        invalid = [self.results[0], self.results[0]]
        with self.assertRaises(SystemExit):
            verify_coverage.validate_batch_results(self.batch, invalid)

    def test_checkpoint_schema_rejects_extra_fields(self) -> None:
        invalid = [dict(row) for row in self.results]
        invalid[0]["batch_id"] = "must-live-in-sidecar"
        with self.assertRaises(SystemExit):
            verify_coverage.validate_batch_results(self.batch, invalid)


if __name__ == "__main__":
    unittest.main()
