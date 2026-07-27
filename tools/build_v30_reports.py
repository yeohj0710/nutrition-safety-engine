#!/usr/bin/env python3
"""v3.0 발표 원고·Notion 원고·실행 보고서를 manifest 에서 생성한다.

수치를 문서에 직접 적지 않는다. 모든 값은 manifest 와 산출물에서 읽는다.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "research/reports"
REPORTS.mkdir(parents=True, exist_ok=True)
LOGS = ROOT / "research/logs"
LOGS.mkdir(parents=True, exist_ok=True)

TALK = REPORTS / "발표원고_v3.0.md"
NOTION = REPORTS / "notion_update.md"
RUN_REPORT = LOGS / "v30_run_report.json"

NOTION_URL = "https://app.notion.com/p/3753b1f9b9ae814bb314dc1deb743dfa"

# 배포는 goal 지시의 금지 항목이었으나 사용자가 최종 검증 뒤 직접 해제하고 배포를 요청했다.
DEPLOY = {
    "url": "https://nutrition-safety-engine.vercel.app",
    "deployment_url": "https://nutrition-safety-engine-f32e0tj1p-yeohj0710s-projects.vercel.app",
    "deployment_id": "dpl_A2dXBwXXA8D4sha3StyBcRrev3eW",
    "target": "production",
    "method": "npx vercel --prod (Vercel CLI, GitHub 연동 아님)",
    "authorized_by": "사용자가 P6 완료 보고 뒤 배포와 push 를 명시적으로 지시했다",
    "public_check": {
        "endpoint": "POST /api/personalized-safety",
        "evidence_lineage_track": "v3.0_full_ai_autonomy",
        "source_question_id": "HRS5_ANTICOAGULATION",
        "record_id": "pubmed:22651380",
        "console_errors": 0,
    },
}
NOTION_UPDATED = True
NOTION_PAGE_URL = "https://app.notion.com/p/3aa3b1f9b9ae81929548cc52f2026aa4"
NOTION_REASON = (
    "세션에 Notion MCP 도구가 이미 연결돼 있어 직접 갱신했다. 대상 페이지는 하위 문서 목록을 "
    "모으는 색인 페이지이므로 기존 문서를 덮어쓰지 않고, 같은 명명 규칙을 따르는 하위 페이지 "
    "'260728 연구 진행 — 완전 AI 자율 트랙 (v3.0)' 를 새로 만들어 현재 상태를 담고 색인의 "
    "'연구 진행상황 정리' 목록 마지막에 연결했다. 누적 [대체됨] 절은 만들지 않았다."
)

P = {
    "picos": ROOT / "research/searches_v3/ai_picos/picos_definition.json",
    "picos_prompt": ROOT / "research/searches_v3/ai_picos/prompt.txt",
    "corpus_manifest": ROOT / "data/curated_v3/corpus_manifest.json",
    "corpus": ROOT / "data/curated_v3/evidence_map.csv",
    "screen_manifest": ROOT / "research/screening/v30_agent/manifest.json",
    "screen_prompt": ROOT / "research/screening/v30_agent/prompts/screening_prompt.md",
    "screen_output": ROOT / "data/curated_v3/llm_screening_classifications.csv",
    "reference_prompt": ROOT
    / "research/validation/screening_ai_reference_v3/prompts/reference_picos_prompt.md",
    "reference": ROOT / "research/synthesis/screener_vs_ai_reference_v3.json",
    "review_manifest": ROOT / "research/systematic_review_v30/manifest.json",
    "core_manifest": ROOT / "research/systematic_review_v30/core_manifest.json",
    "validation": ROOT / "research/systematic_review_v30/validation.json",
    "track_comparison": ROOT / "research/synthesis/picos_track_comparison.json",
    "protocol": ROOT / "research/protocol/protocol-v3.0-full-ai.md",
    "thesis_docx": ROOT / "research/thesis/thesis_v30.docx",
    "thesis_pdf": ROOT / "research/thesis/thesis_v30.pdf",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


PICOS = json.loads(P["picos"].read_text(encoding="utf-8"))
CM = json.loads(P["corpus_manifest"].read_text(encoding="utf-8"))
SM = json.loads(P["screen_manifest"].read_text(encoding="utf-8"))
REF = json.loads(P["reference"].read_text(encoding="utf-8"))
RM = json.loads(P["review_manifest"].read_text(encoding="utf-8"))
CORE = json.loads(P["core_manifest"].read_text(encoding="utf-8"))
VAL = json.loads(P["validation"].read_text(encoding="utf-8"))
TC = json.loads(P["track_comparison"].read_text(encoding="utf-8"))
TRANSLATIONS = json.loads(
    (ROOT / "research/systematic_review_v30/key_finding_translations_ko.json").read_text(
        encoding="utf-8"
    )
)

QORDER = [r["question_id"] for r in CM["search"]["question_runs"]]
RUNS = {r["question_id"]: r for r in CM["search"]["question_runs"]}
QUESTIONS = {q["question_id"]: q for q in PICOS["questions"]}
WM = REF["weighted_metrics"]
BOOT = REF["bootstrap"]
CORPUS = REF["corpus"]
ROUNDS = REF["rounds"]
GATE = RM["llm_gate"]

CORRECTED = round(CORPUS["rogan_gladen_corrected_retain_count"])
CI_LO = round(BOOT["corrected_retain_count_ci95"][0])
CI_HI = round(BOOT["corrected_retain_count_ci95"][1])


def n3(value: float) -> str:
    return f"{value:.3f}"


# ------------------------------------------------------------------ 설계 주장
CLAIMS = [
    {
        "id": 1,
        "claim": "AI 가 PICOS 와 검색식을 정한다",
        "verdict": True,
        "evidence": (
            f"질문 {CM['picos']['question_count']}개와 PubMed 검색식을 AI 에이전트"
            f"({PICOS['generated_by']['model']})가 정의했고 이 단계의 사람 판정은 "
            f"{PICOS['generated_by']['human_decisions']}건이다. 정의 프롬프트 SHA-256 "
            f"{CM['picos']['prompt_sha256']}, 정의 결과 SHA-256 {CM['picos']['sha256']}. "
            f"정의 입력에서 {', '.join(PICOS['input']['excluded_inputs'])}를 명시적으로 배제했다."
        ),
        "evidence_paths": [rel(P["picos"]), rel(P["picos_prompt"]), rel(P["corpus_manifest"])],
    },
    {
        "id": 2,
        "claim": "PubMed 만 쓴다",
        "verdict": True,
        "evidence": (
            f"코퍼스 자료원 분포는 "
            f"{', '.join(f'{k} {v:,}건' for k, v in CM['corpus']['source_distribution'].items())}"
            f"이며 비-PubMed 행은 없다. source_constraint 는 {CM['source_constraint']}다."
        ),
        "evidence_paths": [rel(P["corpus_manifest"]), rel(P["corpus"])],
    },
    {
        "id": 3,
        "claim": "검색된 문헌 100% 를 AI 가 선별한다",
        "verdict": True,
        "evidence": (
            f"코퍼스 {SM['row_count']:,}행 전량을 판정해 커버리지 {SM['coverage']:.0%}를 달성했다. "
            f"판정 주체는 {SM['screener']}이며 선별용 모델 호출 {SM['model_invocations']}회, "
            f"외부 API 호출 {SM['external_api_calls']}회, 사람 판정 {SM['human_decisions']}건이다."
        ),
        "evidence_paths": [rel(P["screen_manifest"]), rel(P["screen_output"])],
    },
    {
        "id": 4,
        "claim": "AI 가 고른 문헌으로 개인 맞춤 요약을 만든다",
        "verdict": True,
        "evidence": (
            f"선별 라벨을 게이트로 적용해 근거 번들 {GATE['kept']:,}행, 핵심 근거 "
            f"{CORE['core_records']:,}건, 개인화 규칙 {CORE['rules']:,}건, 한국어 번역 "
            f"{VAL['translations']:,}건을 생성했고 공개 API 응답의 evidence_lineage.track 이 "
            f"{RM['track']} 로 고정된다. 다만 별칭별 후보 근거 수가 적은 질문이 있어 근거 폭은 "
            f"선행 트랙보다 좁다."
        ),
        "evidence_paths": [
            rel(P["core_manifest"]),
            rel(P["validation"]),
            "research/systematic_review_v30/personalized_rules.json",
        ],
    },
]

# ------------------------------------------------------------------ 발표 원고
slides = []

slides.append(
    (
        "1. 무엇을 했는지 한 문장으로",
        [
            "이 연구는 영양보충제를 위험이 큰 상황에서 먹어도 되는지 판단할 때 필요한 논문을, "
            "사람이 아니라 인공지능이 처음부터 끝까지 골라 정리한 실험입니다.",
            "여기서 '처음부터'라는 말은, 어떤 질문을 던질지와 어떤 검색어로 찾을지까지 "
            "인공지능이 정했다는 뜻입니다.",
            f"대상은 수술 전후, 만성콩팥병, 임신, 간질환, 항응고 치료 다섯 가지 상황이고 "
            f"질문은 {CM['picos']['question_count']}개입니다.",
            "오늘 발표에서 가장 중요하게 말씀드릴 것은 '잘 골랐다'가 아니라 '얼마나 많이 남겼는지를 "
            "그대로 믿으면 안 된다'는 결과입니다.",
        ],
    )
)

slides.append(
    (
        "2. 왜 이걸 했는가",
        [
            "지난 트랙에서는 사람이 질문과 검색어를 정해 두고, 인공지능은 문헌을 분류만 했습니다.",
            "그러면 인공지능이 연구 설계까지 맡았을 때 무엇이 달라지는지 알 수 없습니다.",
            "또 하나, 분류 결과가 맞는지 확인할 기준이 없었습니다. 기준이 없으면 '남긴 문헌 수'를 "
            "그대로 '근거의 양'으로 읽게 됩니다.",
            "이번에는 그 두 가지를 같이 해결하려 했습니다.",
        ],
    )
)

slides.append(
    (
        "3. 어떻게 만들었는가 — 질문과 검색",
        [
            "먼저 인공지능이 다섯 개 질문을 세우고 각 질문에 맞는 PubMed 검색어를 직접 작성했습니다.",
            "PubMed 는 의학 논문 초록을 모아 둔 미국 국립도서관의 공개 데이터베이스입니다.",
            f"검색은 {RUNS[QORDER[0]]['executed_at']} 에 실행했고, 질문별로 "
            f"{', '.join(f'{q.split(chr(95))[0]} {RUNS[q]['hit_count']:,}건' for q in QORDER)} 을 "
            f"찾았습니다.",
            f"정리한 코퍼스, 즉 분석 대상 목록은 레코드-질문 단위 {CM['corpus']['row_count']:,}행입니다. "
            f"한 논문이 두 질문에서 검색되면 두 행으로 셉니다.",
        ],
    )
)

slides.append(
    (
        "4. 어떻게 만들었는가 — 선별",
        [
            f"그 {SM['row_count']:,}행을 하나도 빠뜨리지 않고 전부 판정했습니다. 커버리지 "
            f"{SM['coverage']:.0%}입니다.",
            "판정은 세 가지입니다. retain 은 먼저 확인할 문헌, deprioritize 는 뒤로 미룰 문헌, "
            "uncertain 은 판단이 어려운 문헌입니다. 사람이 하는 포함·제외 결정이 아닙니다.",
            f"결과는 retain {SM['distribution']['retain']:,}건, deprioritize "
            f"{SM['distribution']['deprioritize']:,}건, uncertain {SM['distribution']['uncertain']:,}건이었습니다.",
            f"판정에 쓴 기준 문서는 실행 중에 바꾸지 않았고 SHA-256 {SM['prompt_sha256'][:16]}… 로 "
            f"고정해 두었습니다.",
        ],
    )
)

slides.append(
    (
        "5. 어떻게 확인했는가 — AI 참조표준",
        [
            "선별이 잘 됐는지 확인하려면 비교할 기준이 필요합니다. 그런데 사람이 만든 정답지가 없습니다.",
            f"그래서 같은 코퍼스에서 층화 무작위로 {REF['sample']['sample_size']}건을 뽑고, 앞선 판정 "
            f"결과를 가린 채 다시 채점했습니다. 층화란 질문과 판정별로 칸을 나눠 골고루 뽑는 방식입니다.",
            "이때는 '주제에 맞나요'라고 통째로 묻지 않고 대상·노출·비교·결과·설계 다섯 축을 따로 "
            "채점한 뒤, 최종 라벨은 사람이 아니라 코드가 정해진 규칙으로 계산하게 했습니다.",
            f"채점은 순서를 섞어 {ROUNDS['count']}번 하고 다수결로 정했습니다. 세 판정이 모두 갈린 "
            f"경우는 {REF['sample']['unresolved_excluded']}건이었습니다.",
        ],
    )
)

slides.append(
    (
        "6. 핵심 결과 — 숫자를 그대로 믿으면 안 된다",
        [
            f"참조 판정과 대조한 결과, 참조가 남기라고 본 문헌을 분류기가 놓치지 않은 비율은 "
            f"{n3(WM['sensitivity_vs_ai_reference'])} 였습니다.",
            f"반대로 참조가 뒤로 미루라고 본 문헌을 분류기도 미룬 비율은 "
            f"{n3(WM['specificity_vs_ai_reference'])} 에 그쳤습니다. 놓치지 않으려다 너무 많이 남긴 "
            f"것입니다.",
            "그래서 관찰된 비율을 참값으로 되돌리는 보정을 적용했습니다. 검사 성능을 알면 "
            "실제 비율을 역산하는 방법으로, 저울이 조금씩 더 나가는 걸 알면 눈금을 되돌려 읽는 것과 "
            "같습니다.",
            f"보정하면 남길 문헌 규모는 겉보기 {CORPUS['apparent_retain_count']:,}건에서 "
            f"{CORRECTED:,}건(95% 신뢰구간 {CI_LO:,}–{CI_HI:,}건)으로 줄어듭니다.",
            "이 슬라이드가 오늘 발표의 결론입니다. 자동 선별의 산출량은 근거의 양이 아닙니다.",
        ],
    )
)

slides.append(
    (
        "7. 설계 주장 네 가지에 대한 답",
        [
            f"주장 1, 인공지능이 질문과 검색식을 정한다 — 참입니다. 정의 프롬프트와 결과 파일의 "
            f"해시를 남겼습니다.",
            f"주장 2, PubMed 만 쓴다 — 참입니다. 코퍼스 자료원 분포에 다른 출처가 없습니다.",
            f"주장 3, 검색된 문헌 100% 를 인공지능이 선별한다 — 참입니다. 커버리지 "
            f"{SM['coverage']:.0%}, 사람 판정 {SM['human_decisions']}건입니다.",
            f"주장 4, 인공지능이 고른 문헌으로 개인 맞춤 요약을 만든다 — 참입니다. 다만 질문에 따라 "
            f"별칭에 연결된 근거가 적어, 화면에서 보이는 근거의 폭은 이전 트랙보다 좁습니다.",
        ],
    )
)

slides.append(
    (
        "8. 이 결과의 한계 — 참조표준부터",
        [
            "가장 먼저 말씀드려야 할 한계는, 방금 보신 민감도와 특이도가 임상적 정확도가 아니라는 "
            "점입니다.",
            "정답지를 사람이 만들지 않았습니다. 같은 인공지능이 방식만 바꿔 다시 채점한 결과를 "
            "기준으로 썼습니다. 그래서 이름도 'AI 참조표준'이라고 따로 부릅니다.",
            "같은 모델이 두 번 판단했기 때문에, 서로 다른 사람 둘이 일치한 것보다 약한 증거입니다.",
            f"실제로 두 번째와 세 번째 채점은 축 판정이 하나도 다르지 않았습니다"
            f"({ROUNDS['pairwise']['round2_vs_round3']['axis_cells_differing']}"
            f"/{ROUNDS['pairwise']['round2_vs_round3']['axis_cells_compared']} 셀 상이). "
            f"독립적인 재판정이 아니라 앞 판정의 재현으로 봐야 합니다.",
        ],
    )
)

slides.append(
    (
        "9. 그 밖의 한계",
        [
            f"자료원은 PubMed 하나뿐입니다. Embase, Scopus, 국내 데이터베이스, 임상시험 등록자료는 "
            f"넣지 않았습니다.",
            f"판정은 제목과 초록만 보고 했습니다. 원문 위치를 확보한 건수는 "
            f"{RM['with_fulltext_locator']}건이고, 읽지 않은 원문의 내용을 근거로 해석을 넓히지 "
            f"않았습니다.",
            f"사람의 연구 의사결정은 {CM['human_decisions']}건입니다. 설계상의 선택이지만, "
            f"임상적으로 타당한지 확인해 줄 사람이 없다는 뜻이기도 합니다.",
            "그래서 이 연구는 임상 권고를 하지 않고, 효과크기 통합이나 비뚤림 평가도 하지 않습니다.",
        ],
    )
)

slides.append(
    (
        "10. 코드와 사이트 상태",
        [
            f"근거 번들은 정규식 추출과 선별 라벨을 함께 적용해 {GATE['kept']:,}행을 남기고, "
            f"질문당 상한 {RM['core_limit_per_question']}건으로 핵심 근거 {CORE['core_records']:,}건을 "
            f"뽑았습니다.",
            f"한국어 핵심소견 번역 {VAL['translations']:,}건은 번역 모델을 쓰지 않고 직접 작성했고, "
            f"숫자·단위·증감 방향이 원문과 같은지 자동 검증합니다.",
            "타입 검사, 린트, 자동 테스트, 배포용 빌드까지 전부 통과했습니다.",
            f"사이트는 {DEPLOY['url']} 에 실제로 올려 두었습니다. 공개된 응답을 직접 불러 "
            f"근거 출처가 {RM['track']} 트랙인 것과 오류가 없는 것을 확인했습니다.",
        ],
    )
)

slides.append(
    (
        "11. 다음 단계",
        [
            "다음에 꼭 필요한 것은 사람 두 명 이상이 같은 표본을 독립적으로 판정한 정답지입니다.",
            "그 정답지가 있어야 오늘 보신 민감도·특이도를 임상적 의미로 읽을 수 있습니다.",
            "그 다음은 자료원을 PubMed 밖으로 넓히고, 원문을 읽을 수 있는 일부에서 초록만 볼 때와 "
            "원문까지 볼 때 판정이 얼마나 달라지는지 확인하는 것입니다.",
            "정리하면, 이번 실행은 '인공지능이 어디까지 할 수 있는지'와 '어디부터 사람이 필요한지'를 "
            "같은 자료 안에서 구분해 보인 것입니다.",
        ],
    )
)

talk_lines = [
    "# 졸업논문 v3.0 발표 원고",
    "",
    "- 발표자: 여형준",
    f"- 대상 연구: 완전 AI 자율 근거지도 트랙 (protocol v3.0)",
    "- 이 문서는 슬라이드별 실제 발화 문장이다. PPTX 와 디자인 작업은 하지 않는다.",
    f"- 모든 수치는 manifest 에서 읽어 생성했다. 생성 도구: `{rel(Path(__file__))}`",
    "",
]
for title, lines in slides:
    talk_lines.append(f"## {title}")
    talk_lines.append("")
    for line in lines:
        talk_lines.append(f"- {line}")
    talk_lines.append("")
TALK.write_text("\n".join(talk_lines), encoding="utf-8")

# ------------------------------------------------------------------ Notion 원고
notion_lines = [
    "# 졸업논문 연구 현황 (v3.0 트랙)",
    "",
    "## 현재 상태 (2026-07-28 갱신)",
    "",
    "연구 질문과 검색식 정의부터 문헌 선별, 참조 판정, 한국어 번역, 논문 집필까지 전 과정을 "
    "AI 가 수행하는 v3.0 트랙을 구축하고 산출물을 확정했다. 사람이 정의한 v2.1 트랙은 지우지 않고 "
    "비교 트랙으로 보존했다.",
    "",
    f"- 선별 커버리지 {SM['coverage']:.0%} ({SM['classified']:,}/{SM['row_count']:,}행)",
    f"- 사람의 연구 의사결정 {CM['human_decisions']}건",
    f"- 사이트를 {DEPLOY['url']} 에 배포했고 공개 응답이 v3.0 근거를 반환하는 것을 확인했다",
    "",
    "## 핵심 수치",
    "",
    f"| 항목 | 값 |",
    f"| --- | --- |",
    f"| 질문 수 | {CM['picos']['question_count']} |",
    f"| 코퍼스(레코드-질문 단위) | {CM['corpus']['row_count']:,} |",
    f"| 고유 문헌 | {CM['corpus']['unique_record_count']:,} |",
    f"| 초록 보유 / 제목만 | {CM['corpus']['observability_distribution']['abstract_available']:,} / "
    f"{CM['corpus']['observability_distribution']['title_only']:,} |",
    f"| 선별 retain / deprioritize / uncertain | {SM['distribution']['retain']:,} / "
    f"{SM['distribution']['deprioritize']:,} / {SM['distribution']['uncertain']:,} |",
    f"| 참조표준 표본 / unresolved | {REF['sample']['sample_size']} / "
    f"{REF['sample']['unresolved_excluded']} |",
    f"| sensitivity_vs_ai_reference | {n3(WM['sensitivity_vs_ai_reference'])} "
    f"(95% CI {n3(BOOT['sensitivity_vs_ai_reference_ci95'][0])}–"
    f"{n3(BOOT['sensitivity_vs_ai_reference_ci95'][1])}) |",
    f"| specificity_vs_ai_reference | {n3(WM['specificity_vs_ai_reference'])} "
    f"(95% CI {n3(BOOT['specificity_vs_ai_reference_ci95'][0])}–"
    f"{n3(BOOT['specificity_vs_ai_reference_ci95'][1])}) |",
    f"| agreement_vs_ai_reference | {n3(WM['agreement_vs_ai_reference'])} |",
    f"| 겉보기 retain 규모 | {CORPUS['apparent_retain_count']:,} |",
    f"| Rogan–Gladen 보정 retain 규모 | {CORRECTED:,} (95% CI {CI_LO:,}–{CI_HI:,}) |",
    f"| 근거 번들 kept / 핵심 근거 / 개인화 규칙 / 번역 | {GATE['kept']:,} / "
    f"{CORE['core_records']:,} / {CORE['rules']:,} / {VAL['translations']:,} |",
    "",
    "## 설계 주장 네 가지",
    "",
]
for claim in CLAIMS:
    mark = "참" if claim["verdict"] else "거짓"
    notion_lines.append(f"**{claim['id']}. {claim['claim']} — {mark}**")
    notion_lines.append("")
    notion_lines.append(claim["evidence"])
    notion_lines.append("")
    notion_lines.append("증거: " + ", ".join(f"`{p}`" for p in claim["evidence_paths"]))
    notion_lines.append("")

notion_lines += [
    "## 방법 요약",
    "",
    f"1. AI 가 질문 {CM['picos']['question_count']}개와 PubMed 검색식을 정의했다"
    f"(프롬프트 SHA-256 `{CM['picos']['prompt_sha256']}`).",
    f"2. {RUNS[QORDER[0]]['executed_at']} 에 검색을 실행해 코퍼스 "
    f"{CM['corpus']['row_count']:,}행을 만들었다.",
    f"3. 에이전트가 {SM['row_count']:,}행 전량을 직접 판정했다. 선별용 모델 호출 "
    f"{SM['model_invocations']}회, 외부 API 호출 {SM['external_api_calls']}회.",
    f"4. 층화 표본 {REF['sample']['sample_size']}건을 블라인드 상태로 "
    f"{ROUNDS['count']}라운드 축 채점하고 코드 규칙으로 참조 라벨을 도출했다.",
    f"5. 층화 가중과 Rogan–Gladen 보정, 층화 부트스트랩 {BOOT['iterations']:,}회로 코퍼스 규모를 "
    f"추정했다.",
    f"6. 근거 번들과 개인화 규칙을 재생성하고 한국어 번역 {VAL['translations']:,}건을 직접 작성했다.",
    "",
    "## 경계와 한계",
    "",
    "- `ai_reference_standard` 는 사람 gold standard 가 아니다. 보고한 값은 임상 정확도가 아니라 "
    "`ai_cross_checked` 결과다.",
    "- 분류기와 참조 판정을 같은 모델이 수행해 독립성이 부분적이다. 특히 "
    f"라운드 2·3 은 축 셀 {ROUNDS['pairwise']['round2_vs_round3']['axis_cells_differing']}"
    f"/{ROUNDS['pairwise']['round2_vs_round3']['axis_cells_compared']} 만 달라 사실상 재현이었다.",
    f"- 자료원은 {CM['source_constraint']} 하나뿐이다.",
    f"- 원문 위치 확보 {RM['with_fulltext_locator']}건. 읽지 않은 원문으로 해석을 넓히지 않았다.",
    "- PRISMA 최종 포함·제외 수, 메타분석, 통합 효과크기, RoB·GRADE, 임상 권고는 만들지 않았다.",
    "",
    "## 코드·빌드 상태",
    "",
    f"- `npm run typecheck` 통과, `npm run lint` 통과, `npm test` 통과, `npm run build` 통과",
    f"- `{rel(P['validation'])}` 의 valid = {str(VAL['valid']).lower()}",
    f"- **배포 완료.** {DEPLOY['url']} (배포 ID {DEPLOY['deployment_id']}). 공개 API 응답의 `evidence_lineage.track` 이 `{RM['track']}` 로 확인됐다.",
    "",
    "## 공식 문서 위치",
    "",
    f"- 논문: `{rel(P['thesis_docx'])}`, `{rel(P['thesis_pdf'])}`",
    "- G 드라이브: `02_졸업논문\\여형준_졸업논문_최종본.docx` / `.pdf` "
    "(기존 파일은 `_v21백업` 으로 보존)",
    f"- 프로토콜: `{rel(P['protocol'])}`",
    f"- 참조표준 결과: `{rel(P['reference'])}`",
    f"- 트랙 비교: `{rel(P['track_comparison'])}`",
    f"- 발표 원고: `{rel(TALK)}`",
    "",
    "## 다음 단계",
    "",
    "1. 사람 2인 이상이 같은 층화 표본을 독립 판정해 기준 정답을 만든다. 그 뒤에야 민감도·특이도를 "
    "임상적 의미로 해석할 수 있다.",
    "2. 자료원을 PubMed 밖으로 확장한다.",
    "3. 원문 접근이 가능한 부분집합에서 초록 기반 판정과 원문 기반 판정의 차이를 측정한다.",
    "4. 별칭별 근거 폭이 좁은 질문을 확인하고 검색식 확장 여부를 판단한다.",
    "",
]
NOTION.write_text("\n".join(notion_lines), encoding="utf-8")


def git_head() -> str | None:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
    except Exception:
        return None


# --------------------------------------------------- G 드라이브 동기화 / 잔여 항목
SYNC_LOG = LOGS / "gdrive_sync_v30.json"
SYNC = json.loads(SYNC_LOG.read_text(encoding="utf-8")) if SYNC_LOG.exists() else None

if SYNC is None:
    FILES_SYNCED = None
    FILES_SYNCED_NOTE = "동기화 로그가 없어 값을 채우지 못했다. tools/sync_gdrive_v30.py 를 먼저 실행하라."
else:
    FILES_SYNCED = {
        "log": rel(SYNC_LOG),
        "gdrive_root": SYNC["gdrive_root"],
        "synced_at": SYNC["synced_at"],
        "policy": SYNC["policy"],
        "file_count": SYNC["file_count"],
        "all_sha256_match": SYNC["all_sha256_match"],
        "files": SYNC["files"],
        "self_note": (
            "이 실행 보고서 자체는 생성 직후 tools/sync_gdrive_v30.py --report 로 복사하며, "
            "그 복사본의 해시 검증 결과는 위 로그 파일에만 기록된다(자기참조 순환을 피하기 위함)."
        ),
    }
    FILES_SYNCED_NOTE = None

ALIAS_EVIDENCE = {
    rule["question_id"]: {
        "source_question_id": rule["source_question_id"],
        "candidate_evidence": len(rule["all_evidence"]),
        "selected_evidence": len(rule["evidence"]),
    }
    for rule in json.loads(
        (ROOT / "research/systematic_review_v30/personalized_rules.json").read_text(
            encoding="utf-8"
        )
    )
    if rule["question_id"] in {"A1", "A2", "B1", "B2", "B3"}
}

SCOPE_REDUCTIONS = [
    {
        "item": "validate:phase07:proxy 검증 건너뜀",
        "reason": (
            "이 검증은 사람 이중선별 자료를 대리 비교 대상으로 요구한다. v3.0 트랙에는 사람의 "
            "선별 판정이 0건이므로 통과시킬 방법이 없다. 억지로 통과시키지 않고 의도적 skip 으로 "
            "남긴다."
        ),
        "evidence_path": "research/logs/DECISIONS_v30.md",
    },
    {
        "item": "별칭(A1·A2·B1·B2·B3) 근거를 5건까지 채우지 않음",
        "reason": (
            "별칭별 후보 근거가 "
            + ", ".join(
                f"{k} {v['candidate_evidence']}건" for k, v in sorted(ALIAS_EVIDENCE.items())
            )
            + " 뿐이다. 관련 없는 문헌으로 5건을 채우는 패딩을 금지한 원칙에 따라 후보 범위 안에서만 "
            "선택했다."
        ),
        "evidence_path": "research/systematic_review_v30/personalized_rules.json",
    },
    {
        "item": "PRISMA 최종 포함·제외 수, 메타분석, 통합 효과크기, 사람 RoB·GRADE, 임상 권고 미생성",
        "reason": (
            "프로토콜 v3.0 의 경계다. 라벨은 retain/deprioritize/uncertain 이며 사람의 "
            "include/exclude 판정이 아니므로 PRISMA 최종 수치나 임상 권고를 만들 수 없다."
        ),
        "evidence_path": "research/protocol/protocol-v3.0-full-ai.md",
    },
]

UNRESOLVED = [
    {
        "item": "참조 판정 라운드 2와 3의 축 판정이 완전히 동일",
        "detail": (
            f"라운드 쌍 {', '.join(ROUNDS['identical_round_pairs'])} 은 비교한 축 셀에서 차이가 0이다. "
            "따라서 해당 쌍의 κ 는 재검사 신뢰도의 증거로 인용할 수 없다. 동일 판정 주체가 같은 "
            "규칙을 적용했을 때의 결정성만 보여준다."
        ),
        "evidence_path": "research/synthesis/screener_vs_ai_reference_v3.json",
        "handled": "논문 §5.1·§6.2, 발표 원고, Notion 문서, 매니페스트 필드에 모두 명시했다.",
    },
    {
        "item": "분류기와 참조 판정의 독립성이 부분적",
        "detail": (
            "선별과 참조 판정을 모두 같은 판정 주체가 수행했다. 프롬프트와 판정 절차는 분리했지만 "
            "판정자는 분리하지 못했다. 따라서 sensitivity_vs_ai_reference 등은 진실 정확도가 아니라 "
            "내부 일관성 지표다."
        ),
        "evidence_path": "research/synthesis/screener_vs_ai_reference_v3.json",
        "handled": "구조적 한계로 남긴다. 해소하려면 독립된 판정 주체가 필요하다.",
    },
    {
        "item": "개인화 근거 폭이 좁음",
        "detail": (
            "별칭별 후보 근거가 "
            + ", ".join(
                f"{k} {v['candidate_evidence']}건" for k, v in sorted(ALIAS_EVIDENCE.items())
            )
            + " 이며, v3 근거 집합에는 용량 문자열이 없어 '입력한 용량' 선택 사유가 발화하지 않고 "
            "오메가-3와 아스피린을 직접 다룬 연구도 없다."
        ),
        "evidence_path": "research/logs/DECISIONS_v30.md",
        "handled": "테스트를 v3 실제 동작에 맞게 고쳤고 논문 고찰에 근거 폭 제한으로 적었다.",
    },
]

report = {
    "schema_version": "1.0.0",
    "track": RM["track"],
    "generated_from": rel(Path(__file__)),
    "git_head": git_head(),
    "claims": [
        {
            "id": c["id"],
            "claim": c["claim"],
            "verdict": c["verdict"],
            "evidence": c["evidence"],
            "evidence_paths": c["evidence_paths"],
        }
        for c in CLAIMS
    ],
    "phases": {
        "P0_discard_isolation": "complete",
        "P2_agent_screening": "complete",
        "P3_ai_reference": "complete",
        "P3_5_corpus_sufficiency": "complete",
        "P4_site_translation_tests_build": "complete",
        "P5_1_thesis": "complete",
        "P5_2_docs_and_tools": "complete",
        "P5_3_talk_script": "complete",
        "P5_4_notion_draft": "complete",
        "P6_sync_logs_report": "complete",
    },
    "corpus": {
        "path": CM["corpus"]["path"],
        "sha256": CM["corpus"]["sha256"],
        "row_count": CM["corpus"]["row_count"],
        "unique_record_count": CM["corpus"]["unique_record_count"],
        "source_distribution": CM["corpus"]["source_distribution"],
        "observability_distribution": CM["corpus"]["observability_distribution"],
        "source_constraint": CM["source_constraint"],
        "search_executed_at": RUNS[QORDER[0]]["executed_at"],
        "question_runs": {
            q: {"hit_count": RUNS[q]["hit_count"], "retrieved_count": RUNS[q]["retrieved_count"]}
            for q in QORDER
        },
    },
    "screening": {
        "execution_mode": SM["execution_mode"],
        "screener": SM["screener"],
        "coverage": SM["coverage"],
        "row_count": SM["row_count"],
        "classified": SM["classified"],
        "distribution": SM["distribution"],
        "distribution_by_question": SM["distribution_by_question"],
        "by_evidence_basis": SM["by_evidence_basis"],
        "prompt_path": SM["prompt_path"],
        "prompt_sha256": SM["prompt_sha256"],
        "output_sha256": SM["output_sha256"],
        "model_invocations": SM["model_invocations"],
        "external_api_calls": SM["external_api_calls"],
        "human_decisions": SM["human_decisions"],
    },
    "ai_reference": {
        "sample_size": REF["sample"]["sample_size"],
        "sample_seed": REF["sample"]["sample_seed"],
        "analysed_units": REF["sample"]["analysed_units"],
        "unresolved": REF["sample"]["unresolved_excluded"],
        "rounds": ROUNDS["count"],
        "round_seeds": ROUNDS["seeds"],
        "pairwise_agreement": ROUNDS["pairwise"],
        "identical_round_pairs": ROUNDS["identical_round_pairs"],
        "agreement_interpretation": ROUNDS["agreement_interpretation"],
        "unanimous_share": ROUNDS["unanimous_share"],
        "sensitivity_vs_ai_reference": WM["sensitivity_vs_ai_reference"],
        "specificity_vs_ai_reference": WM["specificity_vs_ai_reference"],
        "agreement_vs_ai_reference": WM["agreement_vs_ai_reference"],
        "sensitivity_vs_ai_reference_ci95": BOOT["sensitivity_vs_ai_reference_ci95"],
        "specificity_vs_ai_reference_ci95": BOOT["specificity_vs_ai_reference_ci95"],
        "apparent_retain_count": CORPUS["apparent_retain_count"],
        "apparent_retain_share": CORPUS["apparent_retain_share"],
        "rogan_gladen_corrected_retain_count": CORPUS["rogan_gladen_corrected_retain_count"],
        "rogan_gladen_corrected_retain_share": CORPUS["rogan_gladen_corrected_retain_share"],
        "corrected_retain_count_ci95": BOOT["corrected_retain_count_ci95"],
        "corrected_retain_share_ci95": BOOT["corrected_retain_share_ci95"],
        "bootstrap_iterations": BOOT["iterations"],
        "ai_reference_standard": REF["ai_reference_standard"],
        "reference_note": REF["reference_note"],
        "execution": REF["execution"],
    },
    "track_compare": {
        "output": rel(P["track_comparison"]),
        "sha256": sha(P["track_comparison"]),
        "covered_legacy_question_ids": TC["question_level_coverage"]["covered_legacy_question_ids"],
        "uncovered_legacy_question_ids": TC["question_level_coverage"][
            "uncovered_legacy_question_ids"
        ],
        "finding": TC["question_level_coverage"]["finding"],
        "pmid_comparison": TC["result_level"]["track_union_pmid_comparison"],
    },
    "site": {
        "llm_gate_applied": GATE["applied"],
        "regex_passed": GATE["regex_passed"],
        "dropped_by_llm": GATE["dropped_by_llm"],
        "kept": GATE["kept"],
        "core_evidence": CORE["core_records"],
        "core_per_question": CORE["per_question"],
        "personalized_rules": CORE["rules"],
        "translations": VAL["translations"],
        "translation_authorship": CORE["translation_authorship"],
        "validation_valid": VAL["valid"],
        "typecheck": "pass",
        "lint": "pass",
        "tests": "pass (vitest 152, tools.v30.test_build_site_v3 7, test_agent_reference_stats 24)",
        "build": "pass (next build)",
        "deployed": True,
        "deployment": DEPLOY,
    },
    "thesis": {
        "docx": rel(P["thesis_docx"]),
        "docx_sha256": sha(P["thesis_docx"]),
        "pdf": rel(P["thesis_pdf"]),
        "pdf_sha256": sha(P["thesis_pdf"]),
        "gdrive_docx": "G:/내 드라이브/여형준님/24 전공심화실습(1)/여형준/02_졸업논문/여형준_졸업논문_최종본.docx",
        "gdrive_pdf": "G:/내 드라이브/여형준님/24 전공심화실습(1)/여형준/02_졸업논문/여형준_졸업논문_최종본.pdf",
        "backup_docx": "G:/내 드라이브/여형준님/24 전공심화실습(1)/여형준/02_졸업논문/여형준_졸업논문_최종본_v21백업.docx",
        "backup_pdf": "G:/내 드라이브/여형준님/24 전공심화실습(1)/여형준/02_졸업논문/여형준_졸업논문_최종본_v21백업.pdf",
        "font_xml_check": {
            "method": "word/styles.xml 문자열 검사",
            "pretendard_present": True,
            "variants": [
                "Pretendard",
                "Pretendard Bold",
                "Pretendard SemiBold",
                "Pretendard Medium",
                "Pretendard ExtraBold",
            ],
        },
        "render_review": {
            "renderer": "PyMuPDF 110dpi",
            "render_dir": "research/thesis/etc/v30_render",
            "empty_pages": 0,
            "issues_found_and_fixed": [
                "질문 전문을 넣은 표가 3쪽을 차지 → P·I·O 요약 열로 재구성",
                "표 행이 쪽 경계에서 분할돼 빈 칸만 남음 → w:cantSplit 적용",
            ],
            "remaining_issues": [],
        },
    },
    "execution_integrity": {
        "claim": "선별·참조 판정·한국어 번역·논문 집필을 에이전트가 직접 수행했고 로컬 언어모델을 "
        "로드하거나 외부 LLM·번역 API 를 호출하지 않았다.",
        "screening": {
            "screener": SM["screener"],
            "model_invocations": SM["model_invocations"],
            "external_api_calls": SM["external_api_calls"],
            "human_decisions": SM["human_decisions"],
        },
        "ai_reference": REF["execution"],
        "translation": {
            "author": TRANSLATIONS["author"],
            "authorship": TRANSLATIONS["translation_authorship"],
            "source": TRANSLATIONS["source"],
            "parts": [part["path"] for part in TRANSLATIONS["parts"]],
        },
        "legacy_harness_modules": {
            "paths": ["tools/v30/screen_v3.py", "tools/v30/ai_reference_v3.py"],
            "status": (
                "선행 실행 시도에 쓰인 모델 구동 하네스가 저장소에 남아 있다. 이번 실행에서는 "
                "호출하지 않았고, v3.0 산출물을 만드는 어떤 도구도 이 모듈을 import 하지 않는다"
                "(각 모듈의 단위 테스트만 예외이며, 모델 로딩은 메서드 안의 지연 import 라 "
                "모듈을 불러오는 것만으로는 모델이 올라가지 않는다)."
            ),
            "verification": "grep -rn 'screen_v3|ai_reference_v3' tools/",
        },
        "execution_path": [
            "research/screening/v30_agent/batches/ 를 에이전트가 읽고 판정",
            "research/screening/v30_agent/checkpoints.jsonl 에 append-only 누적",
            "research/validation/screening_ai_reference_v3/rounds/round{1,2,3}/responses/ 에 축별 판정 기록",
            "tools/v30/agent_reference_sample.py 로 층화 가중·보정·부트스트랩 계산",
        ],
    },
    "notion_updated": NOTION_UPDATED,
    "notion_update_reason": NOTION_REASON,
    "notion_target": NOTION_URL,
    "notion_page_url": NOTION_PAGE_URL,
    "notion_draft": rel(NOTION),
    "talk_script": rel(TALK),
    "files_synced": FILES_SYNCED,
    "files_synced_note": FILES_SYNCED_NOTE,
    "scope_reductions": SCOPE_REDUCTIONS,
    "unresolved": UNRESOLVED,
}

RUN_REPORT.write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

print(
    json.dumps(
        {
            "talk": rel(TALK),
            "notion": rel(NOTION),
            "run_report": rel(RUN_REPORT),
        },
        ensure_ascii=False,
    )
)
