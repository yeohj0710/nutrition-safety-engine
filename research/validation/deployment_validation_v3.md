# 개인맞춤 안전성 조회 시스템 배포 검증

- 환경: Vercel Production
- URL: https://nutrition-safety-engine.vercel.app
- 배포 식별자: Vercel Production 배포 기록에서 관리(고정 주소를 기준 URL로 사용)
- 상태: `READY`
- 프레임워크: Next.js 16.2.1 App Router
- 배포 지역: Washington, D.C., USA (`iad1`)
- 빌드 결과: 108개 route/static page 생성 성공
- API: `POST /api/personalized-safety`
- 입력: 보충제, 일일 용량, 병용 약물, 질환·결석 병력, 검사값
- 출력: 질문 ID, 개인 입력 요약, 확인사항, 핵심 근거 문헌, 용량·안전성 결과, 원문 URL, 배포 버전
- 안전 경계: 복용 시작·중단·용량 변경을 지시하지 않음
- 투여 맥락 용량 추출: 369건
- 핵심 근거: 128건(A1 30건, A2 12건, B1 30건, B2 30건, B3 26건)
- 로컬 검증: 62 tests passed, lint passed, TypeScript passed, production build passed

이 배포는 연구계획서의 개인맞춤 조회 시스템을 구현한 Production 배포이다. 고정 주소와 데이터 manifest를 논문 및 최종 산출물에 함께 기록한다.
