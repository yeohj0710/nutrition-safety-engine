#!/usr/bin/env python3
"""Render the verified DOCX body to a stable Korean PDF using ReportLab."""
from pathlib import Path
from docx import Document
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph as DocxParagraph
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER,TA_JUSTIFY
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle,getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate,Frame,PageTemplate,PageBreak,Paragraph,Spacer,Table,TableStyle,KeepTogether

ROOT=Path(__file__).resolve().parents[1];DOCX=ROOT/"research/thesis/systematic_review_thesis_v3.docx";PDF=ROOT/"research/thesis/systematic_review_thesis_v3.pdf"
font=Path("C:/Windows/Fonts/malgun.ttf");bold=Path("C:/Windows/Fonts/malgunbd.ttf")
pdfmetrics.registerFont(TTFont("Malgun",str(font)));pdfmetrics.registerFont(TTFont("MalgunBold",str(bold)))
class ThesisDoc(BaseDocTemplate):
 def __init__(self,*a,**kw):
  super().__init__(*a,**kw);frame=Frame(self.leftMargin,self.bottomMargin,self.width,self.height,id="main");self.addPageTemplates(PageTemplate(id="p",frames=frame,onPage=self.draw_page))
 def draw_page(self,canvas,doc):
  canvas.saveState();canvas.setFont("Malgun",8);canvas.setFillColor(colors.HexColor("#667078"));canvas.drawRightString(letter[0]-inch,letter[1]-0.55*inch,"영양보충제 안전성 체계적 근거 검토와 개인맞춤 조회 시스템");canvas.drawRightString(letter[0]-inch,0.55*inch,str(doc.page));canvas.restoreState()

styles=getSampleStyleSheet();body=ParagraphStyle("Body",fontName="Malgun",fontSize=10.4,leading=16.2,firstLineIndent=10.4,spaceAfter=6,alignment=TA_JUSTIFY,textColor=colors.HexColor("#111111"),wordWrap="CJK");h1=ParagraphStyle("H1",fontName="MalgunBold",fontSize=15,leading=20,spaceBefore=18,spaceAfter=9,keepWithNext=True,textColor=colors.HexColor("#111111"),wordWrap="CJK");h2=ParagraphStyle("H2",fontName="MalgunBold",fontSize=11.8,leading=16,spaceBefore=12,spaceAfter=5,keepWithNext=True,textColor=colors.HexColor("#222222"),wordWrap="CJK");cover=ParagraphStyle("Cover",fontName="MalgunBold",fontSize=20,leading=29,alignment=TA_CENTER,textColor=colors.HexColor("#111111"),wordWrap="CJK");center=ParagraphStyle("Center",parent=body,firstLineIndent=0,alignment=TA_CENTER);small=ParagraphStyle("Small",fontName="Malgun",fontSize=7.5,leading=10,wordWrap="CJK")
def iter_blocks(doc):
 for child in doc.element.body.iterchildren():
  if child.tag.endswith("}p"):yield DocxParagraph(child,doc)
  elif child.tag.endswith("}tbl"):yield DocxTable(child,doc)
def esc(x):return x.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
docx=Document(DOCX);story=[];first=True;in_toc=False
for block in iter_blocks(docx):
 if isinstance(block,DocxTable):
  data=[[Paragraph(esc(c.text),small) for c in row.cells] for row in block.rows];cols=len(data[0]);widths=[6.5*inch/cols]*cols
  if cols==2:widths=[1.9*inch,4.6*inch]
  elif cols==3:widths=[1.15*inch,2.75*inch,2.6*inch]
  t=Table(data,colWidths=widths,repeatRows=1,hAlign="CENTER");t.setStyle(TableStyle([("FONTNAME",(0,0),(-1,-1),"Malgun"),("BACKGROUND",(0,0),(-1,0),colors.HexColor("#E8EEF5")),("FONTNAME",(0,0),(-1,0),"MalgunBold"),("GRID",(0,0),(-1,-1),0.35,colors.HexColor("#B8C2CC")),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),5),("RIGHTPADDING",(0,0),(-1,-1),5),("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4)]));story += [t,Spacer(1,8)];continue
 text=block.text.strip();style=block.style.name if block.style else ""
 if block._p.xpath('.//w:br[@w:type="page"]'):
  story.append(PageBreak())
  if not text: continue
 if not text:continue
 if first and text=="학위논문":story += [Spacer(1,1.25*inch),Paragraph(text,h2),Spacer(1,.35*inch)];first=False;continue
 if text.startswith("항응고제 복용자") or (text.startswith("고위험 임상상황의") and "탐색" in text):story += [Spacer(1,.8*inch),Paragraph(esc(text),cover),Spacer(1,.25*inch)];continue
 if text.startswith("AI-Based Exploratory"):story += [Paragraph(esc(text),center),Spacer(1,.7*inch)];continue
 if text.startswith("여형준"):story += [Paragraph("<b>"+esc(text).replace("\n","<br/>")+"</b>",center),Spacer(1,.15*inch)];continue
 if text=="2026년 7월":story += [Paragraph(text,center),PageBreak()];continue
 if style.startswith("Heading 1"):
  in_toc = text == "목차"
  if text=="참고자료":story.append(PageBreak())
  story.append(Paragraph(esc(text),h1));continue
 if style.startswith("Heading 2"):story.append(Paragraph(esc(text),h2));continue
 if style=="Caption":story.append(Paragraph(esc(text),small));continue
 if style.startswith("List Number"):story.append(Paragraph("- "+esc(text),body));continue
 story.append(Paragraph(esc(text),small if in_toc else body))
ThesisDoc(str(PDF),pagesize=letter,rightMargin=inch,leftMargin=inch,topMargin=.8*inch,bottomMargin=.8*inch,title="영양보충제 안전성 체계적 근거 검토와 개인맞춤 조회 시스템",author="여형준").build(story)
print(PDF.relative_to(ROOT))
