#!/usr/bin/env python3
"""Validate the immutable, explicitly non-final methods checkpoint."""

import hashlib
import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / "research/thesis/checkpoints/methods_checkpoint_qa.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def docx_content(path: Path) -> tuple[str, list[str]]:
    with zipfile.ZipFile(path) as archive:
        root = ElementTree.fromstring(archive.read("word/document.xml"))
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    headings: list[str] = []
    for paragraph in root.findall(".//w:p", ns):
        style = paragraph.find("w:pPr/w:pStyle", ns)
        style_value = style.get(f"{{{ns['w']}}}val", "") if style is not None else ""
        if style_value.lower().startswith("heading"):
            headings.append("".join(paragraph.itertext()).strip())
    return "".join(root.itertext()), headings


def main() -> int:
    errors: list[str] = []
    qa = json.loads(QA.read_text(encoding="utf-8"))
    expected = {
        "status": "nonfinal_methods_checkpoint_visual_qa_complete_not_final_thesis",
        "page_count": 8,
        "inspected_pages": list(range(1, 9)),
        "visual_errors": [],
        "results_included": False,
        "discussion_included": False,
        "conclusion_included": False,
        "abstracts_included": False,
        "final_thesis_claim_allowed": False,
        "department_format_confirmed": False,
    }
    for key, value in expected.items():
        if qa.get(key) != value:
            errors.append(f"QA {key}: expected {value!r}, got {qa.get(key)!r}")

    artifacts = qa.get("artifacts", [])
    if len(artifacts) != 3 or len({item.get("path") for item in artifacts}) != 3:
        errors.append("expected three unique checkpoint artifacts")
    for item in artifacts:
        path = ROOT / item["path"]
        if not path.is_file():
            errors.append(f"missing artifact: {item['path']}")
        elif path.stat().st_size != item["size_bytes"] or sha256(path) != item["sha256"]:
            errors.append(f"artifact hash/size mismatch: {item['path']}")

    docx = ROOT / "research/thesis/checkpoints/methods_checkpoint_nonfinal.docx"
    if docx.is_file():
        text, headings = docx_content(docx)
        for marker in ("방법론 체크포인트", "비최종본", "작성 보류 항목"):
            if marker not in text:
                errors.append(f"DOCX required marker absent: {marker}")
        for forbidden in ("3. 결과", "4. 고찰", "5. 결론", "국문초록", "영문초록"):
            if forbidden in headings:
                errors.append(f"DOCX forbidden pre-freeze section present: {forbidden}")

    print(json.dumps({"errors": errors, "page_count": qa.get("page_count"),
                      "visual_pages_checked": len(qa.get("inspected_pages", [])),
                      "final_thesis": False}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
