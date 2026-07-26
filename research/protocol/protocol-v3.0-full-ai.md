# 연구 프로토콜 v3.0 — 전 과정 AI 자율 PubMed 문헌지도

채택일: 2026-07-27

상태: `adopted_full_ai_autonomy`

적용 범위: `data/curated_v3/`와 `research/searches_v3/`에 기록되는 신규 트랙

이전 프로토콜: `research/protocol/protocol-v2.0-ai-exploratory.md` — v2.1 비교 트랙에 계속 적용하며 소급 수정하지 않음

## 1. 연구 정체성과 분리 원칙

본 연구는 고위험 임상상황에서 영양보충제 안전성 문헌을 구조화하는 AI 기반 탐색적 문헌지도다. v3.0 트랙에서는 AI가 연구질문과 PICOS, PubMed 검색식, 문헌 선별, 근거 추출, AI 참조표준 채점, 개인화 산출물 생성을 수행한다. 사람의 문헌 판정과 승인 절차는 0건이다.

v2.1 트랙은 사람이 정의한 질문과 검색식으로 만든 비교 트랙이다. `data/curated_v2/`, `research/searches/`, 기존 체크포인트와 `research/validation/screening_gold/`는 동결하며 v3.0 산출물로 덮어쓰지 않는다.

## 2. 연구질문과 PICOS 정의

AI는 다음 입력만 사용해 3~6개 질문을 독립적으로 정의한다.

- 연구 주제: 고위험 임상상황에서의 영양보충제 안전성
- 자료원: PubMed만 사용
- 산출 형식: 질문별 P·I·C·O·S, 도출 근거, MeSH와 제목·초록 필드 태그를 포함한 검색식

기존 A1~B3 질문, 기존 검색식 초안, 기존 검색 결과 수치는 PICOS 생성 입력으로 사용하지 않는다. 생성 프롬프트 전문, 모델명, 생성 시각, 프롬프트 SHA-256을 보존한다.

## 3. 검색과 코퍼스

PubMed E-utilities를 초당 3회 이하로 호출한다. ESearch로 질문별 hit 수를 먼저 확인하고 총 상한을 넘으면 EFetch 전에 검색식을 좁힌다. 검색 원문, 응답 메타데이터, 원시 XML, 체크섬과 실행 로그는 `research/searches_v3/`에만 저장한다.

정규화 코퍼스는 `data/curated_v3/evidence_map.csv`에 저장한다. 스키마는 v2.1 비교가 가능하도록 `data/curated_v2/evidence_map.csv`와 맞춘다. 모든 수치는 저장된 원시 입력과 해시에서 재생성한다.

## 4. AI 선별

v3.0 코퍼스의 모든 `(record_id, question_id)`를 AI가 선별한다. 라벨은 `retain`, `deprioritize`, `uncertain`만 사용하며 사람의 최종 포함·제외 판정을 뜻하지 않는다.

초록이 없는 행도 선별 대상에 포함한다. 해당 행은 `evidence_basis=title_only`, `confidence=low`, `reason_codes`에 `insufficient_abstract`를 기록한다. 체크포인트는 v3.0 전용 JSONL에 append하며 배치별 입력·출력 해시를 남긴다. 요청 키가 정확히 한 번씩 반환됐는지 확인해 커버리지 1.0이 된 경우에만 `run_complete=true`로 기록한다.

## 5. AI 참조표준

신규 코퍼스에서 P2 판정 층별로 무작위 표본을 추출하고 층 크기, 표본 수, 시드와 가중치를 보존한다. 참조 채점은 P2 분류 결과를 읽지 않는 블라인드 입력으로 수행한다. 분류 프롬프트와 다른 프롬프트로 대상·노출·비교·결과·설계를 각각 판정한 뒤 고정 규칙으로 종합한다.

행 순서를 무작위화하고 3회 독립 판정한다. 다수결을 사용하되 세 판정이 모두 다르면 `unresolved`로 보존하고 지표 계산에서 제외한다. 사람 판정은 0건이다.

## 6. 지표와 명명

AI 참조표준 기반 지표는 진실 대비 임상적 정확도가 아니라 AI 참조표준 재현도를 나타낸다. 분류기와 참조표준이 같은 모델 계열이면 독립성이 부분적이라는 한계를 함께 보고한다. 층화 가중치를 적용하고 Rogan-Gladen 보정과 층화 부트스트랩으로 코퍼스 수준 retain 규모와 95% 신뢰구간을 산출할 수 있다.

다음 이름만 사용한다.

- `sensitivity_vs_ai_reference`
- `specificity_vs_ai_reference`
- `agreement_vs_ai_reference`
- `ai_reference_standard`
- `ai_cross_checked`
- `reference_positive_classifier_positive`

한국어 본문에서는 “AI 참조표준 대비 민감도”처럼 참조표준 출처를 이름에 포함하고 첫 등장 시 AI 생성 참조표준임을 밝힌다. `gold standard`, `validated`, `true positive`처럼 사람 참조표준으로 오해할 이름은 사용하지 않는다.

## 7. 추출과 근거지도

자동 추출은 원자료에서 확인 가능한 서지정보, 초록 문구, 연구설계 표지, 대상·노출·결과 후보와 공개 원문 locator로 제한한다. 모든 근거 항목은 문장 단위 locator를 포함한다.

효과크기, 분모, 사건 수, 단위, 비교군과 시점은 원문 위치와 원자료 해시가 함께 있을 때만 기록한다. 초록만 확인한 항목은 `abstract_only`, 원문에서 관찰하지 못한 값은 `not_observed`, AI 추론은 `ai_inference_unverified`로 표시한다.

## 8. 개인화와 번역

개인화 규칙은 core evidence에서 실제로 관찰한 연령대, 성별, 병용약, 기저질환, 용량 구간 등의 특성만 사용할 수 있다. 관찰하지 않은 특성을 만들지 않는다. 각 축은 근거 행 수와 원자료 계보를 포함한다.

한국어 번역은 AI가 생성할 수 있다. 원문 수치, 단위와 효과 방향을 바꾸지 않으며 매니페스트에 `translation_authorship: "ai_generated"`를 기록한다. 사람이 채울 빈칸이나 승인 대기열을 만들지 않는다.

## 9. 허용 범위와 금지 범위

허용되는 결과는 검색·선별 건수, 자료 접근성, 질문·설계 분포, AI 참조표준 재현도, locator 완전성, 결정론적 재현성, 트랙 간 질문·검색식·PMID·파생 산출물 비교다.

다음은 금지한다.

- PRISMA 최종 포함·제외 수 또는 사람 선별 흐름
- 메타분석과 통합 효과크기
- 사람 RoB·GRADE 또는 임상 검증을 수행했다는 주장
- 임상 권고, 복용 시작·중단, 용량 결정 또는 의뢰 우선순위
- 접근하지 못한 자료원을 근거 부재로 해석하는 행위
- 사람 gold 또는 전문가 합의를 사칭하는 지표 이름

## 10. 소프트웨어와 보고

사이트는 v3.0 트랙을 명시적으로 선택하며 매니페스트에 `llm_gate.applied=true`, `regex_passed`, `dropped_by_llm`, `kept`를 기록한다. v2.1과 `legacy_unverified` 산출물의 경계를 유지한다. 빌드와 테스트는 수행하지만 이 실행에서는 배포하지 않는다.

논문과 보고서는 PICOS와 검색식을 AI가 정의했다는 사실, 프롬프트 해시, 검색 실행 일시, 선별 커버리지, AI 참조표준, 사람 판정 0건, PubMed 단일 자료원, 모델 계열의 부분적 비독립성을 명시한다. 모든 수치는 매니페스트에서 읽고, 채우지 못한 필드는 `null`과 구체적인 미해결 사유로 남긴다.

## 11. 변경과 재현성

프로토콜 변경은 `research/protocol/amendments.csv`에 기록한다. 원시 검색 응답, 체크섬, 프롬프트와 입력 해시, 배치 해시, 시드, 코드 버전과 산출물 매니페스트를 보존한다. 기존 v2.1 자료와 검색 파일은 삭제하거나 수정하지 않는다.
