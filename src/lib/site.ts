export const siteName = "개인맞춤 영양 안전 가이드";
export const siteTagline =
  "연령, 성별, 복용 약물, 질환 상태에 맞는 영양 안전 기준과 근거를 함께 보는 안내";
export const siteDescription =
  "연령, 성별, 복용 약물, 질환 상태에 맞춰 영양소 섭취 기준, 주의사항, 참고할 내용을 확인하고 신뢰도 높은 논문과 공공 자료 레퍼런스를 함께 볼 수 있는 개인맞춤 영양 안전 안내 서비스입니다.";
export const siteKeywords = [
  "개인맞춤 영양 안전 가이드",
  "영양소 안전성",
  "영양소 섭취 기준",
  "영양제 주의사항",
  "영양제 상호작용",
  "복용 약물 영양제 상호작용",
  "영양제 논문 레퍼런스",
  "비타민 섭취 기준",
  "개인 맞춤 영양 정보",
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
