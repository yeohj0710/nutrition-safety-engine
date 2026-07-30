권혁찬 졸업연구(OTC) 논문 서술 조정 작업이다. **새 데이터를 만들거나 파이프라인을 다시
돌리는 작업이 아니다.** 이미 나온 산출물에 맞게 기여 서술과 한계를 고치는 일이다.

## 먼저 읽어라
1. `C:\Users\hjyeo\.claude\projects\C--\memory\MEMORY.md` 와 그 안의
   `otc-site-v50-literature-gap.md`, `otc-v50-repo2-open-items.md`,
   `kwon-hyeokchan-otc-thesis.md`, `two-thesis-version-map.md`
2. `C:\dev\otc-nutrient-safety-engine\AGENTS.md`
3. `research_v3/otc/literature/v5/downstream/literature_link_manifest.json`
4. `research_v3/logs/v50_FINAL.md`

## 지금 상태 (2026-07-30 확인)
- repo2 = `C:\dev\otc-nutrient-safety-engine`, 브랜치 `main`, 트리 clean, 푸시 완료.
- 파이프라인은 전부 `complete`. 채점 arm 도 완료(894행, 비 0.66배).
- 사이트에 v5.0 검증 배지를 붙였다(커밋 `b1640c7`). 검증 10편 · v5.0 검색기간 밖 8편 ·
  코퍼스에 있으나 retain 아님 1편.

## 확정된 사실 — 이것을 전제로 쓴다
규칙–문헌 연결은 **10건**이고 규칙 **16개 중 9개**만 덮는다. 미해결 7개는
`OTC-RULE-003`(max_daily_dose), `009`(gi_bleeding_ulcer), `010`(sedation_driving),
`011`(alcohol), `013`(sedative_medication), `015`(maximum_duration),
`016`(urgent_referral) 이다.

**원인은 선별 실패가 아니라 검색 기간이다.** v5.0 검색은 2022-01-01부터인데 이 규칙들의
근거 문헌은 2010~2021년이다(예: gi_bleeding_ulcer 2010, maximum_duration 2011·2012,
sedative_medication 2013, duplicate_ingredient 2015, sedation_driving 2016,
max_daily_dose 2018, alcohol 2021). 즉 **규칙 근거의 절반 가까이가 구조적으로 검증 범위
밖에 있었다.** 이 진단을 결과로 보고한다.

## 할 일

### 작업 1. 기여 서술을 산출물 크기에 맞춘다
v5.0 프로토콜 §1이 "이 연구의 기여는 허가원문 해석기가 아니라 **AI 문헌 근거층**이다"라고
적었는데, 그 근거층이 규칙 절반을 못 덮으므로 **주장이 산출물보다 크다.**

아래 방향으로 조정해라.
- 기여를 **"허가원문 기반 결정론적 규칙 엔진과, 그 규칙에 AI 선별 문헌 근거를 연결하는
  작업의 실현 가능성 및 한계 보고"** 로 바꾼다.
- 그러면 연결 10건과 미해결 7개가 실패가 아니라 **결과**가 된다.
- 규칙 엔진(허가원문 계층)이 이 연구의 산출물이고 문헌층은 그 위의 설명 계층이라는
  기존 구조(`evidence_authority: literature_explanatory_only`,
  `supports_rule_release: false`)와도 일관된다.

프로토콜 문서를 직접 고칠지, 논문 본문에서만 조정할지는 원장 기록 여부를 확인하고 정해라.
**해시가 기록된 생성물은 손편집하지 마라**(§함정).

### 작업 2. 미해결 규칙 7개를 한계에 명시한다
`research_v3/logs/v50_FINAL.md` 에는 "규칙–문헌 연결 10개"만 있고 **미해결 7개가 없다.**
manifest 에는 `unresolved_rule_ids` 와 `unresolved_reason:
no_candidate_passed_v5_validation` 이 기록돼 있으므로 숨긴 것은 아니지만, 논문에 옮길 때
빠질 위험이 크다. 아래 두 문장을 한계 절에 넣어라.
- 규칙 16개 중 9개에만 문헌 근거를 연결했고 7개는 연결하지 못했다. 연결은 10건이다.
- 미연결 사유는 근거 문헌이 v5.0 검색 기간(2022-01-01~) 이전에 출판되어 코퍼스에
  포함되지 않았기 때문이며, 선별 판정의 실패가 아니다.

**중복복용이 주제인데 `max_daily_dose` 규칙에 검증 근거가 0건**이라는 점은 따로 한 줄로
적어라. 심사에서 가장 먼저 나올 질문이다.

### 작업 3. 채점 arm 소견을 한계에 반영한다
- 파이프라인 전수 retain 18.23%(7,875/43,207) 대 채점자 설계기반 추정 11.95%, 비 **0.66배**.
  방향은 **파이프라인이 더 많이 남기는 쪽**이다. "오차"라고 쓰지 마라.
- 불일치 방향도 `retain→deprioritize` 가 지배적이다(raw 155 대 20).
- 여형준 연구는 같은 두 층 구조에서 **반대 방향(2.18배, 덜 남김)** 이 나왔으므로,
  **두 결과를 하나의 설계 수준 결론으로 합치지 마라.** 각 연구의 한계로만 적는다.

### 작업 4. 사이트 배지를 논문에 연결한다
판정 카드의 문헌 목록에 v5.0 검증 여부 배지가 붙었다는 사실과, 그 근거가 되는 세 값
(검증 10 · 검색기간 밖 8 · retain 아님 1)을 방법 또는 결과에 적어라. 화면과 논문이 같은
숫자를 말해야 한다.

## 하지 말 것
- **배포 금지.** `AGENTS.md` 가 "Do not deploy from this workflow" 와 "Do not deploy." 를
  두 곳에 명시하고 `release_ready: false` 다. 검증까지만 하고 배포하지 마라.
- **범위 재설정 금지.** 검색을 다시 돌려 2010년대 문헌을 넣는 것은 파이프라인을 다시
  하는 일이고 원장이 봉인돼 있다. 검색 기간이 만든 공백을 **결과로 보고**하는 것이 옳다.
- **여형준 연구 수치와 섞지 마라.** 두 저장소에 `v40_run_report.json` 이 각각 있다
  (여형준=최종 원장, 권혁찬=폐기 트랙). 자세한 것은 `docs/version_map.md`.

## 함정 (전부 실제로 밟았다)
- `v50_FINAL.md` 같은 생성물을 손으로 고치지 마라. `finalize_v50_logs.py` 가 만들고
  해시가 `v50_protected_final_audit.json` 과 `v50_run_report.json` 두 곳에 기록된다.
  생성기를 고치고 체인을 다시 돌려야 한다.
- `AGENTS.md` 는 `tools/build_v40_reporting.py` 가 생성한다. 문서만 고치면 되돌아간다.
- UTF-8 소스를 PowerShell 로 편집하지 마라(한글 깨짐). Edit/Write 만 써라. 한글을
  `python -c` 로 넘기지 마라. 콘솔이 CP949 라 출력도 깨진다 — UTF-8 파일로 쓰고 Read 로 읽어라.
- 새 산출물을 커밋하기 전에 `.gitattributes` 에 `-text` 로 등록하고 blob 과 디스크 바이트가
  같은지 검증해라(autocrlf=true).

## 완료 보고에 넣을 것
고친 파일 목록, 기여 서술의 변경 전후 문장, 한계 절에 추가한 문장, 커밋하지 않은 것.
**하지 않은 것을 했다고 쓰지 마라.**
