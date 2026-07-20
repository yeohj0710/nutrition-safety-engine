# 재현성 진단 및 복구 기록 — 2026-07-20

대상: protocol v2 AI exploratory evidence map 및 원자료 추적 체인
계기: `npm run validate:ai-exploratory-map` 이 `FileNotFoundError` 로 중단되고,
`data/curated_v2/evidence_map.csv` 의 실제 SHA-256 이 매니페스트 기록값과 불일치.

**결론: 데이터 손실 없음. 원자료 추적성 주장은 무효화되지 않았음.**
불일치는 전부 git 개행 변환 아티팩트였고, 누락 XML 103개는 전량 바이트 단위로 복구됨.
PubMed 재검색은 수행하지 않았고, 필요하지도 않았음.

---

## 1. 근본 원인 — `core.autocrlf=true` 와 CSV 필드 내부 개행

빌드 스크립트 `tools/build_ai_exploratory_evidence_map.py` 는
`encoding="utf-8-sig", newline=""` 로 파일을 쓴다. Python `csv` 의 기본
`lineterminator` 가 `\r\n` 이므로 산출물의 형태는 다음과 같다.

- 행 구분자: **CRLF** (20,231개 = 헤더 1 + 데이터 20,230)
- 초록(abstract) 필드 내부 개행: **LF** (23,422개)

이 저장소에는 `core.autocrlf=true` 가 시스템 수준
(`C:/Program Files/Git/etc/gitconfig`) 으로 적용되어 있었고, `.gitattributes` 에
`data/curated_v2/*.csv` 규칙이 없었다. 그 결과:

| 단계 | 변환 | 결과 |
|---|---|---|
| 커밋 | CRLF → LF | blob = 42,167,722 byte (`7ffaec5b…`) |
| 체크아웃 | **모든** LF → CRLF | 워킹트리 = 42,211,375 byte (`64008113…`) |
| 원본(빌드 산출물) | — | 42,187,953 byte (`7fbd8cab…`) ← 매니페스트 기록값 |

체크아웃 변환이 행 구분자뿐 아니라 **인용부호 안의 개행 23,422개까지** CRLF 로
바꾼 것이 핵심이다. 이 때문에 단순 개행/BOM 전체 치환(LF·CRLF × BOM·noBOM 4종)으로는
원본이 재현되지 않았다. 일단 전부 CRLF 가 되고 나면 "행 구분자였던 개행"과
"필드 내부 개행"을 바이트만으로 구분할 수 없기 때문이다.

**CSV 구조를 파싱해 재직렬화**하자 `7fbd8cab…` 가 정확히 재현되었다.
개행 회계도 일치한다: 23,422 + 20,231 = 43,653 = blob 의 총 LF 수.

`evidence_map.csv` 는 커밋 `707496fb` (2026-07-12) 이후 **한 번도 수정된 적이 없다.**
엑셀 재저장·수동 편집은 없었다.

## 2. 원자료 XML 누락 — 설계상 로컬 전용, 외부 사본에서 복구

`.gitignore` 가 `research/searches/*/pubmed/*/efetch_*.xml` 을 의도적으로 제외한다
("large/copyright-sensitive public search payloads stay local; hashes and metadata are tracked").
git 히스토리 전체에 efetch XML 이 커밋된 적은 한 번도 없으므로 **git 을 통한 복구는 불가**하다.

누락 범위는 designpilot 실행 전량이었다 (A1 62, A2 5, B1 7, B2 25, B3 4 = **103개**).
저장소에 남아 있던 103개 XML 은 전부 `*_final_20260713` 소속으로, evidence map 이
참조하는 파일이 아니었다.

복구 원본:

```
C:\Users\hjyeo\Documents\Codex\2026-07-10\g-24-1-gpt-5-6\work\nutrition-safety-engine\
```

저장소에 커밋되어 있던 `checksum.sha256` 기록값과 대조한 결과 **103개 전부 해시 일치**
(불일치 0, 부재 0). 전량 복원했다.

## 3. 수행한 조치

1. **원자료 XML 103개 복원** — 각 파일을 `checksum.sha256` 기록값과 대조해
   일치하는 것만 복사. 불일치 시 복사 거부하도록 스크립트에 가드를 둠.
2. **정본 바이트 복원 (66개)** — 개행 변환만으로 기록 해시가 재현되는 파일 62개는
   CRLF→LF, CSV 4개는 구조 인식 재직렬화로 복원.
   대상: `evidence_map.csv`, `ai_nonpubmed_classifications.csv`,
   `koreamed_records.csv`, `koreamed_review_queue.csv`,
   그리고 `research/searches/**` 의 검색 메타데이터.
3. **`.gitattributes` 에 `-text` 규칙 추가** — 근본 원인 차단.
   이 규칙이 없으면 다른 PC 에서 체크아웃하는 순간 동일 증상이 재발한다.
4. **검증** — 기록 해시가 존재하는 provenance 대상 **391개 전부 일치** 확인.
   `git cat-file blob` 으로 스테이징된 blob 이 워킹트리와 바이트 동일함도 확인.

### 검증 결과

```
tools/validate_ai_exploratory_evidence_map.py  ->  status: valid, errors: []
                                                   raw_sources_verified: 104
tools/validate_ai_exploratory_bundle.py        ->  status: valid
tools/validate_ai_exploratory_screening.py     ->  status: valid
tools/validate_ai_exploratory_thesis.py        ->  status: valid
```

`raw_sources_verified: 104` (XML 103 + 비PubMed CSV 1) 는 원자료 추적 체인이
실제로 동작한다는 뜻이다. 재빌드가 `7fbd8cab…` 를 그대로 재현하므로 결정성도 확인됐다.

커밋되어 있던 `src/generated/ai-exploratory-bundle.json` 이 이미 정본 해시
(`7fbd8cab…`, `17cf0278…`) 를 기록하고 있었다는 점도 확인했다. 즉 **저장소의 기록은
처음부터 정본을 가리키고 있었고, 오염된 것은 체크아웃된 사본뿐이었다.**

## 4. A1 5건 차이 — 버그 아님

동일 질문에 대해 날짜가 다른 검색 실행 2개가 존재한다.

| 실행 | status | A1 |
|---|---|---|
| `pubmed_a1_designpilot_20260710` | `design_pilot_full_export_not_final_search` | 12,229 |
| `pubmed_a1_final_20260713` | `final_public_source_search` | 12,234 |

evidence map 은 designpilot(07-10) 실행으로 구축되었다. 질문별 대조 결과
**모든 질문에서 map 의 PMID 집합 = pilot `ids.txt` 집합과 완전 동일**했다
(map−pilot = 0, pilot−map = 0). pilot 은 final 의 진부분집합이며
**pilot 에서 소실된 PMID 는 0건**이다.

| 질문 | map | pilot(07-10) | final(07-13) | 신규 |
|---|---|---|---|---|
| A1 | 12,229 | 12,229 | 12,234 | +5 |
| A2 | 820 | 820 | 820 | 0 |
| B1 | 1,353 | 1,353 | 1,355 | +2 |
| B2 | 4,879 | 4,879 | 4,882 | +3 |
| B3 | 680 | 680 | 680 | 0 |
| 합계 | 19,961 | 19,961 | 19,971 | +10 |

A1 신규 5건: `42431069`, `42432791`, `42433070`, `42436413`, `42436946`.
3일 사이 PubMed 색인에 추가된 레코드이며, 중복 제거 손실도 정규화 버그도 아니다.

## 5. 남은 과제 (이번에 손대지 않음 — 판단 필요)

### 5.1 evidence map 이 "final" 이 아닌 "designpilot" 실행 위에 있음

전체 20,230 record-question unit 이 `design_pilot_full_export_not_final_search` 로
**명시된** 실행에 기반한다. 더 최신이고 10건 많은 `final_public_source_search` 실행이
별도로 존재한다. 버그는 아니지만 어느 실행을 최종 코퍼스로 삼을지는 논문에서 명시적으로
서술·정당화해야 한다.

### 5.2 `ai_exploratory_final_manifest.json` 의 기록 9건 불일치

23개 아티팩트 중 9개가 불일치하며, 원인은 두 종류로 나뉜다.

**(a) 오염된 바이트로 기록이 만들어진 경우 — 5건.** 기록값이 CRLF 오염 형태와 일치한다.
즉 이 기록들은 오염 이후에 생성된 것이고, 이번 복원이 옳다. 최종 매니페스트를
재생성하면 정상화된다.

- `data/curated_v2/evidence_map.csv`
- `data/curated_v2/ai_nonpubmed_classifications.csv`
- `data/curated_v2/provisional_claims.jsonl`
- `data/curated_v2/exploratory_rules.jsonl`
- `src/generated/ai-exploratory-bundle.json`

**(b) 개행과 무관한 기존 드리프트 — 4건.** 이번 작업과 무관하며 그 이전부터 어긋나 있었다.
논문 가독성 개선 커밋(`37d5a00`) 등에서 산출물이 바뀐 뒤 최종 매니페스트가
재생성되지 않은 것으로 보인다.

- `research/thesis/ai_exploratory_thesis_ko.md`
- `research/thesis/ai_exploratory_thesis.docx`
- `research/thesis/ai_exploratory_thesis.pdf`
- `tools/build_ai_exploratory_thesis.py`

최종 매니페스트를 그냥 재생성하면 (b) 의 기존 드리프트까지 함께 "승인"해 버리므로,
**(b) 가 의도된 변경인지 확인한 뒤에 재생성**해야 한다. 그래서 이번에는 손대지 않았다.

### 5.3 매니페스트 개행이 플랫폼 의존적

`build_ai_exploratory_evidence_map.py` 가 매니페스트를 쓸 때
`MANIFEST.write_text(..., encoding="utf-8")` 를 사용한다. 텍스트 모드이므로 Windows 에서는
`\n` 이 `\r\n` 으로 번역되어, **같은 입력이라도 OS 에 따라 매니페스트 해시가 달라진다.**
현재 저장소는 Windows 산출물(CRLF, `17cf0278…`)로 일관되어 있고 번들 기록과도 맞는다.
`newline="\n"` 을 명시하면 플랫폼 독립이 되지만 기록 해시가 바뀌므로 이번엔 두었다.

## 6. 주의: 검증 스크립트는 읽기 전용이 아님

`tools/validate_ai_exploratory_*.py` 는 내부에서 대응 빌드 스크립트를 실행하여
산출물을 **그 자리에서 덮어쓴다** (`validate_ai_exploratory_evidence_map.py` 는
`evidence_map.csv` 와 매니페스트를 재작성). 진단 목적으로 가볍게 실행하면 안 되며,
실행 전 백업을 권장한다.

## 7. 절대 하지 말 것

매니페스트의 `output_sha256` 을 현재 디스크 파일 해시로 덮어쓰는 것.
그렇게 하면 autocrlf 로 오염된 바이트열이 "원본"으로 승격되어,
초록 필드 내부 개행이 CRLF 로 바뀐 상태가 정본이 된다.
**원자료 추적성 주장이 그 시점에 실제로 무효화된다.**
