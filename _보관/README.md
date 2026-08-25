# 보관 (2026-08-25 정리)

여기 있는 것은 **끝난 것이지 못 쓰는 것이 아니다.** 제출한 졸업논문의 근거가 전부
이 아래에 있다.

## 왜 옮겼나

저장소 위쪽에 트랙이 둘 겹쳐 있었다.

| | 무엇 | 지금 |
|---|---|---|
| v40 (48,031행) | **제출한 논문의 근거** | 2026-08-02 봉인, 참조만 |
| v41 (257,060행) | 사이트 데이터 | 배포 중 |

이름만 보면 v40 이 v41 의 옛 판 같지만 그렇지 않다. 서로 다른 물건이 나란히 있던
것이다. 위쪽에는 지금 돌아가는 것만 두고 버전 표식을 뗐다. v40 계열은 이 폴더로
모았다.

## 무엇이 여기 있나

```
_보관/
  research/
    systematic_review_v40/   근거 번들 1,899 · 핵심 75 · 규칙 34
    searches_v4/             PubMed 원본 XML 242개 (로컬 전용, 1.1GB)
    screening/               선별 (분류기 + 재판정 616)
    validation/              채점 arm 1,033행
    synthesis/               채점 대조 결과
    logs/                    원장 8개 (v40_run_report.json 등)
  data/curated_v4/           코퍼스 evidence_map.csv 48,031행
  tools/v40/                 v40 파이프라인
  tools/v40_scoring/         채점 arm 도구
```

## 봉인 원장 이야기 (중요)

`research/logs/v40_run_report.json` 은 **경로 297개를 SHA-256 으로 박아 둔 원장**이다.
그중 296개에 `v40` / `v4` 표식이 들어 있고, 근거 한 건 한 건의 `raw_source_path` 에도
들어 있다. 그리고 이 원장은 다시 만들 수 없다.
`tools/v40/finalize_run_report_v4.py` 가 `git status` 를 하드코딩된 기준과 비교하는데,
트리가 커밋된 뒤로는 실행을 거부한다.

**즉 여기로 옮기면서 원장이 적어 둔 경로 앞에 `_보관/` 이 붙었다.**
원장의 사슬을 그대로 확인하려면 아래 사본을 쓴다.

```
C:\dev\_archive\nutrition-safety-engine_v40_260825\
```

2026-08-25 에 뜬 사본이다. 파일 2,559개, 1.4GB. **경로 구조가 원장이 기록한 그대로다.**
재현성을 증명해야 할 일이 생기면 이 사본을 저장소 루트에 겹쳐 놓고 확인하면 된다.

논문에 딸려 제출한 부록은 따로 또 있다.
`G:\내 드라이브\여형준님\24 전공심화실습(1)\여형준\03_연구부록\`

## 되돌리려면

```bash
git mv _보관/research/systematic_review_v40 research/
git mv _보관/research/screening research/
# 나머지도 같은 식으로
```

`.gitignore` 와 `.vercelignore` 의 `_보관/` 경로도 같이 되돌려야 한다.

## 여기 있는 것을 지우지 마라

`tools/search_pipeline/embase_adapter.py` 는 제2 데이터베이스 공백용이라 위쪽에
남겨 뒀다. 그 밖에 이 폴더의 어떤 것도 명시 요청 없이 지우지 않는다.
로컬에만 있고 git 에 없는 것들이 섞여 있다. 목록은
`research/logs/v40_local_only_manifest.json` (파일 2,007개, 1,336 MiB).
