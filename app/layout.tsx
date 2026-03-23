import type { Metadata } from "next";
import { IBM_Plex_Sans_KR, Nanum_Myeongjo } from "next/font/google";

import { getSiteUrl, siteDescription, siteKeywords, siteName } from "@/src/lib/site";

import "./globals.css";

const bodyFont = IBM_Plex_Sans_KR({
  variable: "--font-app-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  preload: false,
});

const displayFont = Nanum_Myeongjo({
  variable: "--font-app-display",
  display: "swap",
  weight: ["400", "700", "800"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  applicationName: siteName,
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: siteKeywords,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName,
    title: siteName,
    description: siteDescription,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: siteName,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "health",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
