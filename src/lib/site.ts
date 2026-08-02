export const siteName = "영양성분 안전성 근거 연구";
export const siteTagline =
  "다섯 임상 상황의 PubMed 근거 기록을 찾아보는 졸업논문 연구";
export const siteDescription =
  "수술 전후, 만성콩팥병, 임신, 간질환, 항응고 치료 상황에서 연령·약물·용량·성별·질환 표현이 보고된 PubMed 근거 기록을 찾아보는 졸업논문 연구 사이트입니다.";
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
