"use client";

import { useEffect, useMemo, useState } from "react";

import type { ReviewTask } from "@/src/lib/research-review";

type ReviewRecord = {
  taskId: string;
  reviewerName: string;
  reviewerRole: string;
  decision: string;
  checks: boolean[];
  note: string;
  decidedAt: string;
};

const STORAGE_KEY = "nutrition-safety-research-review-v1";

function loadRecords(): ReviewRecord[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as ReviewRecord[]) : [];
  } catch {
    return [];
  }
}

export function ResearchReviewClient({ tasks }: { tasks: ReviewTask[] }) {
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [activeId, setActiveId] = useState(tasks[0]?.id ?? "");
  const [reviewerName] = useState("지도 담당자");
  const [reviewerRole, setReviewerRole] = useState(tasks[0]?.reviewerRole ?? "");
  const [decision, setDecision] = useState("approve");
  const [checks, setChecks] = useState<boolean[]>(tasks[0]?.checks.map(() => true) ?? []);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setRecords(loadRecords()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const activeTask = tasks.find((task) => task.id === activeId) ?? tasks[0];
  const completedIds = useMemo(() => new Set(tasks.filter((task) => {
    const reviewers = new Set(records.filter((record) => record.taskId === task.id).map((record) => record.reviewerName));
    return reviewers.size >= (task.requiresIndependentReviewers ?? 1);
  }).map((task) => task.id)), [records, tasks]);
  const completed = completedIds.size;
  const activeNumber = Math.max(tasks.findIndex((task) => task.id === activeTask.id) + 1, 1);

  function selectTask(task: ReviewTask) {
    setActiveId(task.id);
    setReviewerRole(task.reviewerRole);
    setDecision("approve");
    setChecks(task.checks.map(() => true));
    setNote("");
    setMessage("");
  }

  if (!activeTask) return null;

  function saveRecord() {
    const finalDecision = note.trim() ? "approve_with_amendment" : decision;
    const record: ReviewRecord = {
      taskId: activeTask.id,
      reviewerName: reviewerName.trim(),
      reviewerRole,
      decision: finalDecision,
      checks,
      note: note.trim(),
      decidedAt: new Date().toISOString(),
    };
    const next = [...records.filter((item) => !(item.taskId === activeTask.id && item.reviewerName === record.reviewerName)), record];
    setRecords(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setMessage("검토 기록을 저장했습니다.");
    const nextTask = tasks.find((task) => {
      const reviewers = new Set(next.filter((item) => item.taskId === task.id).map((item) => item.reviewerName));
      return reviewers.size < (task.requiresIndependentReviewers ?? 1);
    });
    if (nextTask) window.setTimeout(() => selectTask(nextTask), 500);
  }

  function exportRecords() {
    const payload = {
      schema: "nutrition-safety-research-review-v1",
      exportedAt: new Date().toISOString(),
      records,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "research-review-records.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="bg-[#f9fafb] px-5 py-12 text-[#191f28] sm:px-8 sm:py-16">
      <div className="mx-auto max-w-[1049px]">
        <header className="mb-10 max-w-3xl">
          <p className="mb-3 text-lg font-bold text-[#3182f6]">내부 연구 검토</p>
          <h1 className="text-[32px] font-bold leading-[1.35] tracking-[-0.02em] sm:text-[44px]">세 가지만 확인하면<br />연구 진행 승인이 끝납니다.</h1>
          <p className="mt-5 text-base font-medium leading-7 text-[#6b7684] sm:text-lg">검토할 내용을 미리 묶어 정리했습니다. 내용을 읽고 아래 승인 버튼만 누르면 다음 항목으로 넘어갑니다.</p>
        </header>

        {completed === tasks.length ? (
          <section className="mx-auto max-w-[760px] rounded-[28px] bg-white px-6 py-14 text-center sm:px-10 sm:py-20" role="status" aria-live="polite">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#e8f8f2] text-4xl font-bold text-[#008c63]">✓</span>
            <p className="mt-7 text-lg font-bold text-[#008c63]">3 / 3 완료</p>
            <h2 className="mt-3 text-[30px] font-bold tracking-[-0.02em] sm:text-[38px]">연구 진행 승인이 완료됐습니다.</h2>
            <p className="mx-auto mt-4 max-w-lg text-base font-medium leading-7 text-[#6b7684]">세 항목의 승인 기록과 승인 시각이 이 브라우저에 저장됐습니다. 아래 버튼으로 기록 파일을 보관할 수 있습니다.</p>
            <button type="button" onClick={exportRecords} className="mt-8 rounded-2xl bg-[#191f28] px-7 py-4 text-base font-bold text-white hover:bg-[#333d4b]">승인 기록 내려받기</button>
          </section>
        ) : (
        <>
        <div className="mb-5 flex items-center gap-4" aria-label={`${tasks.length}개 중 ${activeNumber}번째`}>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e5e8eb]"><div className="h-full rounded-full bg-[#3182f6] transition-all" style={{ width: `${(activeNumber / tasks.length) * 100}%` }} /></div>
          <strong className="text-sm text-[#4e5968]">{activeNumber} / {tasks.length}</strong>
        </div>

        <section className="mx-auto max-w-[760px] rounded-[28px] bg-white p-6 sm:p-9">
            <div className="border-b border-[#e5e8eb] pb-7">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#e8f3ff] px-3 py-1 text-xs font-bold text-[#1b64da]">{activeTask.id}</span><span className="text-sm font-semibold text-[#6b7684]">{activeTask.reviewerRole} 확인</span></div>
              <h2 className="mt-4 text-2xl font-bold sm:text-[30px]">{activeTask.title}</h2>
              <p className="mt-3 text-base leading-7 text-[#4e5968]">{activeTask.summary}</p>
              <a href={`https://github.com/yeohj0710/nutrition-safety-engine/blob/main/${activeTask.artifact}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex break-all text-sm font-bold text-[#3182f6] underline underline-offset-4" aria-label={`${activeTask.artifact} 원본 보기`}>원본 열기: {activeTask.artifact}</a>
            </div>

            <div className="py-7">
              <h3 className="text-lg font-bold">이 내용으로 진행합니다</h3>
              <div className="mt-4 space-y-3">
                {activeTask.checks.map((label) => (
                  <div key={label} className="flex gap-3 rounded-2xl bg-[#f9fafb] p-4 text-[15px] font-semibold leading-6">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3182f6] text-sm text-white">✓</span><span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <details className="mt-6 rounded-2xl border border-[#e5e8eb] p-4"><summary className="text-sm font-bold text-[#4e5968]">수정할 내용이 있을 때만 열기</summary><label className="mt-4 block text-sm font-bold">수정 요청<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="수정할 내용만 간단히 남겨 주세요." rows={3} className="mt-2 w-full resize-y rounded-2xl border border-[#d1d6db] px-4 py-3.5 font-medium leading-6 outline-none focus:border-[#3182f6]" /></label></details>

            <div className="mt-7 rounded-2xl bg-[#f5f6f8] p-4 text-sm leading-6 text-[#4e5968]"><strong className="text-[#191f28]">이 결정이 필요한 이유</strong><br />다음 단계: {activeTask.blocks}.{activeTask.requiresIndependentReviewers ? ` 독립 검토자 ${activeTask.requiresIndependentReviewers}명의 실제 기록이 필요합니다.` : ""}</div>

            {message ? <p role="status" className="mt-5 text-sm font-bold text-[#1b64da]">{message}</p> : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button type="button" onClick={exportRecords} disabled={!records.length} className="rounded-2xl px-5 py-3.5 text-sm font-bold text-[#4e5968] disabled:opacity-40">기록 JSON 내보내기</button>
              <button type="button" onClick={saveRecord} className="rounded-2xl bg-[#3182f6] px-7 py-4 text-base font-bold text-white hover:bg-[#1b64da]">이 내용으로 승인하고 다음</button>
            </div>
        </section>
        </>
        )}
      </div>
    </main>
  );
}
