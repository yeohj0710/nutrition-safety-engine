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
  const quickSteps = [
    {
      title: "1. 성분 입력",
      text: "표기 하나만 넣어도 바로 시작됩니다.",
    },
    {
      title: "2. 필요할 때만 추가",
      text: "약물·질환 정보는 필요할 때만 더하면 됩니다.",
    },
    {
      title: "3. 결과부터 확인",
      text: "핵심 판단을 먼저 보고 근거는 나중에 펼치세요.",
    },
  ];

  return (
    <main className="app-page min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="page-shell flex flex-col gap-6">
        <section className="surface-card overflow-hidden rounded-[1.75rem]">
          <div className="px-6 py-6 md:px-8 md:py-8">
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="eyebrow text-muted">증거 기반 확인</p>
                <h1 className="max-w-[22ch] text-[clamp(1.95rem,4.2vw,3.35rem)] font-semibold leading-[1] tracking-[-0.04em] text-foreground">
                  {siteName}
                </h1>
              </div>

              <div className="space-y-5">
                <div className="space-y-4">
                  <p className="max-w-[62ch] text-[1.02rem] leading-8 text-muted sm:text-[1.06rem]">
                    {siteDescription}
                  </p>
                  <p className="max-w-[58ch] text-sm leading-7 text-muted">
                    성분부터 입력하고, 필요할 때만 약물이나 상태 정보를 더하면 됩니다.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="#explorer"
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-accent-strong"
                  >
                    바로 확인하기
                  </Link>
                  <Link
                    href="/sources"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-subtle bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition duration-200 hover:-translate-y-0.5 hover:border-stone-300"
                  >
                    출처 보기
                  </Link>
                </div>

                <div className="rounded-[1.35rem] border border-border-subtle bg-background/72 px-4 py-4 md:px-5">
                  <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="eyebrow text-muted">이용 흐름</p>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        처음에는 성분만 넣고, 필요한 순간에만 조건을 더해 보세요.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-border-subtle bg-white px-3 py-1.5 text-muted">
                        출처 {metadata.meta.sourceCount}
                      </span>
                      <span className="rounded-full border border-border-subtle bg-white px-3 py-1.5 text-muted">
                        근거 청크 {metadata.meta.evidenceChunkCount}
                      </span>
                      <span className="rounded-full border border-border-subtle bg-white px-3 py-1.5 text-muted">
                        규칙 {metadata.meta.safetyRuleCount}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {quickSteps.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-[1.05rem] border border-border-subtle bg-white px-4 py-4"
                      >
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                    <div className="rounded-[1.25rem] border border-border-subtle bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        핵심 먼저
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        중요한 판단부터 바로 보여줍니다.
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] border border-border-subtle bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        세부는 나중에
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        필요할 때만 펼쳐 자세히 보면 됩니다.
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] border border-border-subtle bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        근거 바로가기
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        결과에서 출처로 바로 이동할 수 있습니다.
                      </p>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="explorer" className="scroll-mt-8 space-y-4">
          <div className="space-y-2">
            <p className="eyebrow text-muted">탐색</p>
            <h2 className="text-[clamp(1.35rem,2.4vw,1.9rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground xl:whitespace-nowrap">
              결과를 먼저 보고, 필요한 세부 내용만 펼쳐보세요.
            </h2>
          </div>
          <RuleExplorerClient metadata={metadata} />
        </section>
      </div>
    </main>
  );
}
