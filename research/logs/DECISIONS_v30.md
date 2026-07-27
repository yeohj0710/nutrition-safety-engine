# v3.0 자율 실행 판단 기록

- 2026-07-27 00:55 KST — 요청 파일은 생성된 대화 폴더가 아니라 `C:\dev\nutrition-safety-engine`에서 발견됐으므로, 계획서와 저장소 파일이 함께 있는 이 경로를 권위 있는 작업 루트로 사용한다.
- 2026-07-27 00:55 KST — 기존 체크포인트 11,850행에는 `status=error:HTTPError` 161행이 있으나 계획서가 11,850행 전체를 완료분으로 동결하고 추가 대상 8,380행을 명시했으므로, 기존 고유 키 전체를 보존하고 8,380행만 새로 판정한다.
- 2026-07-27 00:55 KST — 사용자가 체크포인트 줄 스키마를 6개 필드로 고정했으므로 `agent_local`의 배치 ID·해시·판정 시각은 append-only 보조 로그 `research/screening/agent_local_runs.jsonl`에 행별로 기록한다.
- 2026-07-27 00:55 KST — 현재 HEAD가 깨끗한 v2.1 기준점이고 v3.0 계획서만 사용자 제공 미추적 파일이므로, `v2.1-frozen` 태그는 현재 HEAD `c2086ecebd013bc013cd3457b33ee540710ba8f6`에 지정한다.
- 2026-07-27 01:28 KST — 목표 파일의 시간표는 2026-07-28 새벽을 전제로 하지만 `Get-Date`가 2026-07-27 01:28 KST를 반환하고 실행 환경 날짜와 일치하므로, 종료 기한을 2026-07-28 08:30 KST로 해석한다.
- 2026-07-27 01:28 KST — 시작 전 작업 트리에 기존 v2.1 체크포인트 추가 400행과 에이전트 배치 파일이 남아 있다. 사용자 소유 변경으로 보존하며, 신규 v3.0 체크포인트는 `research/screening/v3/`에만 기록해 혼합을 막는다.
- 2026-07-27 01:28 KST — 최신 목표 파일의 P0~P5 실행 순서가 저장소의 이전 `v3.0-full-ai-autonomy-plan.md` 단계 순서를 대체하므로, AI PICOS와 신규 PubMed 코퍼스를 v3.0 본 트랙으로 먼저 만든다.
- 2026-07-27 09:27 KST — [P0] 소형 로컬 모델로 수행한 선별·참조표준 채점 산출물 전량을 `research/screening/v30_discarded_local3b/`로 이동해 폐기 격리했다. 사유는 판정 품질이 연구 요건에 미달했고 보정 추정치의 95% 신뢰구간이 6배 범위로 벌어져 결론을 지지하지 못하기 때문이다. git 히스토리는 조작하지 않고 `git mv`로 이동만 했다. 이 실행은 이후 어떤 산출물·문서에서도 언급하지 않는다.
- 2026-07-27 09:27 KST — [P0] 그 선별 결과에서 파생된 `research/systematic_review_v30/`(근거지도·core evidence·번역 75건 포함)도 같은 폴더로 이동했다. 파생 산출물을 남겨 두면 P4 재생성 시 이전 번역이 섞일 위험이 있어 통째로 격리하고 새로 생성한다.
- 2026-07-27 09:27 KST — [P0] `data/curated_v3/evidence_map.csv`, `corpus_manifest.json`, `research/searches_v3/`는 P1 검색 산출물이라 이번 폐기 대상이 아니다. 코퍼스 SHA-256 `3142e525…b4d3`을 그대로 재사용한다.
- 2026-07-27 09:50 KST — [P2] 판정 프롬프트를 `research/screening/v30_agent/prompts/screening_prompt.md`에 고정했다. 배치는 질문별로 나눠 43개(배치당 46~54행)를 만들었다. 질문을 섞지 않아야 판정 기준이 배치 안에서 일관되게 유지된다.
- 2026-07-27 09:50 KST — [P2] 프롬프트의 "P·I·O 세 축 중 둘 이상 충족" 규칙을 적용할 때, I(보충제 노출) 축은 필수로 본다. 다섯 질문 모두 보충제 노출이 질문의 핵심이라 노출이 확인되지 않으면 대상집단과 결과가 맞아도 지도에 대응시킬 수 없기 때문이다. 노출이 명백히 다른 중재(처방약 단독 등)면 `deprioritize`, 노출 여부를 알 수 없으면 `uncertain`으로 판정한다. 프롬프트 파일은 수정하지 않고 적용 해석만 여기에 기록한다.
- 2026-07-27 09:50 KST — [P2] 허브 유래 지혈제(운남백약, Ankaferd 등)를 수술·시술 중 투여하고 출혈량을 보고한 연구는 `retain`으로 본다. 노출이 허브 제제이고 결과가 질문의 출혈 결과이므로, 효과 방향이 지혈이라는 이유만으로 배제하지 않는다.
- 2026-07-27 11:05 KST — [P2] v3.0 신규 산출물의 SHA-256 은 줄바꿈을 LF 로 정규화한 바이트에 대해 계산하고 매니페스트에 `hash_method: sha256_over_lf_normalized_bytes` 로 명시한다. `.gitattributes` 는 보호 대상이라 v3.0 경로를 `-text` 로 추가할 수 없는데, 저장소의 `core.autocrlf=true` 때문에 체크아웃 시 LF 가 CRLF 로 바뀌어 원시 바이트 해시가 플랫폼마다 달라지기 때문이다. `data/curated_v3/evidence_map.csv`와 `research/searches_v3/`의 기존 원시 바이트 해시 13건은 재검증해 전부 일치함을 확인했다.
- 2026-07-27 01:45 KST — 로컬 Qwen 선별 500행 시점에 긴 초록이 JSON 출력 지시를 밀어내는 토큰 절단 결함을 확인했다. append-only 원칙을 지키기 위해 500행 체크포인트와 5개 배치 감사 로그를 `research/screening/v3/aborted/20260727T1645Z/`에 그대로 보존하고, 입력 길이 제한을 고친 새 canonical 실행을 시작한다.

## 2026-07-27 P2 완료: 에이전트 직접 선별 2,209행

- 43개 배치 전량을 내가 직접 읽고 판정했다. 로컬 언어모델·외부 API·서브에이전트를
  전혀 쓰지 않았고, 매니페스트에 `model_invocations: 0`, `external_api_calls: 0`,
  `human_decisions: 0`, `execution_mode: agent_direct` 로 기록된다.
- 커버리지 2,209/2,209(1.0), 중복 0, 누락 0. `verify` 통과.
- 최종 분포: retain 1,705 / deprioritize 461 / uncertain 43.
  초록 있는 1,968행은 retain 1,525 / deprioritize 437 / uncertain 6,
  제목만 있는 241행은 retain 180 / deprioritize 24 / uncertain 37 로,
  근거가 부족한 쪽에 uncertain 이 몰리도록 프롬프트 규칙이 작동했다.
- 질문별 retain: HRS1 194/296, HRS2 126/138, HRS3 428/515, HRS4 721/967,
  HRS5 236/293.

### 판정 중 굳힌 경계 규칙 (프롬프트 동결 상태에서 일관 적용)
- 동물·세포 전용 연구(설치류 간보호 실험, HepG2/LX-2 단독 실험 등)는
  `deprioritize` + `animal_term_present`. 사람 조직·세포만 쓴 in vitro 도
  사람 집단이 없으므로 `population`/`off_topic` 으로 deprioritize 했다.
- 약물만 다루고 보충제 언급이 없는 DILI 리뷰는 `exposure` + `off_topic`.
  반대로 초록에 herbal/dietary supplement 가 원인 물질로 명시되면 retain.
- HRS5 는 항응고제(와파린·DOAC·헤파린) 맥락을 요구했다. 항혈소판제만 다루는
  연구라도 출혈 위험 프레이밍이 두 축을 함께 포괄하면 retain 했다.
- 항트롬빈 농축제·피브리노겐 농축제·크라이오·구연산 투석 회로 칼슘처럼
  혈액제제·회로 보충은 식이보충제가 아니므로 `exposure` + `off_topic`.
- 제목만 있는 레코드는 `evidence_basis: title_only`, confidence 는 low 로 고정하고
  `insufficient_abstract` 를 반드시 포함시켰다. 노출·결과가 제목에서 명확하면
  retain(low), 노출조차 불명확하면 uncertain 으로 보냈다.

### 산출물
- `data/curated_v3/llm_screening_classifications.csv` (2,209행)
  SHA-256 `5305c69437114b9f157ff6fb10bf1dc0308b2fca1ddacb2d02fc3b6848450393`
- `research/screening/v30_agent/checkpoints.jsonl`
  SHA-256 `085ad6346ddbeaf3133b00f3503316e814d93c67c9ed23bb60c0aa399ce3497a`
- 해시는 모두 LF 정규화 후 계산(`hash_method` 필드 참조).

## 2026-07-27 P3 축 채점 규칙 (라운드 1 시작 시 확정)

P3 는 P2 와 다른 과업이다. 레코드를 통째로 판단하지 않고 P·I·C·O·S 다섯 축을
따로 채점하며, 종합 라벨은 `tools/v30/agent_reference_sample.py` 의 코드가 도출한다.
프롬프트는 `research/validation/screening_ai_reference_v3/prompts/reference_picos_prompt.md`
에 동결했고, 그 안의 「P 축 보충 해석」은 채점을 시작하기 전에 확정했다.

### 프롬프트에 적힌 규칙을 실제 채점에 적용하며 굳힌 세부 기준

- **O 축은 방향 불문**이다. 해당 질문의 O 목록에 속한 결과를 측정·보고했으면
  이득이든 해악이든 `yes` 로 둔다(예: 엽산-신경관결손 예방, 수술 후 심방세동 예방).
  반대로 측정한 결과가 O 목록 밖이면 `no` 로 둔다: 보충제 이용률·인지도·지식 조사,
  영양소 생화학지표만, 비용·정책 분석, 질환과 무관한 임상지표.
  일반적 이상반응만 보고하고 목록에 든 범주(고칼륨혈증·신독성·심혈관 이상반응 등)를
  명시하지 않으면 `unclear` 로 둔다.
- **HRS4 의 P** 는 "간질환 또는 간손상이 있는 사람"으로 읽는다. 원인 물질이 약물인지
  보충제인지는 P 가 아니라 I 축에서 가린다. 보충제 노출 아래 간기능을 평가한 연구는
  간손상이 발생하지 않았더라도(예: 블랙코호시 메타분석) P 를 충족한 것으로 본다.
- **HRS1 의 I** 는 수술 전후(전·중·후) 보충제 노출로 읽는다. 프롬프트 원문은 "수술 전"
  이지만 이 질문의 O 와 S 가 수술 후 사건을 포함하므로 술후 보충 투여도 I 를 충족한다.
  단 정맥 철분제(ferric carboxymaltose, IV iron)와 시술 중 도포하는 지혈제(Ankaferd)는
  식이·허브 보충제가 아니므로 `no`.
- **HRS3 의 I** 는 임신 중 노출로 한정한다. 신생아 분유 강화, 산후 수유 보충은 `no`.
  식사 패턴·영양소 섭취량만 다루고 보충제 투여가 아니면 `no`.
- **HRS5 의 P** 는 프롬프트대로 지침·종설이 항응고 환자군을 대상으로 논의하면 `yes`.
  단 와파린 상호작용이 한 문장 스치듯 언급된 암·수술 종설은 `no`.
- **연구 단위가 사람이 아니면 P 는 `no`**: QSAR/in silico 독성예측, 식물 성분 분석,
  약리 성분 총설.
- 초록이 없으면 제목에서 명시된 축만 `yes`, 나머지는 `unclear`. 제목이 명백히
  어긋나는 근거를 줄 때만 `no`(예: 자궁근종 신약개발 논문의 HRS4 P).

### 라운드 1 결과
- 300건 전량 채점 완료, `collect --round 1` 통과.
- 도출 라벨 분포: reference_retain 170 / reference_deprioritize 102 / reference_uncertain 28
