<!-- BEGIN:nextjs-agent-rules -->
# Next.js 작업 안내
프레임워크 코드를 바꾸기 전에 `node_modules/next/dist/docs/`의 해당 문서를 읽는다.
<!-- END:nextjs-agent-rules -->

# 여형준 최종 연구

현재 논문·사이트의 자료는 사후 정정한 263,982행이다. `README.md`, `docs/version_map.md`, `research/final/manifest.json`을 읽고 시작한다. 과거 제출본의 버전 번호를 현재 정본으로 사용하지 않는다.

## 원자료와 평가

- 실행 루트: `C:/dev/evidence-recollect`; 연구 자료: `data/yeo/`.
- 채점 표본 3,250행, 표본 추출틀 253,810행. 표본·잠금·원래 판정은 보존한다.
- 지표는 AI 비교 기준을 이름에 명시한다. 임상 정답률로 표현하지 않는다. `independent_blinding`은 사람 맹검이므로 false다. AI 맹검은 별도 속성으로 기록한다.
- 판정 이유 감사는 사후 검토다. 원래 맹검 평가를 수정하거나 독립 평가로 바꾸어 설명하지 않는다.
- 문헌을 대량으로 의미 검토할 때는 사용자 지정 모델 `gpt-5.6-luna`를 사용한다. 유료 API를 임의로 켜지 않는다.

## 유지할 경계

- 근거지도는 `clinical_recommendation:false`, `decision_authority:"none"`, `output_scope:"evidence_linking_only"`를 유지한다.
- `/api/personalized-safety`는 결정적 조회다. 모델 호출을 넣지 않는다. `consult/interpret`와 `consult/compose`는 조회 앞뒤의 표현 보조이며 안전 판정 권한이 없다.
- `_보관/` 파일과 봉인 명세를 바꾸지 않는다. 원래 경로 기준 해시 검증은 외부 보관 사본에서 한다.
- `research/queries/query_definitions.json`과 보관된 원본 검색어 목록의 동일성을 유지한다.
- `data/corpus/`와 `research/systematic_review/`가 현행 자료다. `tools/build/`가 현행 생성기다.

- `release_ready=false`를 유지한다. 공개 사이트 배포는 연구자의 명시적 요청 후 실시한다.
- `tools/search_pipeline/embase_adapter.py`는 미실행된 후속 검색용 코드다. 제2 데이터베이스 검색을 완료한 것으로 보고하지 않는다.
- `.gitattributes`의 연구 자료 줄바꿈 규칙과 `.vercelignore`의 대용량 원자료 제외를 유지한다.
- 과거 기록 전체는 이번 정리 이전 `etc/remediation/backups/AGENTS.md`에서 확인할 수 있다. 현재 실행 지시로 해석하지 않는다.

## 검증

변경 범위에 맞는 회귀검사를 실행한다. 사이트 변경 뒤에는 `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`를 완료한다. 연구 자료는 `npm run validate:research`로 검증한다.
