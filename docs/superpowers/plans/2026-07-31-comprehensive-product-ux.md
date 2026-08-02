# Nutrition Safety Engine Comprehensive Product UX Plan

> 로컬 구현 계획이다. 봉인 연구 산출물은 수정하지 않으며 명시 요청 전에는 배포하지 않는다.

**목표:** 사용자가 실제 기능을 과대해석하지 않도록 필터의 의미를 바로잡고, 문헌 근거를 문장별로 읽을 수 있는 정돈된 데모와 결과 화면을 만든다.

**원칙:** 자유 입력값을 개인 맞춤 판정처럼 보이게 하지 않는다. 결정적 메타데이터 필터와 AI가 초록에서 추출·번역한 문장을 구분한다. API는 기존 호출 호환성을 유지하고 새 화면에서는 축 ID만 전송한다.

## 1. 실패하는 계약 테스트부터 추가

**수정 파일**

- `__tests__/personalized-safety-api.test.ts`
- `__tests__/personalized-safety-ui-contract.test.ts`

**계약**

- 새 `axes` 요청이 값 기반 개인화가 아니라 문헌 보고 항목 필터임을 고정한다.
- 확장 조회에서는 필터가 적용되지 않았다고 응답한다.
- 확장 문헌은 locator 토큰이 아니라 실제 `key_finding` 문장을 표시한다.
- 결과 수, 고유 문헌 수, 출처 범위, AI 추출·번역 고지를 요구한다.
- 라디오 선택, 짧은 라이브 상태, 오류 초점, 44px 터치 영역, reduced-motion 스크롤을 요구한다.

## 2. API 표시 모델을 정직하게 만든다

**수정 파일**

- `app/api/personalized-safety/route.ts`
- `src/lib/personalized-safety-examples.ts`
- 필요 시 `src/lib/clinical-situations.ts`

**구현**

- `axes: AxisId[]`를 검증하고 기존 문자열 필드는 호환 입력으로만 유지한다.
- 문헌 수와 고유 문헌 수, 초록/제목 범위, 연도, 연구유형 요약을 서버에서 계산한다.
- 확장 문헌의 `key_finding`을 보존한다.
- 확장 조회 응답의 적용 필터는 빈 목록으로 반환하고 제한을 명시한다.
- 공개 예시는 구체적인 환자값 대신 실제 결과가 재현되는 메타데이터 필터 예시로 바꾼다.

## 3. 탐색 화면과 데모를 다시 구성한다

**수정 파일**

- `src/components/personalized-safety-query.tsx`
- 필요 시 `src/components/info-tip.tsx`
- `app/page.tsx`

**구현**

- 자유 입력 필드를 “연령·복용약·용량·성별·질환 정보를 보고한 문헌만 보기” 체크박스로 교체한다.
- 임상 상황은 이름이 있는 라디오 카드로 만든다.
- 예시 카드에는 예상 문헌 수와 필터 항목을 표시하고 개인 상태로 오인할 문구를 제거한다.
- 결과는 `핵심 3문장 → 나머지 문장 → 전체 문헌` 순서로 유지하되 문장마다 하나의 문헌 번호만 붙인다.
- AI 추출·번역, 원문 위치, 문헌 범위, 고유 문헌 수를 인라인으로 표시한다.
- 확장 조회에서 필터가 풀린다는 사실을 결과 상단에 표시한다.
- 요청 경합은 `AbortController`로 취소하고 결과에 사용한 조건 스냅숏을 표시한다.

## 4. 레이아웃·간격·접근성을 정리한다

**수정 파일**

- `app/globals.css`
- `src/components/site-frame.tsx`
- `app/loading.tsx`
- `app/error.tsx`
- `app/not-found.tsx`

**구현**

- 4/8 기반 spacing token, 1024px shell, 16/24/32/48px 역할 간격을 적용한다.
- 모든 주요 컨트롤을 최소 44px로 만들고 `:focus-visible` 대비를 확보한다.
- 작은 본문은 12px, 기본 본문은 14px 이상으로 제한한다.
- 헤더·본문·푸터 gutter를 통일하고 과도한 하단 여백을 64~80px로 제한한다.
- skip target, 화면낭독기용 로딩 문구, 짧은 라이브 상태를 모든 상태 화면에서 유지한다.
- 모션은 160~220ms의 opacity/transform에만 사용하고 motion 축소 설정을 따른다.
- 핵심 제한은 툴팁에 숨기지 않고, 보조 설명만 키보드·터치 가능한 도움말로 제공한다.

## 5. 검증

- 집중 테스트가 먼저 실패하고 구현 뒤 통과하는지 확인한다.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`를 실행한다.
- 연구 산출물에 diff가 없는지 확인한다.
- 브라우저는 사용하지 않고 코드 계약·빌드·정적 접근성 검토로 확인한다.
