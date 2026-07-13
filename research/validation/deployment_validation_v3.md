# 개인맞춤 안전성 조회 시스템 배포 검증

- 환경: Vercel Production
- 고정 URL: https://nutrition-safety-engine.vercel.app
- GitHub 기본 브랜치: `main`
- 애플리케이션 소스 커밋: `36d7b29`
- Production deployment: `dpl_4LwGMoZK1dBXFHp73nP1UCsERFwk`
- 상태: `READY`
- 프레임워크: Next.js 16.2.10 App Router
- 배포 리전: Washington, D.C., USA (`iad1`)
- 빌드 결과: 정적 페이지 107개 생성 성공
- API: `POST /api/personalized-safety`
- 입력: 보충제, 일일 섭취량, 병용 약물, 질환·결석 병력, 검사값
- 출력: 질문 ID, 개인 입력 요약, 확인사항, 핵심 근거 문헌, 용량·안전성 결과, 원문 URL, 배포 버전
- 안전 경계: 복용 시작·중단·섭취량 변경을 지시하지 않음
- 전체 PICOS 직접 후보: 369건
- 핵심 근거: 121건(A1 30건, A2 5건, B1 30건, B2 30건, B3 26건)
- 핵심 근거 URL: 고유 URL 118개 접근 확인
- 로컬 검증: 67 tests passed, lint passed, TypeScript passed, production build passed
- 의존성 감사: 취약점 0건

이 배포는 연구계획서의 개인맞춤 조회 시스템을 구현한 Production 배포다. 고정 주소와 데이터 매니페스트는 논문 및 최종 제출물에도 함께 기록한다.
