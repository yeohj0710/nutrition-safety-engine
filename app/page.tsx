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
  const triageSteps = [
    {
      label: "1",
      title: "복용 약물",
      detail: "warfarin, quinolone, thiazide 등 상담 전 확인",
    },
    {
      label: "2",
      title: "질환 상태",
      detail: "신장결석, 만성콩팥병, 임신·수유 등 위험군 확인",
    },
    {
      label: "3",
      title: "상담 우선순위",
      detail: "먼저 볼 규칙, 함께 볼 근거, 추가 질문을 분리",
    },
  ];
  const scopeItems = [
    {
      label: "PubMed/MEDLINE",
      value: formatCount(literatureSummary.latestPubMedHitCount),
      note: `저장 ${formatCount(literatureSummary.latestPubMedStoredRecords)}건`,
    },
    {
      label: "보조 검색원",
      value: formatCount(literatureSummary.secondaryHitTotal),
      note: `대조 record ${formatCount(literatureSummary.secondaryStoredRecords)}건`,
    },
    {
      label: "우선검토 후보",
      value: formatCount(literatureSummary.priorityCandidateCount),
      note: `누적 후보 ${formatCount(literatureSummary.cumulativePubMedCandidates)}건`,
    },
    {
      label: "직접 판정 규칙",
      value: formatCount(metadata.meta.safetyRuleCount),
      note: `근거 출처 ${formatCount(metadata.meta.sourceCount)}개`,
    },
  ];

  return (
    <main className="app-page min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <section className="surface-card rounded-[0.95rem] px-4 py-4 md:px-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-stretch">
            <div className="flex min-w-0 flex-col justify-between gap-5">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase text-muted">
                  Clinical risk triage
                </p>
                <h1 className="mt-2 break-keep text-[1.28rem] font-semibold tracking-[-0.01em] text-foreground md:text-[1.55rem]">
                {siteName}
              </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                {siteDescription}
              </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="#explorer"
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-stone-950 px-4 py-[0.58rem] text-[0.84rem] font-medium text-white transition duration-200 hover:bg-stone-800"
                >
                  상담 조건 입력
                </Link>
                <Link
                  href="/sources"
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-border-subtle bg-white px-4 py-[0.58rem] text-[0.84rem] font-medium text-foreground transition duration-200 hover:border-stone-300"
                >
                  근거 출처
                </Link>
              </div>
            </div>

            <div className="rounded-[0.85rem] border border-border-subtle bg-white/82 p-3">
              <div className="grid gap-2">
                {triageSteps.map((step) => (
                  <div
                    key={step.label}
                    className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 rounded-[0.75rem] border border-stone-200 bg-stone-50/70 px-3 py-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-950 text-xs font-semibold text-white">
                      {step.label}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {step.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="surface-card rounded-[0.95rem] px-4 py-4 md:px-5">
          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
            <div>
              <p className="text-[0.76rem] font-semibold uppercase text-muted">
                상태 기반 연구 범위
              </p>
              <h2 className="mt-1 text-[1.02rem] font-semibold text-foreground">
                약물·질환 조건을 먼저 놓고 근거를 정렬합니다
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                항응고제 복용자와 신장 관련 고위험군을 중심으로 검색 로그,
                선별 결과, 화면용 후보문헌 수를 분리해 관리합니다.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
              {scopeItems.map((item, index) => (
                <div
                  key={item.label}
                  className={`min-w-0 rounded-[0.75rem] border px-3 py-3 ${
                    index === 2
                      ? "border-stone-300 bg-stone-950 text-white"
                      : "border-stone-200 bg-white"
                  }`}
                >
                  <dt
                    className={`text-[0.74rem] font-medium ${
                      index === 2 ? "text-stone-300" : "text-muted"
                    }`}
                  >
                    {item.label}
                  </dt>
                  <dd
                    className={`mt-1 text-[1.16rem] font-semibold ${
                      index === 2 ? "text-white" : "text-foreground"
                    }`}
                  >
                    {item.value}
                  </dd>
                  <dd
                    className={`mt-1 text-[0.76rem] leading-5 ${
                      index === 2 ? "text-stone-300" : "text-muted"
                    }`}
                  >
                    {item.note}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="explorer" className="scroll-mt-6">
          <RuleExplorerClient metadata={metadata} />
        </section>
      </div>
    </main>
  );
}
