export const siteName = "영양성분 안전성 근거 연구";
export const siteTagline = "검증된 근거만 연결하는 졸업논문 연구 시스템";
export const siteDescription =
  "문헌 검색, 선별, 추출, 근거평가, 규칙 검증의 계보를 보존하고 검증된 연구 결과만 제공하는 영양성분 안전성 연구 시스템입니다.";
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
