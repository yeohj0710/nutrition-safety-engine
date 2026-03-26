import type { Metadata } from "next";
import Link from "next/link";

import { SourceBrowserClient } from "@/src/components/source-browser-client";
import { getExplorerMetadata, getSourceBrowseData } from "@/src/lib/knowledge";

export const metadata: Metadata = {
  title: "출처 브라우저",
  description:
    "서비스에 연결된 논문, 공공 자료, 안전성 출처를 기준별로 찾아볼 수 있습니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SourcesPage() {
  const metadata = getExplorerMetadata();
  const sources = getSourceBrowseData();

  return (
    <main className="app-page min-h-screen px-4 pb-20 pt-6 md:px-6 lg:px-8">
      <div className="page-shell space-y-8">
        <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.12fr)_15rem] 2xl:items-end">
          <div className="surface-card-strong rounded-[2.1rem] px-6 py-7 md:px-8 md:py-9">
            <p className="eyebrow">Sources</p>
            <h1 className="mt-5 font-display text-[clamp(2.6rem,5vw,4.6rem)] leading-[0.96] tracking-[-0.05em] text-foreground">
              출처 브라우저
            </h1>
            <p className="measure-copy mt-5 text-base leading-7 text-muted">
              규칙에 연결된 논문, 공공 문서, 안전성 자료를 한눈에 살펴보고,
              발행기관과 관할권, 근거 수준을 기준으로 빠르게 좁혀 보세요.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-accent-strong"
              >
                메인 탐색으로 돌아가기
              </Link>
            </div>
          </div>

          <aside className="surface-card rounded-[1.8rem] px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Coverage
            </p>
            <p className="mt-4 font-display text-4xl tracking-[-0.04em] text-foreground">
              {sources.length}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              출처별로 연결된 규칙 수와 근거 청크 수를 함께 확인할 수 있습니다.
            </p>
            <p className="mt-4 text-xs leading-5 text-muted">
              관할권 {metadata.jurisdictions.length}개 · 근거 수준{" "}
              {metadata.sourceEvidenceLevels.length}종
            </p>
          </aside>
        </section>

        <SourceBrowserClient
          sources={sources}
          jurisdictions={metadata.jurisdictions}
          evidenceLevels={metadata.sourceEvidenceLevels}
        />
      </div>
    </main>
  );
}
