# 학위논문 작성 상태

상태: `blocked_before_results_freeze`

최종 학위논문 DOCX/PDF는 아직 만들 수 없다. 독립적인 사람 검토가 필요한 검색 승인·중복제거·선별·전문검토·자료추출·RoB·GRADE·AI 평가·gold scenario·전문가 검토가 완료되지 않았기 때문이다.

현재 존재하는 `research/thesis/checkpoints/methods_checkpoint_nonfinal.*`은 결과가 없는 방법 점검본이다. 최종 논문이나 제출본이 아니며, 연구결과·고찰·결론·국문초록·영문초록을 포함하지 않는다.

최종 작성은 다음 조건이 모두 충족된 뒤 시작한다.

1. `results_freeze_review.csv` 한 행이 승인자·시각·frozen commit·data/analysis manifest·학과 서식·각 SHA-256을 갖춘다.
2. A~K acceptance gate가 모두 실제 증거로 통과한다.
3. 검증된 배포가 release commit과 thesis bundle byte에 일치한다.
4. `finalization_readiness.json`의 `finalization_ready`가 true다.

그 전에는 synthetic proxy 수치나 빈 registry를 정상 연구결과처럼 서술하지 않는다. final DOCX/PDF 경로도 만들지 않는다.

동결 이후에는 현재 학과 서식을 적용해 DOCX를 생성하고, 모든 페이지를 PNG로 렌더링해 검사한다. PDF로 변환한 뒤 PDF 전 페이지도 다시 렌더링해 글꼴·표·그림·쪽나눔·초록 수치·참고문헌을 확인한다. 마지막으로 파일 SHA-256과 frozen commit을 final submission manifest에 기록한다.
