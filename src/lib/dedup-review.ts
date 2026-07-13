export type DedupReviewBundle = {
  id: string;
  title: string;
  finding: string;
  recommendation: string;
  reasons: string[];
  affectedCount: number;
};

export const dedupReviewBundles: DedupReviewBundle[] = [
  {
    id: "DEDUP-MERGE-HIGH",
    title: "동일 문헌으로 합칠 45쌍",
    finding: "DOI가 같거나, 제목·연도·학술지·제1저자가 모두 같은 쌍만 선별했습니다.",
    recommendation: "45쌍을 중복 보고서로 확정하고 하나의 대표 레코드로 합칩니다.",
    reasons: ["식별자 또는 핵심 서지정보가 일치", "보수적인 고신뢰 규칙만 적용", "원본 PMID와 연결 기록은 보존"],
    affectedCount: 45,
  },
  {
    id: "DEDUP-RETAIN-SEPARATE",
    title: "별도 보고서로 유지할 297쌍",
    finding: "정규화 제목은 같지만 연도·학술지·저자·DOI 중 하나 이상이 달랐습니다.",
    recommendation: "297쌍은 지금 합치지 않습니다. 이후 사람의 연구 단위 연결 단계에서 다시 확인합니다.",
    reasons: ["번역판·논평·정정·후속 보고서일 수 있음", "성급한 병합으로 문헌을 잃는 위험 방지", "연구 단위 연결 전까지 각 PMID 보존"],
    affectedCount: 297,
  },
];
