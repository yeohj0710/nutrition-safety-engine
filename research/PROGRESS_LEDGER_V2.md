# Protocol v2 진행 원장

| 단계 | 상태 | 검증된 증거 | 남은 작업 |
|---|---|---|---|
| v2 프로토콜 | complete_verified | AM-002, protocol, role matrix, validator errors 0 | 없음 |
| 공개 검색 corpus | complete_existing_scope | PubMed 19,961 units, ClinicalTrials.gov 207, KoreaMed 62; 원자료·해시 보존 | 접근 불가 자료원은 한계로 유지 |
| AI 탐색 분류 | complete_verified | PubMed 19,961/19,961: retain 12,330, deprioritize 982, disagreement/uncertain 6,649; ClinicalTrials.gov 207·KoreaMed 62는 unranked 후보로 전량 보존 | 없음 |
| 탐색 근거지도 | complete_verified | 20,230/20,230 source-bound rows; 초록 18,015, title-only 2,215; PMC locator 5,653 record-question rows/5,563 unique records; raw sources 104개 해시 검증 | 없음 |
| 잠정 주장·탐색 엔진 | complete_verified | 5개 질문별 source-bound provisional claim, 5개 evidence-navigation rule; 임상행동 0; 53 tests, typecheck/build 통과 | 없음 |
| 기술 시나리오 검증 | complete_verified | synthetic fixtures 120개×3회; 결정성·정확 question routing·계보 120/120; 임상행동·legacy 누출·8개 near-match 오경로 0 | 없음 |
| 한국어 논문·runtime | complete_verified | data-driven 한국어 DOCX, 6쪽 PDF, Markdown; PDF 전 페이지 defects 0; production 홈/API 200, A1 routing, 임상행동·legacy·validated-scope 누출 0 | 최종 manifest |

최종 상태: `complete_verified_ai_exploratory`. 23개 핵심 산출물은 `research/thesis/ai_exploratory_final_manifest.json`에 SHA-256으로 고정됐다. V1 체계적 문헌고찰은 이 완료 상태에 포함되지 않는다.

v1 체계적 문헌고찰은 계속 `blocked_external`이며 v2 완료로 대체되지 않는다.
