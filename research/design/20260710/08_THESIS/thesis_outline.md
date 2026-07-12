# 졸업논문 상세 구성

상태: `outline_only_results_not_frozen`

결과 수치·결론·초록은 `results_freeze_review.csv`가 검증되기 전 작성하지 않는다. 아래 구성은 장과 근거 위치를 미리 고정하기 위한 목차다.

## 앞부분

- 국문 제목과 영문 제목
- 제출·인준 정보
- 국문 초록과 주제어
- 목차, 표 목록, 그림 목록, 약어 목록

## 1. 서론

### 1.1 연구 배경

항응고제 복용과 영양성분·보충제, 신장결석 위험과 칼슘·비타민 D·비타민 C라는 임상 문제를 설명한다.

### 1.2 기존 근거와 문제

근거가 연구설계·결과·집단별로 흩어져 있고, 검색 결과 수와 실제 적용 가능한 근거가 다르다는 점을 설명한다.

### 1.3 연구 필요성

출처를 추적할 수 있는 근거 claim과 결정론적 안전확인 규칙을 분리해 구축·검증할 필요성을 제시한다.

### 1.4 연구 목적과 질문

A1·A2·B1·B2·B3의 population, exposure, comparator, outcome 범위를 프로토콜과 동일하게 제시한다.

## 2. 연구방법

### 2.1 연구설계와 프로토콜

연구 유형, 사전 프로토콜, amendment, 등록·공개 상태를 기술한다.

### 2.2 정보원과 검색

데이터베이스별 검색일·전체 검색식·접근 제한·PRESS·원본 보존·업데이트 검색을 기술한다. hit와 export 수를 구분한다.

### 2.3 중복제거와 report–study 연결

record·report·study 단위, 자동 후보 생성, 사람 확인, canonical record 규칙을 기술한다.

### 2.4 문헌선별과 전문검토

포함·제외 기준, 두 검토자, 합의, 전문 입수, 제외 이유, AI 단독 제외 금지를 기술한다.

### 2.5 자료추출과 비뚤림 위험

55개 추출 필드, 원문 quote·locator·SHA-256, 독립 검증, 설계별 RoB 도구와 버전을 기술한다.

### 2.6 합성과 GRADE

질문·결과·설계별 합성, 메타분석 시행 기준, 비정량 합성, 민감도 분석, GRADE 절차를 기술한다.

### 2.7 AI 성능평가

human gold 선행, 개발·평가 분리, 모델·prompt·raw output, field-level 정확도, locator 오류, 반복성, 효율을 기술한다.

### 2.8 claim·rule·engine 구축

source→extraction→GRADE→claim→rule 계보, 조건 schema, 결정론적 matcher, legacy 격리와 runtime LLM 제거를 기술한다.

### 2.9 독립 scenario와 배포 검증

두 독립 저자·합의자, 120개 gold, 민감도·정밀도·exact match·critical FN, release commit과 배포 byte 검증을 기술한다.

## 3. 연구결과

동결 이후에만 다음 순서로 작성한다.

### 3.1 검색·선별 결과와 PRISMA
### 3.2 포함 연구와 보고서 특성
### 3.3 비뚤림 위험
### 3.4 질문 A1·A2 결과
### 3.5 질문 B1·B2·B3 결과
### 3.6 GRADE certainty
### 3.7 AI 성능
### 3.8 claim·rule·engine 검증
### 3.9 독립 scenario·전문가·배포 검증

## 4. 고찰

### 4.1 주요 결과
### 4.2 기존 연구와의 비교
### 4.3 임상적 의미와 적용 범위
### 4.4 연구의 강점
### 4.5 한계와 잠재적 편향
### 4.6 후속 연구

## 5. 결론

동결된 결과가 직접 답하는 범위에서만 간결하게 작성한다. 개인별 처방이나 근거 없는 안전성 단정을 하지 않는다.

## 뒷부분

- 참고문헌
- 전체 검색식과 amendment
- 선별 제외 이유와 PRISMA 계보
- 추출·RoB·GRADE 양식
- AI 평가와 scenario protocol
- claim/rule/source manifest
- 데이터·코드·배포·재현성 정보
