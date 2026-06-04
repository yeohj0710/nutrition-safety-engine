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
  const intakeFlow = [
    {
      title: "상담 전 약물 확인",
      detail: "와파린, 퀴놀론계, 이뇨제처럼 영양소와 부딪힐 수 있는 약을 먼저 봅니다.",
    },
    {
      title: "질환과 생활 상태 확인",
      detail: "신장결석, 만성콩팥병, 임신·수유처럼 섭취 기준을 낮춰 봐야 하는 조건을 더합니다.",
    },
    {
      title: "상담 순서 정리",
      detail: "바로 설명할 기준, 함께 보여 줄 근거, 추가 질문을 나눠 상담 순서를 만듭니다.",
    },
  ];
  const clinicalStats = [
    ["문헌 검색", formatCount(literatureSummary.latestPubMedHitCount), "PubMed/MEDLINE"],
    ["저장 문헌", formatCount(literatureSummary.latestPubMedStoredRecords), "제목과 초록 확인"],
    ["먼저 볼 문헌", formatCount(literatureSummary.priorityCandidateCount), "상담 전 우선 검토"],
    ["바로 확인할 기준", formatCount(metadata.meta.safetyRuleCount), `근거 출처 ${formatCount(metadata.meta.sourceCount)}개`],
  ];

  return (
    <main className="app-page min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-5">
        <section className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="rounded-[0.75rem] border border-emerald-900/15 bg-emerald-950 px-5 py-5 text-white shadow-sm">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-emerald-200">
              상담 흐름
            </p>
            <ol className="mt-5 grid gap-4">
              {intakeFlow.map((step, index) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-l border-emerald-300/35 pl-3"
                >
                  <span className="flex h-8 w-8 -translate-x-[1.65rem] items-center justify-center rounded-full bg-emerald-200 text-xs font-bold text-emerald-950">
                    {index + 1}
                  </span>
                  <span className="-ml-6 min-w-0">
                    <span className="block text-sm font-semibold">
                      {step.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-emerald-100/85">
                      {step.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </aside>

          <section className="rounded-[0.75rem] border border-emerald-900/15 bg-white px-5 py-5 shadow-sm md:px-7 md:py-7">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-end">
              <div>
                <p className="text-[0.76rem] font-bold text-emerald-800">
                  약물과 질환을 먼저 확인
                </p>
                <h1 className="mt-2 break-keep text-[1.7rem] font-bold leading-tight text-emerald-950 md:text-[2.25rem]">
                  {siteName}
                </h1>
                <p className="mt-4 max-w-3xl text-[0.96rem] leading-7 text-stone-700">
                  {siteDescription}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link
                    href="#explorer"
                    className="inline-flex min-h-11 items-center justify-center rounded-[0.55rem] bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-emerald-700"
                  >
                    상담 조건 입력
                  </Link>
                  <Link
                    href="/sources"
                    className="inline-flex min-h-11 items-center justify-center rounded-[0.55rem] border border-emerald-900/20 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-950 transition duration-200 hover:bg-emerald-100"
                  >
                    근거 출처 보기
                  </Link>
                </div>
              </div>

              <div className="rounded-[0.65rem] border border-emerald-900/15 bg-emerald-50/80 p-3">
                <p className="text-xs font-semibold text-emerald-900">
                  상담 전 확인표
                </p>
                <div className="mt-3 grid gap-2">
                  {["복용 약물", "질환 상태", "섭취량", "복용 기간"].map(
                    (item) => (
                      <div
                        key={item}
                        className="grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 text-sm text-emerald-950"
                      >
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-700" />
                        <span>{item}</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {clinicalStats.map(([label, value, note]) => (
            <div
              key={label}
              className="rounded-[0.55rem] border border-emerald-900/15 bg-white px-4 py-4 shadow-sm"
            >
              <p className="text-xs font-semibold text-emerald-800">{label}</p>
              <p className="mt-2 text-2xl font-bold text-emerald-950">
                {value}
              </p>
              <p className="mt-1 text-xs leading-5 text-stone-600">{note}</p>
            </div>
          ))}
        </section>

        <section id="explorer" className="scroll-mt-6">
          <RuleExplorerClient metadata={metadata} />
        </section>
      </div>
    </main>
  );
}
