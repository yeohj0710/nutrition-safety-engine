#!/usr/bin/env python3
"""Flag meta-language, repetitive sentences and common AI-like phrasing in TXT/MD/DOCX."""
from __future__ import annotations

import argparse
import json
import re
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

META_PATTERNS = [
    r"\bCodex\b", r"\bChatGPT\b", r"\bprompt\b", r"프롬프트", r"에이전트",
    r"작업\s*지시", r"TODO", r"placeholder", r"이\s*문단을\s*수정",
]
AIISH_PATTERNS = [
    r"체계적(?:으로)?\s*구조화", r"고도화된?\s*파이프라인", r"유기적(?:으로)?\s*연계",
    r"개인맞춤형?\s*의사결정", r"활용\s*가능성을\s*시사", r"중요한\s*의의를\s*가진다",
    r"단순히\s*.+?가\s*아니라\s*.+?이다",
]


def extract_docx(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paras = []
    for p in root.findall(".//w:p", ns):
        text = "".join(t.text or "" for t in p.findall(".//w:t", ns))
        if text.strip():
            paras.append(text)
    return "\n".join(paras)


def read_text(path: Path) -> str:
    if path.suffix.lower() == ".docx":
        return extract_docx(path)
    for enc in ("utf-8-sig", "utf-8", "cp949"):
        try:
            return path.read_text(encoding=enc)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, "unsupported encoding")


def sentences(text: str) -> list[str]:
    out = []
    for s in re.split(r"(?<=[.!?다요])\s+|\n+", text):
        s = re.sub(r"\s+", " ", s).strip()
        if len(s) >= 20:
            out.append(s)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", type=Path)
    ap.add_argument("--json-out", type=Path)
    args = ap.parse_args()
    path = args.path.resolve()
    text = read_text(path)
    findings = []

    for severity, patterns in (("critical_meta", META_PATTERNS), ("style_warning", AIISH_PATTERNS)):
        for pat in patterns:
            for m in re.finditer(pat, text, flags=re.I | re.S):
                line = text.count("\n", 0, m.start()) + 1
                findings.append({"severity": severity, "pattern": pat, "line": line, "match": m.group(0)[:180]})

    normalized = [re.sub(r"\d+", "#", s.lower()) for s in sentences(text)]
    counts = Counter(normalized)
    repeated = [{"sentence": s, "count": n} for s, n in counts.items() if n >= 3]
    for item in repeated:
        findings.append({"severity": "repetition", **item})

    result = {
        "file": str(path),
        "characters": len(text),
        "findings": findings,
        "critical_count": sum(1 for f in findings if f["severity"] == "critical_meta"),
    }
    if args.json_out:
        args.json_out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result["critical_count"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
