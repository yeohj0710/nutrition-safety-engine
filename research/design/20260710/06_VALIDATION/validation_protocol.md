# 규칙 기반 상담지원 도구 검증 프로토콜

## 1. 목적

검증된 근거 규칙이 사전 지정 임상상황에서 올바른 행동 등급, 누락정보, 근거 링크를 일관되게 반환하는지 평가한다.

## 2. 검증 대상

- `scope_status=validated_thesis_scope`
- `validation_status`가 최소 `source_verified`인 규칙
- 고정된 코드 커밋과 데이터 bundle 버전

탐색 규칙과 legacy 규칙은 주요 성능 분석에서 제외한다.

## 3. 검증 자료 독립성

시나리오 정답은 규칙 구현자가 단독 작성하지 않는다. 두 명의 임상 검토자가 연구 질문과 근거 요약을 바탕으로 독립 작성하고, 불일치를 합의한다. 엔진 결과는 정답 고정 전 가린다.

## 4. 목표 시나리오 구성

총 120건을 목표로 한다.

### 직접 양성 60건

- A1 12건
- A2 12건
- B1 12건
- B2 12건
- B3 12건

각 질문에서 명확한 양성, 용량 경계, 병용 조건, 하위군을 포함한다.

### 음성·경계·범위 밖 30건

- 성분은 같지만 고위험 population이 아님
- population은 같지만 exposure가 아님
- 식이와 보충제를 구분해야 함
- 잘못된 단위 또는 모호한 상품명
- 연구 범위 밖 성분

### 상충·누락·복합 30건

- 필수 정보 누락
- VKA/DOAC 구분 필요
- calcium 단독 vs calcium+D
- 여러 규칙이 동시에 적용
- 근거가 상충하거나 매우 낮은 확실성
- 잘못된 입력, 단위 변환, 극단값

## 5. 정답 필드

- expected action class set
- expected primary action
- expected rule IDs, 규칙 ID가 고정된 이후
- prohibited action classes
- required missing-information prompts
- expected evidence claim IDs
- severity
- rationale
- adjudication notes

정답은 한 개 규칙만 강제하지 않을 수 있다. 임상적으로 동등한 허용 집합을 정의할 수 있다.

## 6. 실행

- 고정된 Docker/Node 환경 또는 lockfile
- 같은 bundle과 commit
- 각 시나리오 최소 3회 반복
- API와 UI 경로 모두 검사
- 원시 입력·출력과 실행 로그 저장

## 7. 1차 성능지표

- 고위험 action sensitivity
- critical false negatives
- evidence-link accuracy
- deterministic repeatability

## 8. 2차 성능지표

- micro/macro precision, recall, F1
- exact rule-set match
- exact action-set match
- missing-information prompt recall
- false escalation rate
- per-question performance
- boundary-case performance
- API/UI consistency

95% 신뢰구간을 함께 제시한다. 이분형 비율은 Wilson 구간을 기본으로 한다.

## 9. 사전 목표

- 고위험 민감도 0.95 이상
- 전체 정밀도 0.85 이상
- 규칙 집합 완전일치율 0.80 이상
- critical false negative 0건
- evidence-link accuracy 1.00
- deterministic repeatability 1.00

목표는 결과를 바꾸는 기준이 아니라 배포 승인 기준이다. 미달 결과도 논문에 보고한다.

## 10. 기존 엔진 비교

가능하면 같은 시나리오를 기존 배포와 새 엔진에 실행한다. 쌍을 이룬 오류 차이는 McNemar 검정을 검토한다. 기존 엔진의 범위가 다르면 비교 가능한 하위집합만 사용한다.

## 11. 오류 심각도

- `critical`: 긴급 검토·회피가 필요한 상황을 정보 없음 또는 안전으로 반환
- `major`: 잘못된 action class, 잘못된 대상·용량 일반화
- `moderate`: 중요한 누락정보 질문 누락, 부정확한 근거 연결
- `minor`: 표현·순서·형식 오류

critical 오류는 수정 후 전체 회귀 세트를 다시 실행한다.

## 12. 전문가 내용 검토

전문가 3명 이상을 목표로 다음을 평가한다.

- 임상 범위 적합성
- 근거 해석 정확성
- 행동 등급의 타당성
- 메시지의 명확성
- 과도한 확신 또는 위해 가능성
- 누락된 예외

전문가가 규칙 데이터와 원문 링크를 확인할 수 있어야 한다.

## 13. 사용성

기관의 사전 판단 후 별도 계획으로 시행한다. 기술 성능과 사용성 결과를 섞지 않는다.

## 14. 검증 완료 기준

- 정답 세트가 구현과 독립적으로 작성됨
- 모든 시나리오와 출력이 버전·해시로 보존됨
- 지표와 CI가 코드로 재생성 가능
- 모든 critical/major 오류의 처리 상태가 기록됨
- 검증 범위 밖 기능이 주요 지표에 섞이지 않음
