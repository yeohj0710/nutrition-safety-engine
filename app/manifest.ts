import type { MetadataRoute } from "next";

import { siteDescription, siteName } from "@/src/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "영양 안전성 근거",
    description: siteDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#063a74",
    lang: "ko-KR",
    icons: [
      {
        src: "/yonsei-logo.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
