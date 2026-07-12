#!/usr/bin/env python3
"""Build the protocol-v2 Korean thesis DOCX and Markdown from verified manifests."""
from __future__ import annotations
import csv,hashlib,json
from pathlib import Path
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/"research/thesis"; OUT.mkdir(exist_ok=True)
DOCX=OUT/"ai_exploratory_thesis.docx"; MD=OUT/"ai_exploratory_thesis_ko.md"
MAP_MAN=ROOT/"research/synthesis/ai_exploratory_map_manifest.json"; SCREEN_MAN=ROOT/"research/screening/ai_exploratory_screening_manifest.json"; NONPUB_MAN=ROOT/"research/screening/ai_exploratory_nonpubmed_manifest.json"; PERF=ROOT/"research/validation/ai_exploratory_performance.json"; BUNDLE=ROOT/"src/generated/ai-exploratory-bundle.json"; PROTOCOL=ROOT/"research/protocol/protocol-v2.0-ai-exploratory.md"
def load(p):return json.loads(p.read_text(encoding="utf-8"))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
mapm,screen,nonpub,perf,bundle=map(load,(MAP_MAN,SCREEN_MAN,NONPUB_MAN,PERF,BUNDLE))
claims=[json.loads(x) for x in (ROOT/"data/curated_v2/provisional_claims.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]
question_names={"A1":"비타민 K와 비타민 K 길항제","A2":"오메가-3와 경구 항응고제","B1":"칼슘 보충과 결석 위험","B2":"비타민 D와 결석 위험","B3":"비타민 C와 결석 위험"}

title="고위험 임상상황의 영양보충제 안전성 문헌을 위한 AI 기반 탐색적 근거지도 구축과 결정론적 탐색 도구의 기술 검증"
eng="AI-Based Exploratory Evidence Mapping of Dietary Supplement Safety in High-Risk Clinical Contexts and Technical Validation of a Deterministic Navigation Tool"
abstract=(f"본 연구는 항응고제 복용과 칼슘옥살레이트 결석 위험에 관련된 다섯 질문의 공개 문헌을 AI 기반 탐색적 근거지도로 구조화하고, 출처 계보를 강제하는 결정론적 탐색 도구의 기술적 동작을 검증했다. "
f"확보한 corpus는 총 {mapm['row_count']:,}개 record-question unit으로, PubMed {mapm['source_counts']['pubmed']:,}개, ClinicalTrials.gov {mapm['source_counts']['clinicaltrials']:,}개, KoreaMed {mapm['source_counts']['koreamed']:,}개였다. 초록은 {mapm['abstract_observed']:,}개 행에서 확인됐고 {mapm['title_metadata_only']:,}개 행은 제목·메타데이터만 확인할 수 있었다. "
f"두 결정론적 분류 프로필을 결합한 PubMed 결과는 유지 합의 {screen['classifications']['ai_agreement_retain']:,}개, 후순위 합의 {screen['classifications']['ai_agreement_deprioritize']:,}개, 불일치·불확실 {screen['classifications']['ai_disagreement_uncertain']:,}개였다. 비-PubMed {nonpub['row_count']:,}개는 비순위 후보로 전량 보존했다. "
f"합성 fixture {perf['scenario_count']}개를 각 {perf['repeats_per_scenario']}회 실행한 결과 결정성, 정확한 질문 routing, 출처 계보 완전성은 모두 {perf['scenario_count']}/{perf['scenario_count']}였고 임상행동 누출, legacy 누출, near-match 오경로는 모두 0이었다. "
"이 결과는 문헌의 탐색 가능성과 소프트웨어 동작을 보여줄 뿐, 사람 선별을 거친 체계적 문헌고찰이나 임상 효과·안전성 결론을 뜻하지 않는다.")

sections=[
("1. 서론",[
"영양보충제 안전성은 성분 이름만으로 설명하기 어렵다. 같은 성분이라도 복용 중인 약, 기저질환, 용량, 제형, 복용 기간에 따라 확인해야 할 위험이 달라진다. 항응고제 복용자에게는 출혈과 항응고 효과의 변화가 중요하고, 칼슘옥살레이트 결석 위험군에게는 칼슘·비타민 D·비타민 C의 노출 형태와 용량이 중요하다.",
"문제는 근거가 여러 자료원에 흩어져 있다는 점이다. 임상시험 논문, 관찰연구, 연구등록자료, 국내 문헌, 공공기관 안내문은 서로 다른 형식으로 존재한다. 검색 결과가 많다는 사실만으로 어떤 문헌이 중요한지, 원문을 확인할 수 있는지, 같은 연구의 여러 보고인지 알 수 없다.",
"처음 설계한 연구는 독립적인 사람 선별과 이중 추출을 전제로 한 체계적 문헌고찰이었다. 그러나 해당 절차를 수행할 사람과 구독 자료원 접근이 확보되지 않았다. 이를 숨기거나 AI 판정을 사람 판정처럼 바꾸는 대신, 2026년 7월 12일 연구 질문을 투명하게 수정했다. 개정된 프로토콜 v2는 공개적으로 확보한 자료를 빠짐없이 보존해 탐색지도를 만들고, 그 지도를 조회하는 결정론적 도구의 기술적 안전 경계를 검증한다.",
"따라서 본 연구의 목적은 임상 권고를 만드는 것이 아니다. 첫째, 다섯 질문에 대해 실제 확보된 문헌 단위를 출처와 함께 구조화한다. 둘째, 두 자동 분류 프로필의 일치와 불일치를 기술한다. 셋째, 출처 계보를 유지한 채 질문별 근거지도를 찾아주는 비임상 탐색 엔진이 결정적으로 작동하는지 확인한다."]),
("2. 연구 방법",[
"연구설계는 AI 기반 탐색적 문헌지도와 소프트웨어 기술 검증이다. 본 연구는 체계적 문헌고찰이 아니며 사람 선별, 사람 합의 추출, RoB 평가, GRADE, 전문가 임상 검증을 수행하지 않았다.",
"연구 질문은 A1 비타민 K와 비타민 K 길항제, A2 오메가-3와 경구 항응고제, B1 칼슘 보충과 결석 위험, B2 비타민 D와 결석 위험, B3 비타민 C와 결석 위험으로 정했다. 분석 단위는 한 record가 한 질문에서 검색된 record-question unit이다. 같은 record가 여러 질문에 나타날 수 있으므로 행 수와 고유 record 수를 구분했다.",
"자료원은 실제로 보존된 PubMed, ClinicalTrials.gov, KoreaMed 자료다. KMbase와 RISS는 플랫폼 관찰자료와 PRESS 검토 자료로 보존했지만 최종 native export가 확보되지 않아 근거지도 행으로 통합하지 않았다. Embase, Scopus 또는 Web of Science, 일부 구독 원문은 접근권한이 없어 포함하지 못했다. 접근하지 못한 자료는 근거가 없다는 뜻으로 해석하지 않았다.",
"PubMed 분류에는 sensitivity-first와 structured-conservative 두 결정론적 프로필을 사용했다. 두 프로필이 모두 유지 후보로 분류하면 ai_agreement_retain, 모두 낮은 우선순위로 분류하면 ai_agreement_deprioritize, 나머지는 ai_disagreement_uncertain으로 기록했다. 이 세 값은 사람의 include·exclude·uncertain이 아니다. ClinicalTrials.gov와 KoreaMed는 같은 분류기가 없으므로 ai_unranked_source_candidate로 전량 보존했다.",
"근거지도에는 제목, 초록, 저자, 연도, 학술지, 출판유형, DOI·PMID, 자료원 URL, 자동 분류, 원자료 경로와 SHA-256을 기록했다. 공개 PMC 식별자가 있으면 접근 locator 후보로 연결했다. 원문 위치가 없는 효과수치와 임상결론은 추출하지 않았다.",
"탐색 엔진은 정확히 일치하는 성분명만 질문별 navigation rule에 연결한다. 출력은 질문별 corpus 규모, 자료원 분포, 자동 분류 분포와 출처 manifest로 제한했다. clinical_actions 필드는 스키마에서 빈 tuple로 고정했다.",
f"기술 검증에는 기존 합성 boundary fixture {perf['scenario_count']}개를 사용했다. 각 fixture를 {perf['repeats_per_scenario']}회 반복해 동일 출력 여부를 확인했다. 별도로 부분 문자열과 유사 표현 {perf['negative_near_match_cases']}개를 입력해 오경로를 확인했다. 평가지표는 결정성, 정확한 질문 routing, 계보 완전성, 임상행동 누출, legacy 누출, near-match 오경로였다."]),
("3. 연구 결과",[
f"근거지도에는 총 {mapm['row_count']:,}개 record-question unit이 생성됐다. PubMed가 {mapm['source_counts']['pubmed']:,}개로 가장 많았고 ClinicalTrials.gov {mapm['source_counts']['clinicaltrials']:,}개, KoreaMed {mapm['source_counts']['koreamed']:,}개가 뒤를 이었다.",
f"초록을 확인할 수 있는 행은 {mapm['abstract_observed']:,}개였고 제목과 메타데이터만 확인할 수 있는 행은 {mapm['title_metadata_only']:,}개였다. PMC 식별자 후보가 연결된 행은 {mapm['pmc_locator_record_question_rows']:,}개였으며, 이를 고유 record로 환산하면 {mapm['unique_records_with_pmc_identifier']:,}개였다. PMC 식별자는 원문 접근 후보일 뿐 실제 전문 검토 완료를 뜻하지 않는다.",
f"PubMed 자동 분류에서는 유지 합의가 {screen['classifications']['ai_agreement_retain']:,}개, 후순위 합의가 {screen['classifications']['ai_agreement_deprioritize']:,}개, 불일치·불확실이 {screen['classifications']['ai_disagreement_uncertain']:,}개였다. ClinicalTrials.gov와 KoreaMed의 {nonpub['row_count']:,}개는 비순위 후보로 남겼다.",
f"기술 검증에서 {perf['executions']:,}회 실행이 수행됐다. 결정성, 정확한 질문 routing, 출처 계보 완전성은 모두 {perf['scenario_count']}/{perf['scenario_count']}였다. 임상행동 누출은 {perf['clinical_action_leakage_scenarios']}건, legacy 누출은 {perf['legacy_leakage_scenarios']}건, near-match 오경로는 {perf['negative_false_routes']}건이었다."]),
("4. 논의",[
"가장 큰 결과는 문헌의 임상 결론이 아니라 불확실성의 위치를 드러냈다는 점이다. A1과 B2는 검색 규모가 컸지만, 큰 검색 규모가 곧 많은 관련 근거를 뜻하지 않는다. 특히 A1에는 vitamin K antagonist라는 약물명 때문에 비타민 K 보충과 직접 관련 없는 문헌이 함께 검색될 수 있다. ClinicalTrials.gov A1 행 가운데 139개에 이 lexical risk를 보존한 이유다.",
"두 자동 프로필의 불일치는 버릴 데이터가 아니라 검토가 필요한 경계 사례를 보여준다. A2, B1, B3처럼 불일치 비중이 큰 질문에서는 단순 키워드 규칙만으로 관련성을 결정하기 어렵다. 반대로 유지 합의가 많아도 임상 유효성이나 안전성이 입증됐다고 말할 수 없다.",
"source-bound 설계는 수치가 어디에서 왔는지 추적하게 한다. 모든 지도 행은 원자료 경로와 SHA-256을 가지고 있고, 질문별 잠정 주장도 evidence-map과 manifest 해시에 연결된다. 이 구조는 잘못된 임상 해석을 막는 충분조건은 아니지만, 적어도 근거 없는 수치가 조용히 섞이는 문제를 줄인다.",
"기술 검증 결과는 소프트웨어의 좁은 성질만 설명한다. 120개 fixture에서 경로가 정확하고 반복 출력이 같았다는 사실은 실제 환자 상황에서 안전하다는 증거가 아니다. 합성 fixture는 독립 gold가 아니며, 임상 sensitivity나 false-negative risk를 계산할 수 없다.",
"연구구조를 바꾼 선택에는 명확한 대가가 있다. 사람 선별을 없애면서 완료 가능한 연구가 됐지만, 임상 근거 합성과 권고라는 더 강한 질문에는 답할 수 없게 됐다. 이 한계를 숨기지 않고 연구 제목, 방법, 결과, 결론 전반에 반영했다."]),
("5. 제한점",[
"첫째, 독립적인 사람 선별과 전문 판정이 없다. 자동 분류는 탐색 우선순위일 뿐 포함·제외 판정이 아니다.",
"둘째, Embase, Scopus/Web of Science, 일부 국내 데이터베이스 native export, 구독 원문에 접근하지 못했다. 따라서 지도는 가능한 모든 근거의 완전한 목록이 아니다.",
"셋째, 2,215개 행은 초록이 없어 제목·메타데이터만 관찰했다. 초록이 있어도 원문의 연구방법과 수치를 대체할 수 없다.",
"넷째, 동일 record가 여러 질문에 나타날 수 있다. record-question 행 수를 고유 연구 수로 해석하면 안 된다.",
"다섯째, RoB와 GRADE를 수행하지 않았고 효과크기를 통합하지 않았다. 이 연구만으로 보충제 복용을 시작·중단하거나 용량을 바꾸면 안 된다.",
"여섯째, 기술 시나리오는 합성 자료다. 실제 전문가·사용자·환자 자료에서 검증하지 않았다."]),
("6. 결론",[
f"본 연구는 {mapm['row_count']:,}개 record-question unit을 출처와 함께 보존한 AI 기반 탐색적 근거지도를 구축했다. 두 자동 프로필의 합의와 불일치를 분리하고, 접근 가능한 초록과 PMC locator를 원자료 해시와 연결했다.",
"또한 다섯 질문을 정확한 성분명으로 탐색하는 결정론적 도구를 구현했다. 합성 기술 검증에서는 결정성과 계보 완전성이 유지됐고 임상행동 및 legacy 누출이 관찰되지 않았다.",
"다만 이 결과는 체계적 문헌고찰이나 임상 권고가 아니다. 이 지도의 적절한 용도는 관련 문헌을 찾고, 접근 제한과 불확실성을 확인하며, 향후 사람 검토 연구의 출발점을 제공하는 것이다."]),
]

def set_cell_shading(cell,fill):
 tcPr=cell._tc.get_or_add_tcPr();shd=tcPr.find(qn("w:shd")) or OxmlElement("w:shd");shd.set(qn("w:fill"),fill);tcPr.append(shd) if shd.getparent() is None else None
def set_cell_width(cell,dxa):
 tcPr=cell._tc.get_or_add_tcPr();tcW=tcPr.find(qn("w:tcW")) or OxmlElement("w:tcW");tcW.set(qn("w:w"),str(dxa));tcW.set(qn("w:type"),"dxa");tcPr.append(tcW) if tcW.getparent() is None else None
def set_table_geometry(table,widths):
 tblPr=table._tbl.tblPr;tblW=tblPr.find(qn("w:tblW"));tblW.set(qn("w:w"),str(sum(widths)));tblW.set(qn("w:type"),"dxa");ind=OxmlElement("w:tblInd");ind.set(qn("w:w"),"120");ind.set(qn("w:type"),"dxa");tblPr.append(ind);grid=table._tbl.tblGrid
 for old in list(grid):grid.remove(old)
 for w in widths:g=OxmlElement("w:gridCol");g.set(qn("w:w"),str(w));grid.append(g)
 for row in table.rows:
  for cell,w in zip(row.cells,widths):set_cell_width(cell,w);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
def add_page_field(p):
 p.alignment=WD_ALIGN_PARAGRAPH.RIGHT;r=p.add_run();fld=OxmlElement("w:fldSimple");fld.set(qn("w:instr"),"PAGE");r._r.addnext(fld)
def add_table(doc,headers,data,widths):
 t=doc.add_table(rows=1,cols=len(headers));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False;t.style="Table Grid";set_table_geometry(t,widths)
 for i,h in enumerate(headers):t.rows[0].cells[i].text=h;set_cell_shading(t.rows[0].cells[i],"E8EEF5")
 for row in data:
  cells=t.add_row().cells
  for i,v in enumerate(row):cells[i].text=str(v)
 set_table_geometry(t,widths)
 for row in t.rows:
  for cell in row.cells:
   for p in cell.paragraphs:
    p.paragraph_format.space_after=Pt(2)
    for run in p.runs:run.font.name="Malgun Gothic";run._element.rPr.rFonts.set(qn("w:eastAsia"),"맑은 고딕");run.font.size=Pt(8.5)
 return t

doc=Document();sec=doc.sections[0];sec.page_width=Inches(8.5);sec.page_height=Inches(11);sec.top_margin=sec.bottom_margin=sec.left_margin=sec.right_margin=Inches(1);sec.header_distance=sec.footer_distance=Inches(.492)
styles=doc.styles
for name,size,before,after,color in [("Normal",10.5,0,8,"222222"),("Title",22,0,12,"0B2545"),("Heading 1",16,18,10,"2E74B5"),("Heading 2",13,12,6,"2E74B5"),("Heading 3",12,8,4,"1F4D78")]:
 s=styles[name];s.font.name="Malgun Gothic";s._element.rPr.rFonts.set(qn("w:eastAsia"),"맑은 고딕");s.font.size=Pt(size);s.font.color.rgb=RGBColor.from_string(color);s.paragraph_format.space_before=Pt(before);s.paragraph_format.space_after=Pt(after);s.paragraph_format.line_spacing=1.25 if name=="Normal" else 1.1
header=sec.header.paragraphs[0];header.text="AI 기반 탐색적 근거지도 연구";header.alignment=WD_ALIGN_PARAGRAPH.RIGHT
for r in header.runs:r.font.name="Malgun Gothic";r.font.size=Pt(8);r.font.color.rgb=RGBColor(100,110,120)
add_page_field(sec.footer.paragraphs[0])
p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_before=Pt(110);r=p.add_run("학위논문");r.bold=True;r.font.size=Pt(14);r.font.name="Malgun Gothic"
p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_before=Pt(35);r=p.add_run(title);r.bold=True;r.font.size=Pt(21);r.font.color.rgb=RGBColor.from_string("0B2545");r.font.name="Malgun Gothic"
p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_before=Pt(18);r=p.add_run(eng);r.font.size=Pt(11);r.italic=True;r.font.name="Arial"
p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_before=Pt(90);r=p.add_run("여형준");r.bold=True;r.font.size=Pt(14);r.font.name="Malgun Gothic"
p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_before=Pt(18);p.add_run("2026년 7월")
doc.add_page_break();doc.add_heading("국문초록",level=1);doc.add_paragraph(abstract);doc.add_paragraph("주요어: 영양보충제, 탐색적 근거지도, 항응고제, 칼슘옥살레이트 결석, 결정론적 엔진, 출처 계보")
doc.add_page_break();doc.add_heading("목차",level=1)
for heading,_ in sections:doc.add_paragraph(heading,style="Heading 2")
doc.add_paragraph("참고자료");doc.add_paragraph("부록 A. 재현성 및 파일 계보")
doc.add_page_break()
for heading,paras in sections:
 doc.add_heading(heading,level=1)
 for paragraph in paras:doc.add_paragraph(paragraph)
 if heading=="2. 연구 방법":
  add_table(doc,["질문","탐색 범위"],[[q,question_names[q]] for q in question_names],[1200,8160])
 if heading=="3. 연구 결과":
  data=[]
  for c in claims:data.append([c["question_id"],f"{c['record_question_units']:,}",f"{c['abstract_observed']:,}",f"{c['classification_counts'].get('ai_agreement_retain',0):,}",f"{c['classification_counts'].get('ai_agreement_deprioritize',0):,}",f"{c['classification_counts'].get('ai_disagreement_uncertain',0):,}",f"{c['classification_counts'].get('ai_unranked_source_candidate',0):,}"])
  add_table(doc,["질문","전체","초록","유지 합의","후순위 합의","불일치·불확실","비순위"],data,[900,1100,1100,1500,1500,1800,1460])
  doc.add_paragraph("표 1. 질문별 탐색지도 분포. 모든 수치는 record-question unit이며 포함 연구 수가 아니다.",style="Caption")
  add_table(doc,["지표","결과"],[["합성 fixture",perf["scenario_count"]],["반복 실행",perf["executions"]],["결정성",f"{perf['deterministic_scenarios']}/{perf['scenario_count']}"],["정확 routing",f"{perf['correct_exact_route_scenarios']}/{perf['scenario_count']}"],["계보 완전성",f"{perf['provenance_complete_scenarios']}/{perf['scenario_count']}"],["임상행동 누출",perf["clinical_action_leakage_scenarios"]],["legacy 누출",perf["legacy_leakage_scenarios"]],["near-match 오경로",perf["negative_false_routes"]]],[3000,6360])
  doc.add_paragraph("표 2. 합성 기술 시나리오 결과. 독립 gold 또는 임상 성능지표가 아니다.",style="Caption")
doc.add_page_break();doc.add_heading("참고자료",level=1)
refs=["National Library of Medicine. PubMed 데이터와 E-utilities를 통해 확보한 검색·서지 원자료. 접근일 2026-07-10.","U.S. National Library of Medicine. ClinicalTrials.gov 공개 연구등록자료. 접근일 2026-07-10.","KoreaMed. 국내 의학문헌 검색 결과 표시자료. 접근일 2026-07-10. Native export 서버 오류를 제한점으로 기록함.","National Center for Biotechnology Information. PubMed Central ID 및 공개 원문 locator 자료. 접근일 2026-07-10.","연구 프로토콜 v2.0. AI 기반 탐색적 문헌지도와 결정론적 도구 검증. 2026-07-12."]
for ref in refs:doc.add_paragraph(ref,style="List Number")
doc.add_heading("부록 A. 재현성 및 파일 계보",level=1)
lineage=[["프로토콜",PROTOCOL.relative_to(ROOT).as_posix(),sha(PROTOCOL)],["근거지도 manifest",MAP_MAN.relative_to(ROOT).as_posix(),sha(MAP_MAN)],["PubMed 분류 manifest",SCREEN_MAN.relative_to(ROOT).as_posix(),sha(SCREEN_MAN)],["비-PubMed manifest",NONPUB_MAN.relative_to(ROOT).as_posix(),sha(NONPUB_MAN)],["기술 검증",PERF.relative_to(ROOT).as_posix(),sha(PERF)],["탐색 bundle",BUNDLE.relative_to(ROOT).as_posix(),sha(BUNDLE)]]
add_table(doc,["항목","경로","SHA-256"],lineage,[1500,4200,3660])
doc.add_paragraph("본 부록의 해시는 빌드 시점 파일을 가리킨다. 최종 manifest는 DOCX/PDF와 함께 별도로 생성한다.")
doc.save(DOCX)

md=[f"# {title}","",f"**영문 제목:** {eng}","","**저자:** 여형준  ","**작성일:** 2026년 7월","","## 국문초록","",abstract,"","**주요어:** 영양보충제, 탐색적 근거지도, 항응고제, 칼슘옥살레이트 결석, 결정론적 엔진, 출처 계보",""]
for h,paras in sections:
 md += [f"## {h}",""]+[p+"\n" for p in paras]
MD.write_text("\n".join(md),encoding="utf-8")
print(json.dumps({"docx":str(DOCX.relative_to(ROOT)),"markdown":str(MD.relative_to(ROOT)),"rows":mapm["row_count"],"scenarios":perf["scenario_count"]},ensure_ascii=False))
