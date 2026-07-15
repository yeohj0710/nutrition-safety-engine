export const siteName = "영양성분 안전성 근거 연구";
export const siteTagline =
  "보충제 복용 조건을 근거 문헌과 비교하는 졸업논문 연구";
export const siteDescription =
  "항응고제를 복용하거나 신장질환 위험이 있는 사람이 보충제를 먹을 때, 용량·상호작용·주의할 증상을 근거 문헌과 비교하는 졸업논문 연구 사이트입니다.";
export const siteKeywords = [
  "영양성분 안전성",
  "근거중심 약료",
  "체계적 문헌고찰",
  "약물 영양성분 상호작용",
  "졸업논문",
];

export function getSiteUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

  return new URL(rawUrl);
}
