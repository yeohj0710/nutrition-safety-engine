# v3 UI·접근성 브라우저 검증

- 검증일: 2026-07-12
- 대상: Production build를 `next start -p 3100`으로 실행한 로컬 검증 서버
- 브라우저: Playwright Chromium
- 데스크톱 흐름: 첫 화면 → 예시 토글 → `결석 병력 + 칼슘` 자동입력 → 조회 → 맞춤 요약 확인
- 모바일 viewport: 390 × 844
- 캡처: `output/playwright/mobile-accessibility-v3.png`

## 확인 결과

- 본문 바로가기 링크와 `main#main-content` 연결 확인
- h1 → h2 → 결과 h3 제목 계층 확인
- 모든 입력에 연결된 label과 의미 있는 name 확인
- 예시 토글과 5개 예시가 키보드 접근 가능한 native `details`/`button`으로 노출
- SVG chevron은 장식 아이콘으로 `aria-hidden=true` 적용
- 조회 결과와 오류 영역에 `aria-live=polite`, 로딩 중 `aria-busy=true` 적용
- 390px viewport에서 예시 카드·입력 폼이 한 열로 배치되고 가로 잘림 없음
- 현재 manifest 수치 4,593/369/1,507/121과 질문별 5~30건 표시 확인
- `prefers-reduced-motion`에서 CSS 전환을 축소하고 예시 자동 스크롤을 즉시 이동으로 변경
- 긴 건강정보 입력은 UI와 API 양쪽에서 길이 제한
- 개인식별정보 입력 금지 안내와 AI 출력의 새 수치·복용 지시 차단 확인
- malformed JSON, 과도한 입력, 비문자 필드는 400/no-store로 거부

## 범위

이 검증은 UI 흐름과 기술적 접근성 점검이다. 장애인 사용자를 포함한 사람 대상 사용성 평가를 수행했다는 의미가 아니다.
