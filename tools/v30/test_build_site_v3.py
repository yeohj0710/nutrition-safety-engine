from __future__ import annotations

import csv
import hashlib
import json
import re
import unittest
from collections import Counter
from pathlib import Path

from tools.v30.build_site_v3 import (
    CORE_MANIFEST_OUT,
    CORE_OUT,
    CORPUS_PATH,
    MANIFEST_OUT,
    MAX_CORE_PER_QUESTION,
    PICOS_OUT,
    QUESTION_CONFIG,
    REGEX_PATH,
    ROOT,
    RULES_OUT,
    TRANSLATIONS_OUT,
    direction_is_valid,
    normalized_number_tokens,
    normalized_unit_tokens,
    sha256_text,
    split_sentences,
)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def key(row: dict[str, str]) -> tuple[str, str]:
    return row["record_id"], row["question_id"]


class BuildSiteV3ArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        required = [CORPUS_PATH, REGEX_PATH, PICOS_OUT, CORE_OUT, MANIFEST_OUT]
        missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
        if missing:
            raise FileNotFoundError(f"required v3.0 artifacts are missing: {missing}")

        cls.corpus_rows = read_csv(CORPUS_PATH)
        cls.regex_rows = read_csv(REGEX_PATH)
        cls.picos_rows = read_csv(PICOS_OUT)
        cls.core_rows = read_csv(CORE_OUT)
        cls.corpus = {key(row): row for row in cls.corpus_rows}
        cls.picos = {key(row): row for row in cls.picos_rows}
        cls.core = {key(row): row for row in cls.core_rows}
        cls.manifest = json.loads(MANIFEST_OUT.read_text(encoding="utf-8"))

    def test_sentence_locators_exist_exactly_in_source_text(self) -> None:
        for row in self.picos_rows:
            row_key = key(row)
            source = self.corpus[row_key]
            locator_text = row["locator_text"]
            self.assertEqual(row["key_finding"], locator_text, row_key)

            if row["locator"] == "TITLE":
                self.assertEqual(row["source_scope"], "title_only", row_key)
                self.assertEqual(locator_text, source["title"].strip(), row_key)
                self.assertIn(locator_text, source["title"], row_key)
                continue

            match = re.fullmatch(r"ABSTRACT_SENTENCE_(\d+)", row["locator"])
            self.assertIsNotNone(match, row_key)
            self.assertEqual(row["source_scope"], "abstract_only", row_key)
            sentences = split_sentences(source["abstract"])
            sentence_index = int(match.group(1)) - 1  # type: ignore[union-attr]
            self.assertGreaterEqual(sentence_index, 0, row_key)
            self.assertLess(sentence_index, len(sentences), row_key)
            self.assertEqual(locator_text, sentences[sentence_index], row_key)
            self.assertIn(locator_text, source["abstract"], row_key)

    def test_core_is_picos_subset_with_at_most_15_per_question(self) -> None:
        self.assertEqual(len(self.picos), len(self.picos_rows), "duplicate PICOS keys")
        self.assertEqual(len(self.core), len(self.core_rows), "duplicate core keys")
        self.assertTrue(set(self.core).issubset(self.picos))

        counts = Counter(row["question_id"] for row in self.core_rows)
        self.assertEqual(set(counts), set(QUESTION_CONFIG))
        self.assertTrue(counts)
        for question_id, count in counts.items():
            self.assertLessEqual(count, MAX_CORE_PER_QUESTION, question_id)
        self.assertEqual(self.manifest["core_limit_per_question"], MAX_CORE_PER_QUESTION)

    def test_raw_source_sha256_matches_every_picos_row(self) -> None:
        digest_cache: dict[Path, str] = {}
        for row in self.picos_rows:
            row_key = key(row)
            source = self.corpus[row_key]
            self.assertEqual(row["raw_source_path"], source["raw_source_path"], row_key)
            self.assertEqual(row["raw_source_sha256"], source["raw_source_sha256"], row_key)

            raw_path = ROOT / row["raw_source_path"]
            self.assertTrue(raw_path.is_file(), raw_path)
            if raw_path not in digest_cache:
                digest_cache[raw_path] = hashlib.sha256(raw_path.read_bytes()).hexdigest()
            self.assertEqual(digest_cache[raw_path], row["raw_source_sha256"], row_key)

    def test_llm_gate_manifest_counts_match_gate_rows(self) -> None:
        gate = self.manifest["llm_gate"]
        self.assertIs(gate["applied"], True)

        regex_passed = [row for row in self.regex_rows if row["regex_passed"] == "true"]
        dropped = [row for row in regex_passed if row["llm_decision"] != "retain"]
        kept = [row for row in regex_passed if row["llm_decision"] == "retain"]
        kept_keys = {key(row) for row in kept}

        self.assertEqual(gate["regex_passed"], len(regex_passed))
        self.assertEqual(gate["dropped_by_llm"], len(dropped))
        self.assertEqual(gate["kept"], len(kept))
        self.assertEqual(gate["kept"], len(self.picos_rows))
        self.assertEqual(self.manifest["records"], len(self.picos_rows))
        self.assertEqual(kept_keys, set(self.picos))

        for row in self.regex_rows:
            expected = row["regex_passed"] == "true" and row["llm_decision"] == "retain"
            self.assertEqual(row["kept"], str(expected).lower(), key(row))

    def test_effect_values_are_not_observed(self) -> None:
        for row in self.picos_rows:
            self.assertEqual(row["extracted_effect_value"], "", key(row))
            self.assertEqual(row["extracted_effect_status"], "not_observed", key(row))
        self.assertEqual(self.manifest["effect_status"], {"not_observed": len(self.picos_rows)})

    def test_all_75_translations_preserve_numbers_units_and_direction(self) -> None:
        if not TRANSLATIONS_OUT.exists():
            self.skipTest("final translation artifact has not been generated yet")

        payload = json.loads(TRANSLATIONS_OUT.read_text(encoding="utf-8"))
        entries = payload["translations"]
        translation_map = {(entry["record_id"], entry["question_id"]): entry for entry in entries}

        self.assertEqual(payload["records"], 75)
        self.assertEqual(len(entries), 75)
        self.assertEqual(len(translation_map), 75, "duplicate translation keys")
        self.assertEqual(set(translation_map), set(self.core))

        for row_key, row in self.core.items():
            entry = translation_map[row_key]
            source = row["key_finding"]
            translation = entry["translation_ko"]
            self.assertEqual(entry["translation_id"], f"{row['question_id']}|{row['record_id']}")
            self.assertEqual(entry["source_text"], source, row_key)
            self.assertEqual(entry["source_sha256"], sha256_text(source), row_key)
            self.assertEqual(entry["translation_authorship"], "ai_generated", row_key)
            self.assertEqual(
                Counter(normalized_number_tokens(translation)),
                Counter(normalized_number_tokens(source)),
                f"number tokens changed: {row_key}",
            )
            self.assertEqual(
                Counter(normalized_unit_tokens(translation)),
                Counter(normalized_unit_tokens(source)),
                f"unit tokens changed: {row_key}",
            )
            self.assertTrue(direction_is_valid(source, translation), f"direction changed: {row_key}")

    def test_generated_personalization_rules_include_compatibility_aliases(self) -> None:
        if not RULES_OUT.exists():
            self.skipTest("personalization rules have not been generated yet")

        rules = json.loads(RULES_OUT.read_text(encoding="utf-8"))
        self.assertGreater(len(rules), 5)
        self.assertTrue({"A1", "A2", "B1", "B2", "B3"}.issubset(
            {rule["question_id"] for rule in rules}
        ))
        if CORE_MANIFEST_OUT.exists():
            core_manifest = json.loads(CORE_MANIFEST_OUT.read_text(encoding="utf-8"))
            self.assertEqual(core_manifest["rules"], len(rules))


if __name__ == "__main__":
    unittest.main()
