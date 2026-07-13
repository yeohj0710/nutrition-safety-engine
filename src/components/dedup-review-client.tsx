"use client";
import { useEffect, useMemo, useState } from "react";
import type { DedupReviewBundle } from "@/src/lib/dedup-review";

type Approval = { bundleId: string; decision: "approve_agent_recommendation"; approvedAt: string };
const STORAGE_KEY = "nutrition-safety-dedup-review-v1";

export function DedupReviewClient({ bundles }: { bundles: DedupReviewBundle[] }) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => { const timer = window.setTimeout(() => { const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Approval[]; setApprovals(stored); const index = bundles.findIndex(x => !stored.some(y => y.bundleId === x.id)); if (index >= 0) setActiveIndex(index); }, 0); return () => window.clearTimeout(timer); }, [bundles]);
  const completed = useMemo(() => new Set(approvals.map(x => x.bundleId)), [approvals]);
  const active = bundles[activeIndex];
  const allDone = completed.size === bundles.length;
  function approve() { const next = [...approvals.filter(x => x.bundleId !== active.id), { bundleId: active.id, decision: "approve_agent_recommendation" as const, approvedAt: new Date().toISOString() }]; setApprovals(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); const index = bundles.findIndex(x => !next.some(y => y.bundleId === x.id)); if (index >= 0) setActiveIndex(index); }
  function download() { const blob = new Blob([JSON.stringify({ schema: "dedup-human-approval-v1", exportedAt: new Date().toISOString(), approvals }, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "dedup-review-approval.json"; link.click(); URL.revokeObjectURL(link.href); }
  if (!active) return null;
  return <main className="min-h-[75vh] bg-[#f9fafb] px-5 py-12 text-[#191f28] sm:px-8 sm:py-16"><div className="mx-auto max-w-[900px]">
    <header className="mb-9 max-w-3xl"><p className="mb-3 text-lg font-bold text-[#3182f6]">중복 문헌 검토</p><h1 className="text-[32px] font-bold leading-[1.35] tracking-[-0.02em] sm:text-[44px]">342쌍은 미리 확인했습니다.<br />두 가지 결정만 승인해 주세요.</h1><p className="mt-5 text-base font-medium leading-7 text-[#6b7684] sm:text-lg">서지정보 일치 수준에 따라 합칠 문헌과 보존할 문헌을 나눴습니다.</p></header>
    {allDone ? <section className="rounded-[28px] bg-white px-6 py-14 text-center sm:px-10 sm:py-20" role="status"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#e8f8f2] text-4xl font-bold text-[#008c63]">✓</span><p className="mt-7 text-lg font-bold text-[#008c63]">2 / 2 완료</p><h2 className="mt-3 text-[30px] font-bold sm:text-[38px]">중복 문헌 검토가 완료됐습니다.</h2><p className="mx-auto mt-4 max-w-lg text-base font-medium leading-7 text-[#6b7684]">승인 기록을 내려받아 연구자에게 전달해 주세요.</p><button onClick={download} className="mt-8 rounded-2xl bg-[#191f28] px-7 py-4 text-base font-bold text-white">승인 기록 내려받기</button></section> : <>
      <div className="mb-5 flex items-center gap-4"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e5e8eb]"><div className="h-full rounded-full bg-[#3182f6]" style={{width:`${((activeIndex+1)/bundles.length)*100}%`}} /></div><strong className="text-sm text-[#4e5968]">{activeIndex+1} / {bundles.length}</strong></div>
      <section className="rounded-[28px] bg-white p-6 sm:p-9"><span className="rounded-full bg-[#e8f3ff] px-3 py-1 text-xs font-bold text-[#1b64da]">{active.affectedCount}쌍</span><h2 className="mt-4 text-2xl font-bold sm:text-[30px]">{active.title}</h2><p className="mt-3 text-base leading-7 text-[#4e5968]">{active.finding}</p><div className="my-7 border-y border-[#e5e8eb] py-7"><p className="text-sm font-bold text-[#3182f6]">사전검토 권고안</p><p className="mt-2 text-lg font-bold leading-8">{active.recommendation}</p><div className="mt-5 space-y-2">{active.reasons.map(reason=><div key={reason} className="flex gap-3 rounded-2xl bg-[#f9fafb] p-4 text-sm font-semibold"><span className="text-[#3182f6]">✓</span>{reason}</div>)}</div></div><button onClick={approve} className="w-full rounded-2xl bg-[#3182f6] px-7 py-4 text-base font-bold text-white">이 권고안으로 승인하고 다음</button></section>
    </>}
  </div></main>;
}
