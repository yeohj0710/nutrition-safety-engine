# v3 최종 승인 기준 감사

감사일: 2026-07-12  
기준: `research/design/20260710/10_QA/acceptance_criteria.md`  
상태값: `pass`, `partial`, `blocked_external`, `fail`

## 요약

| 영역 | 상태 | 현재 증거 | 남은 조건 |
|---|---|---|---|
| A. 연구 정체성과 프로토콜 | partial | A1~B3 유지, v1과 v2 amendment 보존, v3 논문에 자동화 한계 명시 | v3 체계적 근거검토의 별도 protocol amendment와 승인 기록 보강 |
| B. 검색 | partial | 질문별 공개 검색 원자료·manifest·SHA, 상위 N 제한 없는 20,230행 corpus 보존 | PRESS 사람 검토와 제출 전 업데이트 검색 |
| C. 선별 | blocked_external | PICOS 자동 후보 4,593건과 결정 규칙·원자료 계보 보존, AI 단독 최종 제외를 주장하지 않음 | 사람 제목·초록/원문 이중 선별, agreement, PRISMA 확정 |
| D. 추출과 질평가 | blocked_external | 투여 맥락이 확인된 용량 관찰 369건, 원문 locator 1,507건, 자동 추출 필드 보존 | 원문 숫자 이중 확인, report-study 연결, RoB 독립 평가 |
| E. 합성 | partial | 질문별 분리와 비정량 구조화, 임의 메타분석 없음 | GRADE 또는 승인된 대안, 효과크기·CI 기반 합성 |
| F. AI 평가 | blocked_external | 자동화 코드·입력·산출물과 해시 보존 | 사람 gold 선잠금, 개발/평가 분리, 실제 선별·추출 성능 |
| G. Claim과 규칙 | partial | v3 개인맞춤 규칙은 질문별 확인사항과 노출 직접성 핵심 문헌 121건을 연결 | 원문 locator 단위의 사람 검증 claim과 임계값 검증 |
| H. 엔진과 앱 | partial | API contract, 경계, legacy 분리, Production build와 고정 URL, 입력 수치·URL·위험 지시문을 차단하는 AI 출력 검증과 결정적 fallback | 사용자용 문장화만 허용한 변경을 amendment log에 고정하고 commit-deployment 일치 재검증 |
| I. 시나리오·전문가 검증 | blocked_external | 5개 사용자 예시와 자동 회귀테스트 보존 | 구현 독립 gold, 전문가 검토, sensitivity/precision/CI |
| J. 논문 | partial | DOCX/PDF 16쪽, 225문단, 표 4개, 전 페이지 시각검사 및 해시 | 학과 최신 양식·참고문헌·전문 내용의 사람 최종 검토 |
| K. 재현성과 제출 | partial | 재현 코드, G: 재귀 SHA-256 manifest, clean Git status, 공개 branch, `thesis-v3-20260712` tag, Production 고정 URL | 공개 저장소의 최종 제출 branch를 main에 병합할지 결정; 외부 검토 미완료 항목은 계속 공개 |

## 해석 제한

현재 v3는 자동화된 체계적 근거 검색·PICOS 구조화·개인맞춤 조회 시스템의 구현본이다. 독립된 사람 선별, 원문 이중 추출, RoB/GRADE, 독립 gold 시나리오와 전문가 검토가 수행된 것처럼 표시하지 않는다. 따라서 `10_QA/acceptance_criteria.md` 전체 통과 상태가 아니며 프로젝트 전체를 `complete_verified`로 표시할 수 없다.

## 즉시 통과한 기술 증거

- 핵심 근거 validator: 121건, A1 30/A2 5/B1 30/B2 30/B3 26, 오류 0
- 웹 회귀검사: 16 test files, 67 tests
- lint, TypeScript, Next.js Production build 통과
- 논문 validator: 16쪽, 225문단, 표 4개, 오류 0
- Production 모바일 브라우저: 예시 펼침·자동입력·조회·맞춤 요약·근거 접기 정상, 콘솔 오류 0, 가로 overflow 0
- Production 고정 URL: https://nutrition-safety-engine.vercel.app
- 최종 전달 폴더: `G:/내 드라이브/여형준님/24 전공심화실습(1)/여형준`
