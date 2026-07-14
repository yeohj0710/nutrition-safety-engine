"use client";

import { useState } from "react";
import type { finalValidationBundles, finalValidationEvidence } from "@/src/lib/final-research-validation";

type Bundle = (typeof finalValidationBundles)[number];
type Evidence = typeof finalValidationEvidence;
const KEY = "nutrition-safety-final-research-validation-v1";

export function FinalResearchValidationClient({ bundles, evidence }: { bundles: readonly Bundle[]; evidence: Evidence }) {
  const [approvedAt, setApprovedAt] = useState<string | null>(() => typeof window === "undefined" ? null : localStorage.getItem(KEY));

  function approveAll() {
    const at = new Date().toISOString();
    localStorage.setItem(KEY, at);
    setApprovedAt(at);
  }

  function download() {
    const payload = {
      schema_version: "1.0.0",
      approval_type: "single_reviewer_portal_validation_of_agent_research_recommendations",
      reviewer_identity: "portal_reviewer_identity_not_captured",
      identity_status: "identity_not_captured",
      decision: "approve_agent_recommendations_as_provisional_research_working_basis",
      bundles_validated: bundles.map((bundle) => bundle.id),
      evidence,
      approved_at: approvedAt,
      human_individual_decisions_recorded: 0,
      independent_reviewers_completed: 0,
      final_search_claim_allowed: false,
      research_complete: false,
      limitation: "One portal validation event does not establish individual screening, independent dual review, final RoB, GRADE, expert review, usability completion, or final search completion.",
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "final-agent-research-recommendations-approval.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <main className="min-h-screen bg-[#f9fafb] px-6 py-20 text-[#191f28] sm:px-8 sm:py-28">
    <div className="mx-auto max-w-[920px]">
      <p className="text-lg font-bold text-[#3182f6] sm:text-[22px]">최종 통합 검토</p>
      <h1 className="mt-3 text-[30px] font-bold leading-[1.35] sm:text-[48px]">연구 권고안을 한 번에<br />확인하고 승인해 주세요</h1>
      <p className="mt-6 max-w-[720px] text-[16px] font-semibold leading-7 text-[#6b7684] sm:text-[19px] sm:leading-8">Codex가 검색 결과 정리부터 원문 근거 추출, RoB·GRADE 준비까지 마쳤습니다. 아래 다섯 묶음을 한 화면에서 확인한 뒤 버튼 한 번으로 승인할 수 있습니다.</p>

      <section className="mt-12 grid gap-3 sm:grid-cols-4">
        {[['19,619','PubMed 문헌'],['35','공개 원문'],['144','수치 후보'],['5','연구 질문']].map(([value,label]) => <div key={label} className="rounded-3xl bg-white px-6 py-6"><strong className="text-[28px]">{value}</strong><p className="mt-1 text-sm font-semibold text-[#6b7684]">{label}</p></div>)}
      </section>

      <div className="mt-10 overflow-hidden rounded-[28px] bg-white">
        {bundles.map((bundle, index) => <section key={bundle.id} className="border-b border-[#e5e8eb] px-7 py-8 last:border-0 sm:px-10">
          <div className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f3ff] text-sm font-bold text-[#3182f6]">{index + 1}</span><div><h2 className="text-xl font-bold sm:text-2xl">{bundle.title}</h2><p className="mt-3 font-semibold leading-7 text-[#333d4b]">{bundle.summary}</p><p className="mt-2 text-sm font-medium leading-6 text-[#6b7684] sm:text-[15px]">{bundle.detail}</p></div></div>
        </section>)}
      </div>

      <aside className="mt-6 rounded-3xl bg-[#fff8e1] px-7 py-6 text-sm font-semibold leading-6 text-[#4e5968]">승인은 AI 권고안을 연구 진행 기준으로 채택한다는 뜻입니다. 동일인의 한 번 승인을 독립 검토자 2인의 완료로 기록하지 않습니다.</aside>

      {approvedAt ? <section className="mt-8 rounded-[28px] bg-white px-7 py-10 text-center sm:px-12">
        <p className="font-bold text-[#008c63]">통합 승인 완료</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">권고안이 연구 진행 기준으로 확인됐습니다</h2><p className="mt-4 font-semibold leading-7 text-[#6b7684]">승인 기록을 내려받으면 Codex가 canonical 기록에 반영하고 후속 연구를 계속 진행할 수 있습니다.</p><button onClick={download} className="mt-7 rounded-2xl bg-[#191f28] px-7 py-4 font-bold text-white">승인 기록 내려받기</button>
      </section> : <button onClick={approveAll} className="mt-8 w-full rounded-2xl bg-[#3182f6] px-7 py-5 text-lg font-bold text-white transition hover:bg-[#1b64da]">다섯 권고안을 한 번에 승인하기</button>}
    </div>
  </main>;
}
