# 프로토콜 v4.0 — MECIR 기준 검색 재설계

- 상태: 초안, 2026-07-27 작성
- 선행 트랙: v3.0 (`protocol-v3.0-full-ai.md`) — 동결 보존, 비교용
- 개정 사유: v3.0 검색식이 Cochrane Handbook 4장과 MECIR 검색 표준을 위반함

## 1. 무엇만 바꾸는가

**검색식 설계만 바꾼다.** 나머지는 v3.0 그대로 재사용한다.

| 항목 | v3.0 | v4.0 |
|---|---|---|
| 연구 질문 5개 (HRS1–HRS5) | 확정 | **변경 없음** |
| PICOS 정의 | 확정 | **변경 없음** (질문 정의용으로만 유지) |
| 검색식 구조 | P AND I AND O AND humans[Mesh] | **P AND I** 만 |
| 선별 라벨 | retain / deprioritize / uncertain | 변경 없음 |
| 근거 추출·번역·사이트 | v3.0 파이프라인 | 코드 재사용 |

질문은 이미 지도교수 피드백을 반영해 확정됐다. 이번 개정은 검색식 한 가지만 다룬다.

## 2. v3.0 검색식의 결함

### 2.1 결과(O) 블록을 AND로 걸었다

Cochrane Handbook 4장은 PICO 전 요소를 검색식에 넣는 것을 권하지 않는다. 결과는 제목·초록에
기술되지 않는 경우가 많고 색인도 일관되지 않아, O 블록을 AND로 걸면 적격 연구를 놓친다.
기본 구조는 **P + I (+ 연구설계 필터)** 이다.

v3.0 HRS5 예시에서 아래 블록이 AND로 걸려 있었다.

```
AND ("Drug Interactions"[Mesh] OR "Hemorrhage"[Mesh] OR bleed*[tiab]
     OR thrombo*[tiab] OR INR[tiab] OR interaction*[tiab])
```

### 2.2 `AND humans[Mesh]` 를 썼다

MeSH 색인이 아직 부여되지 않은 레코드(in-process, publisher-supplied, ahead-of-print)는
`humans[Mesh]` 로 걸면 전부 탈락한다. 최신 문헌 손실이 크다.

동물 연구를 줄여야 한다면 표준 형태는 다음과 같다. 기본값은 **필터를 아예 쓰지 않는 것**이다.

```
NOT (animals[mh] NOT humans[mh])
```

### 2.3 용어 확장이 부족했다

질문당 정규화 용어가 12–15개에 그쳤다. 한 개념 블록에 동의어·이형·약어·상품명이 충분히
들어가지 않으면 재현율이 떨어진다.

### 2.4 원인

정의 프롬프트의 다음 줄이 검색식 요건으로 해석됐다.

```
Retrieve human clinical evidence and safety outcomes; do not design efficacy-only questions.
```

이 문장은 **질문 설계** 요건이었으나 AI가 **검색식** 요건으로 반영했다. 여기에
`Keep the combined corpus at or below 10,000 record-question rows` 상한이 겹쳐,
검색식을 좁히는 방향으로 작동했다. 이 인과는 v4.0 결과 보고에 그대로 기록한다.

## 3. v4.0 검색식 설계 규칙 (강제)

1. **블록은 P AND I 둘만.** C 블록 금지. O 블록 금지.
2. **`AND humans[Mesh]` 금지.** 동물 배제가 필요하면 `NOT (animals[mh] NOT humans[mh])` 만 허용.
3. **연구설계 필터 금지.** 증례보고·증례군도 안전성 근거로 적격이므로 설계로 자르지 않는다.
4. **언어 제한 금지. 출판유형 제한 금지.**
5. 날짜 제한은 연구 기간(2022-01-01 ~ 검색 실행일)만 허용.
6. 각 블록은 **MeSH OR 자유어** 병렬 구성. MeSH 단독 금지.
7. 자유어는 `[tiab]` 이상 범위를 쓴다. 필요하면 `[tw]`.
8. **블록당 서로 다른 검색어 25개 이상.** 아래를 모두 포함한다.
   - 일반명, 상품명, 약어, 계열명
   - 미국식·영국식 철자 이형
   - 절단(`*`) 형태
   - 폐용어·구용어
   - 그 계열의 대표 개별 성분·약물명
9. 절단어는 PubMed 변형 상한(600) 경고가 뜨지 않는지 확인하고, 뜨면 더 긴 어간으로 교체한다.
10. 각 질문 검색식마다 다음을 기록한다.
    - 최종 질의문 원문, SHA-256
    - ESearch hit count, 실행 시각(UTC)
    - 블록별 용어 목록과 개수
    - 규칙 1–9 각각에 대한 자기 점검 결과(통과/위반)

## 4. 정밀도에 대한 기대

체계적 문헌고찰 검색의 정밀도는 낮은 것이 정상이다. 관련 없는 레코드가 대량으로 들어오는 것은
설계 실패가 아니라 의도된 결과이며, 걸러내는 일은 검색식이 아니라 선별 단계가 맡는다.
**hit count 가 크다는 이유로 검색식을 좁히지 않는다.**

## 5. 수행 절차

### Phase A — 검색식 작성과 건수 탐침 (인출 없음)

- 질문 5개 각각에 대해 §3 규칙을 만족하는 질의문을 작성한다.
- ESearch 로 hit count 만 받는다. EFetch 를 실행하지 않는다.
- `research/searches_v4/probe_report.json` 에 질문별 건수와 규칙 자기 점검 결과를 쓴다.
- **여기서 멈추지 않고 Phase B 로 진행한다.** 건수가 크다는 이유로 되돌아가 좁히지 않는다.

### Phase B — 인출

- 질문별 전량 인출. 원본 XML 과 `checksum.sha256` 을 `research/searches_v4/<QID>/pubmed/<RUNID>/` 에 보존한다.
- 코퍼스를 `data/curated_v4/evidence_map.csv` 로 정규화한다. 중복 제거는 DOI, 없으면 제목 완전일치.
- `data/curated_v4/corpus_manifest.json` 에 행수·고유 논문수·자료원 분포·관찰가능성 분포를 쓴다.

### Phase C — 선별

- 코퍼스 전량을 판정한다. 라벨은 `retain` / `deprioritize` / `uncertain`.
- 판정 사유 코드와 확신도, 근거 기반(abstract/title_only)을 함께 기록한다.
- 배치 단위로 **append-only 체크포인트**를 남겨 중단 후 재개가 가능해야 한다.
- 서브에이전트를 병렬로 사용한다. 배치는 서로 겹치지 않게 분할하고, 각 배치의 담당·시각·행수를 기록한다.
- 커버리지 100% 가 목표다. 도달하지 못하면 **도달한 척하지 말고** 실제 커버리지를 보고한다.

### Phase D — 하류 산출물

- v3.0 파이프라인 코드를 v4 경로로 재사용해 근거 번들·핵심 근거·개인화 규칙·한국어 번역을 생성한다.
- 사이트 배포는 하지 않는다. 산출물 생성과 검증까지만 한다.

### Phase E — 보고

- `research/logs/v40_run_report.json` 단일 원장에 전부 기록한다.
- v3.0 대비 질문별 hit count 변화표를 포함한다.
- §2.4 의 인과(지시문 한 줄이 검색식을 좁혔다)를 서술로 남긴다.

## 6. 금지 사항

- `data/curated_v2/`, `data/curated_v3/`, `research/searches/`, `research/searches_v3/`,
  `research/validation/screening_gold/`, v2.1·v3.0 로그를 **읽기만 하고 절대 수정·삭제하지 않는다.**
- 사람 gold standard 가 없으므로 `sensitivity`, `specificity`, `accuracy`, `gold_standard`,
  `validated` 를 v4 산출물에 쓰지 않는다. 필요하면 `*_vs_ai_reference` 형태만 쓴다.
- 라벨을 `include` / `exclude` 로 부르지 않는다.
- PRISMA 최종 포함·제외 수, 메타분석, 통합 효과크기, RoB, GRADE, 임상 권고를 만들지 않는다.
- hit count 를 줄이려고 §3 규칙을 완화하지 않는다.
