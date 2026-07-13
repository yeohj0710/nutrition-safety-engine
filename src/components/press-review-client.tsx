"use client";

import { useEffect, useMemo, useState } from "react";

import type { PressReviewBundle } from "@/src/lib/press-review";

type Approval = {
  bundleId: string;
  decision: "approve_agent_recommendation" | "approve_with_revision";
  note: string;
  approvedAt: string;
  reviewerRole: "PRESS reviewer";
};

const STORAGE_KEY = "nutrition-safety-press-review-v1";

function loadApprovals(): Approval[] {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as Approval[];
  } catch {
    return [];
  }
}

export function PressReviewClient({ bundles }: { bundles: PressReviewBundle[] }) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [note, setNote] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = loadApprovals();
      setApprovals(stored);
      const firstOpen = bundles.findIndex((bundle) => !stored.some((item) => item.bundleId === bundle.id));
      if (firstOpen >= 0) setActiveIndex(firstOpen);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bundles]);

  const completed = useMemo(() => new Set(approvals.map((item) => item.bundleId)), [approvals]);
  const active = bundles[activeIndex];
  const allDone = completed.size === bundles.length;

  function approve() {
    if (!active) return;
    const record: Approval = {
      bundleId: active.id,
      decision: note.trim() ? "approve_with_revision" : "approve_agent_recommendation",
      note: note.trim(),
      approvedAt: new Date().toISOString(),
      reviewerRole: "PRESS reviewer",
    };
    const next = [...approvals.filter((item) => item.bundleId !== active.id), record];
    setApprovals(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setNote("");
    const nextIndex = bundles.findIndex((bundle) => !next.some((item) => item.bundleId === bundle.id));
    if (nextIndex >= 0) setActiveIndex(nextIndex);
  }

  function download() {
    const blob = new Blob([JSON.stringify({ schema: "press-human-approval-v1", exportedAt: new Date().toISOString(), approvals }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "press-review-approval.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!active) return null;

  return (
    <main className="min-h-[75vh] bg-[#f9fafb] px-5 py-12 text-[#191f28] sm:px-8 sm:py-16">
      <div className="mx-auto max-w-[900px]">
        <header className="mb-9 max-w-3xl">
          <p className="mb-3 text-lg font-bold text-[#3182f6]">PRESS 검색식 검토</p>
          <h1 className="text-[32px] font-bold leading-[1.35] tracking-[-0.02em] sm:text-[44px]">검토는 미리 끝냈습니다.<br />권고안만 확인해 주세요.</h1>
          <p className="mt-5 text-base font-medium leading-7 text-[#6b7684] sm:text-lg">48개 항목을 질문별 6개로 묶었습니다. 각 권고안을 읽고 승인하면 바로 다음 항목으로 넘어갑니다.</p>
        </header>

        {allDone ? (
          <section className="rounded-[28px] bg-white px-6 py-14 text-center sm:px-10 sm:py-20" role="status">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#e8f8f2] text-4xl font-bold text-[#008c63]">✓</span>
            <p className="mt-7 text-lg font-bold text-[#008c63]">6 / 6 완료</p>
            <h2 className="mt-3 text-[30px] font-bold sm:text-[38px]">PRESS 검토 승인이 완료됐습니다.</h2>
            <p className="mx-auto mt-4 max-w-lg text-base font-medium leading-7 text-[#6b7684]">사람 승인 기록과 시각이 이 브라우저에 저장됐습니다. 기록 파일을 내려받아 연구자에게 전달해 주세요.</p>
            <button type="button" onClick={download} className="mt-8 rounded-2xl bg-[#191f28] px-7 py-4 text-base font-bold text-white">승인 기록 내려받기</button>
          </section>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-4" aria-label={`${bundles.length}개 중 ${activeIndex + 1}번째`}>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e5e8eb]"><div className="h-full rounded-full bg-[#3182f6] transition-all" style={{ width: `${((activeIndex + 1) / bundles.length) * 100}%` }} /></div>
              <strong className="text-sm text-[#4e5968]">{activeIndex + 1} / {bundles.length}</strong>
            </div>

            <section className="rounded-[28px] bg-white p-6 sm:p-9">
              <div className="border-b border-[#e5e8eb] pb-7">
                <span className="rounded-full bg-[#e8f3ff] px-3 py-1 text-xs font-bold text-[#1b64da]">{active.question}</span>
                <h2 className="mt-4 text-2xl font-bold sm:text-[30px]">{active.title}</h2>
                <p className="mt-3 text-base leading-7 text-[#4e5968]">{active.finding}</p>
              </div>

              <div className="py-7">
                <p className="text-sm font-bold text-[#3182f6]">사전검토 권고안</p>
                <p className="mt-2 text-lg font-bold leading-8">{active.recommendation}</p>
                <div className="mt-5 space-y-2">{active.reasons.map((reason) => <div key={reason} className="flex gap-3 rounded-2xl bg-[#f9fafb] p-4 text-sm font-semibold leading-6"><span className="text-[#3182f6]">✓</span><span>{reason}</span></div>)}</div>
              </div>

              <details className="rounded-2xl border border-[#e5e8eb] p-4"><summary className="text-sm font-bold text-[#4e5968]">수정 의견이 있을 때만 열기</summary><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="수정할 내용만 적어 주세요." rows={3} className="mt-4 w-full rounded-2xl border border-[#d1d6db] p-4 text-sm leading-6 outline-none focus:border-[#3182f6]" /></details>

              <div className="mt-6 text-xs leading-5 text-[#8b95a1]">대상: {active.affectedRows.join(", ")}<br />근거 파일: {active.sourcePath}</div>
              <button type="button" onClick={approve} className="mt-7 w-full rounded-2xl bg-[#3182f6] px-7 py-4 text-base font-bold text-white hover:bg-[#1b64da]">이 권고안으로 승인하고 다음</button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
