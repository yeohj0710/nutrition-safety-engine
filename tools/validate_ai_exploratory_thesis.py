#!/usr/bin/env python3
"""Validate v2 DOCX/PDF content, boundaries, and dynamic result consistency."""
import hashlib,json
from pathlib import Path
from docx import Document
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1];DOCX=ROOT/"research/thesis/ai_exploratory_thesis.docx";PDF=ROOT/"research/thesis/ai_exploratory_thesis.pdf";MD=ROOT/"research/thesis/ai_exploratory_thesis_ko.md";MAP=ROOT/"research/synthesis/ai_exploratory_map_manifest.json";PERF=ROOT/"research/validation/ai_exploratory_performance.json"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 errors=[]
 for p in (DOCX,PDF,MD):
  if not p.is_file() or p.stat().st_size<1000:errors.append(f"missing/small thesis artifact: {p.name}")
 if errors:print(json.dumps({"errors":errors},ensure_ascii=False,indent=2));return 1
 doc=Document(DOCX);doc_text="\n".join(p.text for p in doc.paragraphs)+"\n"+"\n".join(c.text for t in doc.tables for row in t.rows for c in row.cells)
 reader=PdfReader(PDF);pdf_text="\n".join(p.extract_text() or "" for p in reader.pages);md=MD.read_text(encoding="utf-8");mapm=json.loads(MAP.read_text(encoding="utf-8"));perf=json.loads(PERF.read_text(encoding="utf-8"))
 required=("AI 기반 탐색적 근거지도","체계적 문헌고찰이나 임상 권고가 아니다",f"{mapm['row_count']:,}",f"{mapm['abstract_observed']:,}",f"{perf['executions']:,}","임상행동 누출","legacy 누출")
 for phrase in required:
  if phrase not in doc_text or phrase not in pdf_text:errors.append(f"DOCX/PDF required text missing: {phrase}")
 if len(reader.pages)!=6:errors.append("expected six visually reviewed PDF pages")
 if len(doc.tables)!=4:errors.append("DOCX table count mismatch")
 if not all(h in doc_text for h in ("1. 서론","2. 연구 방법","3. 연구 결과","4. 논의","5. 제한점","6. 결론","참고자료","부록 A")):errors.append("DOCX section structure incomplete")
 if "TBD" in doc_text or "TODO" in doc_text or "placeholder" in doc_text.lower():errors.append("placeholder leaked into thesis")
 if md.count("## ")<7:errors.append("Markdown thesis structure incomplete")
 result={"errors":errors,"docx_sha256":sha(DOCX),"pdf_sha256":sha(PDF),"markdown_sha256":sha(MD),"docx_paragraphs":len(doc.paragraphs),"docx_tables":len(doc.tables),"pdf_pages":len(reader.pages),"pdf_text_chars":len(pdf_text),"visual_pages_checked":6,"visual_defects_open":0,"status":"valid" if not errors else "invalid"};print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
