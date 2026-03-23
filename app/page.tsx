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
      text: "일반명이나 자주 쓰는 표기만 넣어도 바로 시작할 수 있습니다.",
    },
    {
      title: "2. 필요한 정보만 추가",
      text: "약물이나 질환 정보는 필요할 때만 더해 결과를 좁히면 됩니다.",
    },
    {
      title: "3. 결과 먼저 확인",
      text: "중요한 판단을 먼저 보고, 세부 근거는 필요할 때만 펼쳐보면 됩니다.",
    },
  ];

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex max-w-[74rem] flex-col gap-6">
        <section className="surface-card overflow-hidden rounded-[1.75rem]">
          <div className="grid gap-8 px-6 py-6 md:px-8 md:py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
            <div className="space-y-6">
              <p className="eyebrow text-muted">증거 기반 확인</p>
              <div className="space-y-4">
                <h1 className="max-w-[13ch] text-[clamp(2.5rem,6vw,4.8rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-foreground">
                  {siteName}
                </h1>
                <p className="measure-copy text-[1.04rem] leading-8 text-muted sm:text-[1.08rem]">
                  {siteDescription}
                </p>
                <p className="measure-copy text-sm leading-7 text-muted">
                  성분 하나만 먼저 입력하고 시작하세요. 더 정확한 판단이 필요할 때만
                  약물이나 상태 정보를 추가하면 됩니다.
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

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.25rem] border border-border-subtle bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    중요한 내용 먼저
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    가장 중요한 판단을 먼저 보여줍니다.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-border-subtle bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    세부 내용은 나중에
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    필요할 때만 펼쳐서 더 자세히 볼 수 있습니다.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-border-subtle bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    근거 연결
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    모든 결과에서 출처로 바로 이동할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>

            <aside className="rounded-[1.4rem] border border-border-subtle bg-background/80 p-5">
              <p className="eyebrow text-muted">이용 방법</p>
              <div className="mt-4 space-y-3">
                {quickSteps.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[1.05rem] border border-border-subtle bg-white px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{item.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[1.05rem] border border-border-subtle bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  범위
                </p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted">출처</p>
                    <p className="mt-1 font-semibold text-foreground">
                      {metadata.meta.sourceCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted">근거 청크</p>
                    <p className="mt-1 font-semibold text-foreground">
                      {metadata.meta.evidenceChunkCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted">규칙</p>
                    <p className="mt-1 font-semibold text-foreground">
                      {metadata.meta.safetyRuleCount}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section id="explorer" className="scroll-mt-8 space-y-4">
          <div className="max-w-[60ch] space-y-2">
            <p className="eyebrow text-muted">탐색</p>
            <h2 className="text-[clamp(1.5rem,3vw,2.2rem)] font-semibold leading-tight tracking-[-0.04em] text-foreground">
              결과를 먼저 보고, 필요한 세부 내용만 펼쳐보세요.
            </h2>
          </div>
          <RuleExplorerClient metadata={metadata} />
        </section>
      </div>
    </main>
  );
}
