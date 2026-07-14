"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScreeningPrereviewBundle } from "@/src/lib/pubmed-screening-prereview";

type ValidationEvent = { bundleId: string; questionId: string; decision: "approve_agent_prereview_for_human_workflow"; validatedAt: string };
const STORAGE_KEY = "nutrition-safety-pubmed-agent-prereview-validation-v1";

export function PubMedScreeningPrereviewClient({ bundles, uniqueRecords }: { bundles: ScreeningPrereviewBundle[]; uniqueRecords: number }) {
  const [events, setEvents] = useState<ValidationEvent[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as ValidationEvent[];
      setEvents(saved);
      const nextIndex = bundles.findIndex((bundle) => !saved.some((event) => event.bundleId === bundle.id));
      if (nextIndex >= 0) setActiveIndex(nextIndex);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bundles]);
  const completed = useMemo(() => new Set(events.map((event) => event.bundleId)), [events]);
  const done = completed.size === bundles.length;
  const active = bundles[activeIndex];

  function approve() {
    const next = [...events.filter((event) => event.bundleId !== active.id), {
      bundleId: active.id, questionId: active.questionId,
      decision: "approve_agent_prereview_for_human_workflow" as const,
      validatedAt: new Date().toISOString(),
    }];
    setEvents(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    const nextIndex = bundles.findIndex((bundle) => !next.some((event) => event.bundleId === bundle.id));
    if (nextIndex >= 0) setActiveIndex(nextIndex);
  }

  function download() {
    const payload = {
      schema_version: "1.0.0",
      approval_type: "pubmed_agent_prereview_bundle_validation",
      reviewer_identity: "portal_reviewer_identity_not_captured",
      identity_status: "identity_not_captured",
      validation_events: events,
      bundles_validated: events.length,
      unique_records_in_scope: uniqueRecords,
      human_individual_screening_decisions_recorded: 0,
      independent_reviewers_completed: 0,
      limitation: "Bundle validation events do not constitute independent dual screening or individual eligibility decisions.",
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "pubmed-screening-agent-prereview-approval.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!active) return null;
  return <main className="min-h-[78vh] bg-[#f9fafb] px-6 py-20 text-[#191f28] sm:px-8 sm:py-28">
    <div className="mx-auto max-w-[860px]">
      <header className="max-w-[760px]">
        <p className="text-lg font-bold leading-[1.3] text-[#3182f6] sm:text-[22px]">PubMed 사전검토</p>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.4] tracking-[-0.02em] sm:text-[46px]">{uniqueRecords.toLocaleString("ko-KR")}건 사전분류를 마쳤습니다.<br />질문별 권고안만 확인해 주세요.</h1>
        <p className="mt-6 max-w-[650px] text-base font-semibold leading-[1.6] text-[#6b7684] sm:text-xl">버튼을 누르면 다음 질문으로 바로 넘어갑니다. 사전분류 승인과 개별 문헌의 포함·제외 결정은 구분해 기록합니다.</p>
      </header>
      {done ? <section className="mt-12 bg-white px-6 py-16 text-center sm:px-12 sm:py-20" role="status">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f8f2] text-3xl font-bold text-[#008c63]">✓</div>
        <p className="mt-7 text-lg font-bold text-[#008c63]">5 / 5 완료</p>
        <h2 className="mt-3 text-[28px] font-bold leading-[1.4] sm:text-[38px]">질문별 사전분류 검수가 끝났습니다.</h2>
        <p className="mx-auto mt-4 max-w-[600px] text-base font-semibold leading-7 text-[#6b7684]">검수 이벤트 5건을 저장합니다. 담당자 신원은 수집하지 않았으며, 독립 검토자 2인의 선별 완료로 기록하지 않습니다.</p>
        <button onClick={download} className="mt-8 rounded-2xl bg-[#191f28] px-7 py-4 font-bold text-white">승인 기록 내려받기</button>
      </section> : <>
        <div className="mt-12 flex items-center gap-4"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e5e8eb]"><div className="h-full rounded-full bg-[#3182f6] transition-[width]" style={{ width: `${((activeIndex + 1) / bundles.length) * 100}%` }} /></div><strong className="text-sm text-[#4e5968]">{activeIndex + 1} / {bundles.length}</strong></div>
        <section className="mt-5 bg-white px-6 py-9 sm:px-10 sm:py-12">
          <span className="rounded-full bg-[#e8f3ff] px-3 py-1.5 text-sm font-bold text-[#1b64da]">{active.questionId}</span>
          <h2 className="mt-5 text-[26px] font-bold leading-[1.4] sm:text-[34px]">{active.title}</h2>
          <p className="mt-3 text-base font-semibold leading-7 text-[#6b7684]">{active.scope}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Count label="사람 선별로 진행" value={active.counts.advance} />
            <Count label="직접 확인 필요" value={active.counts.uncertain} />
            <Count label="제외 가능성 검수" value={active.counts.likelyExclude} />
          </div>
          <div className="mt-8 border-y border-[#e5e8eb] py-8"><p className="text-sm font-bold text-[#3182f6]">권고안</p><p className="mt-2 text-lg font-bold leading-8">{active.recommendation}</p><div className="mt-5 space-y-3">{active.safeguards.map((item) => <p key={item} className="bg-[#f9fafb] px-5 py-4 text-sm font-semibold leading-6 text-[#4e5968]">{item}</p>)}</div></div>
          <button onClick={approve} className="mt-8 w-full rounded-2xl bg-[#3182f6] px-7 py-4 text-base font-bold text-white transition-colors hover:bg-[#1b64da]">이 권고안으로 승인하고 다음</button>
        </section>
      </>}
    </div>
  </main>;
}

function Count({ label, value }: { label: string; value: number }) {
  return <div className="bg-[#f9fafb] px-5 py-5"><p className="text-sm font-semibold text-[#6b7684]">{label}</p><strong className="mt-2 block text-2xl text-[#333d4b]">{value.toLocaleString("ko-KR")}건</strong></div>;
}
