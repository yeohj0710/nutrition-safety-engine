import Link from "next/link";
import type { Metadata } from "next";

import literatureCandidateData from "@/src/generated/literature-candidates.json";
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

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

export default function Home() {
  const metadata = getExplorerMetadata();
  const literatureSummary = literatureCandidateData.summary;
  const stats = [
    ["문헌 검색", formatCount(literatureSummary.latestPubMedHitCount)],
    ["보조 검색", formatCount(literatureSummary.secondaryHitTotal)],
    ["먼저 볼 문헌", formatCount(literatureSummary.priorityCandidateCount)],
    ["바로 확인할 기준", formatCount(metadata.meta.safetyRuleCount)],
    ["근거 출처", formatCount(metadata.meta.sourceCount)],
  ];

  return (
    <main className="min-h-screen bg-white px-5 text-stone-950 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <section className="grid min-h-[58vh] place-items-center py-16 text-center md:py-24">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold text-emerald-700">
              약물과 질환을 먼저 확인
            </p>
            <h1 className="mt-4 break-keep text-[2.8rem] font-semibold leading-[1.04] md:text-[5.3rem]">
              {siteName}
            </h1>
            <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-stone-600 md:text-xl md:leading-9">
              {siteDescription}
            </p>
            <div className="mt-8 flex justify-center gap-5 text-[0.95rem] font-semibold">
              <Link href="#explorer" className="text-emerald-700 hover:underline">
                상담 조건 입력
              </Link>
              <Link href="/sources" className="text-stone-700 hover:underline">
                근거 출처 보기
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-stone-200 py-8">
          <dl className="grid gap-y-8 sm:grid-cols-5">
            {stats.map(([label, value]) => (
              <div key={label} className="text-center">
                <dt className="text-sm text-stone-500">{label}</dt>
                <dd className="mt-2 text-3xl font-semibold tracking-tight">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid gap-10 py-14 md:grid-cols-[18rem_minmax(0,1fr)] md:py-20">
          <div className="text-sm leading-7 text-stone-600">
            <p className="font-semibold text-stone-950">상담 흐름</p>
            <ol className="mt-5 space-y-4">
              <li>1. 복용 약을 먼저 확인</li>
              <li>2. 질환과 생활 상태를 추가</li>
              <li>3. 필요한 근거만 좁혀서 확인</li>
            </ol>
          </div>
          <div id="explorer" className="scroll-mt-6">
            <RuleExplorerClient metadata={metadata} />
          </div>
        </section>
      </div>
    </main>
  );
}
