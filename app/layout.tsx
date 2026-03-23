import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "영양 안전 규칙 탐색기",
  description: "로컬 근거 데이터와 결정적 규칙 엔진으로 탐색하는 nutrition safety rule explorer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
