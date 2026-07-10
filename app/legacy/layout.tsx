import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "legacy_unverified 데모",
  robots: { index: false, follow: false, noarchive: true },
};

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
