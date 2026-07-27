# Codex 참조표준 교차검증 arm — 작업 지시서

## 왜 이 작업이 필요한가

v3.0 트랙에서 문헌 선별(2,209행)과 참조표준 채점(300행)을 **같은 판정 주체**가 했다.
같은 가중치·같은 학습 데이터를 쓰면 같은 문헌에서 같은 방향으로 틀리므로, 지금 보고한
`sensitivity_vs_ai_reference` 등은 진실 정확도가 아니라 내부 일관성 지표다.

라운드 2와 3의 축 판정이 1,500셀 중 0셀 차이로 완전히 같았다. 같은 주체를 반복 실행하면
독립 판정이 아니라 재현이 나온다는 뜻이다. 그래서 반복 횟수를 늘려도 이 한계는 풀리지 않는다.

**다른 모델 계열이 채점하면 풀린다.** 그때 나오는 값은 무의미한 재검사 일치도가 아니라
**평가자 간 일치도(inter-rater agreement)** 이며, 심사자가 실제로 보고 싶어 하는 지표다.

## 왜 하필 채점 역할을 넘기는가

| 역할 | 분량 | 담당 |
|---|---|---|
| 문헌 선별(분류기) | 2,209 레코드-질문 행 | Claude, 완료 |
| 참조표준 채점(평가자) | 300행 × 1라운드 | **Codex, 이 작업** |

작은 쪽이자, 독립성이 필요한 쪽이다. 참조표준은 분류기와 독립이어야 의미가 있다.
반대로 넘기면 이미 끝난 2,209행을 버리게 되고 문제가 뒤집힐 뿐이다.

## 무엇을 하는가

`input/blinded_records.jsonl` 300행 각각에 대해 `input/reference_picos_prompt.md` 의 규칙을
그대로 적용해 **P·I·C·O·S 다섯 축만** 판정한다.

**종합 라벨(retain/deprioritize/uncertain)을 만들지 마라.** 라벨은 축 값에서 코드가 도출한다
(`tools/v30/agent_reference_sample.py` 의 `derive_label`). 축을 채점할 때 종합 판단을 미리
떠올리면 규칙이 흔들린다.

## 절대 금지

1. **Claude 의 P2 선별 라벨·confidence·reason_codes·batch_id 를 입력에 넣지 마라.**
   블라인드 파일에는 원래 없다. 다른 경로로도 넣지 마라.
2. **Claude 의 기존 라운드 1–3 응답을 보여주지 마라.**
   `../rounds/` 아래에 있다. 이 arm 의 실행자는 그 폴더를 열지 않는다.
3. **프롬프트를 수정하지 마라.** 해시가 `input/manifest.json` 에 고정돼 있다.
4. 300행 전부 판정한다. 표본을 줄이거나 어려운 행을 건너뛰지 않는다.

## 출력 형식

`responses/codex-round1.jsonl` 에 한 줄당 한 레코드로 쓴다. 필드는 정확히 여섯 개다.

```json
{"blind_id":"B0008","population":"yes","intervention":"yes","comparator":"no","outcome":"yes","design":"human_secondary"}
```

허용값

- `population` · `intervention` · `comparator` · `outcome` : `yes` | `no` | `unclear`
- `design` : `human_clinical` | `human_secondary` | `animal` | `in_vitro` | `unclear`

`blind_id` 는 입력에 있는 300개가 정확히 한 번씩 나와야 한다.

## 받은 뒤 할 일

```bash
python tools/v30/codex_reference_arm.py verify research/validation/screening_ai_reference_v3/codex_arm/responses/codex-round1.jsonl
python tools/v30/codex_reference_arm.py compare research/validation/screening_ai_reference_v3/codex_arm/responses/codex-round1.jsonl
```

`verify` 는 행 수·중복·허용값·불필요한 필드·P2 정보 유출을 검사한다.
`compare` 는 평가자 간 일치도와 κ, 층화 가중 지표, Codex 를 참조로 둔 Rogan–Gladen 보정을
계산해 `research/synthesis/ai_reference_cross_check_codex.json` 에 쓴다.

## 결과를 해석할 때 지킬 것

- **주 분석을 먼저 정하고 숫자를 봐라.** 두 개의 보정 추정치가 나오는데, 값을 본 뒤 유리한
  쪽을 고르면 지금보다 더 큰 결함이다.
- **여전히 사람 gold standard 가 아니다.** `sensitivity_vs_ai_reference` 계열 명칭을 유지하고
  arm 을 구분하는 접미사만 붙인다. "정확도", "gold standard", "validated" 로 승격하지 않는다.
- **표집틀은 여전히 Claude 의 P2 라벨이다.** 층이 그 라벨로 정의됐다. 이 arm 이 측정하는 것은
  독립적인 선별이 아니라 같은 표본에 대한 두 주체의 축 판정 일치도다. 논문에 그대로 적는다.
- 참조표준 설계가 바뀌므로 `research/protocol/amendments.csv` 에 개정 이력으로 남긴다.
  사후 추가가 아니라 개정이어야 한다.
