import Link from "next/link";
import type { Metadata } from "next";

import { RuleExplorerClient } from "@/src/components/rule-explorer-client";
import { getExplorerMetadata } from "@/src/lib/knowledge";
import { siteDescription, siteName } from "@/src/lib/site";

export const metadata: Metadata = {
  title: siteName,
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  const metadata = getExplorerMetadata();

  return (
    <main className="app-page min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="page-shell flex flex-col gap-4">
        <section className="surface-card rounded-[1.15rem] px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                {siteName}
              </h1>
              <p className="mt-1 text-sm leading-6 text-muted">{siteDescription}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/ingredients"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-border-subtle bg-white px-4 py-2 text-sm font-semibold text-foreground transition duration-200 hover:border-stone-300"
              >
                영양소별 레퍼런스
              </Link>
              <Link
                href="/sources"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-border-subtle bg-white px-4 py-2 text-sm font-semibold text-foreground transition duration-200 hover:border-stone-300"
              >
                출처 보기
              </Link>
            </div>
          </div>
        </section>

        <section id="explorer" className="scroll-mt-6">
          <RuleExplorerClient metadata={metadata} />
        </section>
      </div>
    </main>
  );
}
