import type { MetadataRoute } from "next";

import { siteDescription, siteName } from "@/src/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "영양 안전 가이드",
    description: siteDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ee",
    theme_color: "#dae6d4",
    lang: "ko-KR",
    icons: [
      {
        src: "/icon",
        sizes: "64x64",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
