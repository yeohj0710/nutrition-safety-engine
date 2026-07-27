#!/usr/bin/env python3
"""Regression tests for platform-independent Phase 02 evidence bytes."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from phase02_evidence_bytes import canonical_csv_bytes, canonical_text_bytes


class CanonicalCsvBytesTests(unittest.TestCase):
    def test_lf_and_crlf_sources_have_identical_canonical_bytes(self) -> None:
        lf = b'name,note\nalpha,"first\nsecond"\n'
        crlf = b'name,note\r\nalpha,"first\r\nsecond"\r\n'

        expected = b'name,note\nalpha,"first\nsecond"\n'
        self.assertEqual(canonical_csv_bytes(lf), expected)
        self.assertEqual(canonical_csv_bytes(crlf), expected)

    def test_utf8_bom_and_redundant_quotes_are_removed_deterministically(self) -> None:
        source = b'\xef\xbb\xbf"name","value"\r\n"alpha","plain"\r\n'

        self.assertEqual(canonical_csv_bytes(source), b'name,value\nalpha,plain\n')


class CanonicalTextBytesTests(unittest.TestCase):
    def test_text_normalizes_bom_crlf_and_bare_cr_to_utf8_lf(self) -> None:
        source = b'\xef\xbb\xbffirst\r\nsecond\rthird\n'

        self.assertEqual(canonical_text_bytes(source), b'first\nsecond\nthird\n')


if __name__ == "__main__":
    unittest.main()
