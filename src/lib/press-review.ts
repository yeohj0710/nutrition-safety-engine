export type PressReviewBundle = {
  id: string;
  question: string;
  title: string;
  finding: string;
  recommendation: string;
  reasons: string[];
  affectedRows: string[];
  sourcePath: string;
};

export const pressReviewBundles: PressReviewBundle[] = [
  {
    id: "PRESS-BUNDLE-A1",
    question: "A1",
    title: "비타민 K와 항응고제 검색식",
    finding: "넓은 검색식은 12,229건, 결과 개념을 더한 후보식은 9,983건을 찾았고 sentinel 3건을 모두 유지했습니다.",
    recommendation: "넓은 검색식을 유지합니다. 치료 목적 vitamin K reversal 문헌은 NOT 조건으로 제거하지 않고 선별 단계에서 제외합니다.",
    reasons: ["민감도 손실을 피함", "알려진 핵심 문헌 3건 회수", "보충·식이 변화와 reversal을 사람 선별에서 구분"],
    affectedRows: ["PRESS-A1-01", "PRESS-A1-02"],
    sourcePath: "research/searches/search_strategy_drafts/A1_pubmed.txt",
  },
  {
    id: "PRESS-BUNDLE-A2",
    question: "A2",
    title: "오메가-3와 항응고제 검색식",
    finding: "항응고제 개념과 EPA·DHA를 결합한 검색에서 820건과 sentinel 2건이 확인됐습니다.",
    recommendation: "EPA·DHA 약어를 title/abstract 필드에서 유지합니다. 오탐은 표본 점검과 선별에서 처리합니다.",
    reasons: ["항응고제 블록과 AND 결합됨", "약어 제거 시 관련 문헌 누락 가능", "현재 workload는 선별 가능한 범위"],
    affectedRows: ["PRESS-A2-01"],
    sourcePath: "research/searches/search_strategy_drafts/A2_pubmed.txt",
  },
  {
    id: "PRESS-BUNDLE-B1",
    question: "B1",
    title: "칼슘과 신결석 검색식",
    finding: "초기식은 PMID 21525191을 놓쳤지만 Urinary Calculi와 urinary tract stone을 추가한 식은 이를 회수했고 1,353건을 찾았습니다.",
    recommendation: "추가된 결석 용어를 유지하고 현재 검색식을 승인합니다.",
    reasons: ["실제 누락 sentinel을 복구함", "노출 블록은 칼슘 보충제에 한정", "확장 범위가 질문과 일치"],
    affectedRows: ["PRESS-B1-01"],
    sourcePath: "research/searches/search_strategy_drafts/B1_pubmed.txt",
  },
  {
    id: "PRESS-BUNDLE-B2",
    question: "B2",
    title: "비타민 D와 신결석 검색식",
    finding: "넓은 검색식은 4,879건을 찾았고 sentinel 2건을 모두 유지했습니다. hypercalcemia가 비특이 문헌을 늘립니다.",
    recommendation: "민감도 보존을 위해 넓은 검색식을 유지합니다. 결석·고칼슘뇨와 무관한 hypercalcemia 문헌은 선별에서 제외합니다.",
    reasons: ["sentinel 2건 회수", "검색 단계의 과도한 축소 방지", "비특이성은 명시된 선별 기준으로 통제"],
    affectedRows: ["PRESS-B2-01"],
    sourcePath: "research/searches/search_strategy_drafts/B2_pubmed.txt",
  },
  {
    id: "PRESS-BUNDLE-B3",
    question: "B3",
    title: "비타민 C와 신결석 검색식",
    finding: "현재 검색식은 680건과 sentinel PMID 23381591을 회수했습니다.",
    recommendation: "현재 controlled/free-text 조합을 승인합니다. 성별 하위군은 검색식을 나누지 않고 선별·추출에서 기록합니다.",
    reasons: ["sentinel 회수", "비타민 C·ascorbic acid 동의어 포함", "불필요한 성별 검색 분할 방지"],
    affectedRows: ["PRESS-B3-01"],
    sourcePath: "research/searches/search_strategy_drafts/B3_pubmed.txt",
  },
  {
    id: "PRESS-BUNDLE-PLATFORM",
    question: "플랫폼",
    title: "해외·국내 데이터베이스 변환",
    finding: "RISS 20개 분할식은 19개에서 결과가 있었지만 KMbase 20개는 모두 0건이었습니다. Embase·Scopus는 인증 접근이 확인되지 않았습니다.",
    recommendation: "RISS 20개 식은 최종 재실행 대상으로 승인합니다. KMbase 20개 식은 알려진 문헌 회수와 연산자 확인 전까지 수정 필요로 둡니다. Embase·Scopus는 접근 불가로 기록합니다.",
    reasons: ["0건을 근거 부재로 오해하지 않음", "접근하지 못한 플랫폼의 구문을 확정하지 않음", "플랫폼별 결정을 분리 보존"],
    affectedRows: ["PRESS-PLATFORM-01", "PRESS-KRDB-01", "PRESS-KR-KMBASE-01~20", "PRESS-KR-RISS-01~20"],
    sourcePath: "research/review_queue/korean_db_PRESS_review.csv",
  },
];
