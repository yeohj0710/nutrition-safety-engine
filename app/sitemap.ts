import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/src/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", getSiteUrl()).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
