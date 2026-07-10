import type { Metadata } from "next";

import { RuleExplorerClient } from "@/src/components/rule-explorer-client";
import { getExplorerMetadata } from "@/src/lib/knowledge";

export const metadata: Metadata = {
  title: "legacy_unverified 규칙 데모",
  description: "검증되지 않은 과거 규칙을 재현·감사 목적으로만 보는 격리 화면",
};

export default function LegacyPage() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-[1049px] flex-col gap-5">
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
          <p className="text-sm font-bold">legacy_unverified · 연구결과 아님</p>
          <p className="mt-2 break-keep text-sm leading-6">
            이 화면의 자료와 규칙은 현 프로토콜에 따라 선별·추출·검증되지 않았습니다.
            임상 판단, 복약 지시, 논문 결과 또는 thesis mode 근거로 사용하지 마세요.
          </p>
        </section>
        <RuleExplorerClient metadata={getExplorerMetadata()} />
      </div>
    </main>
  );
}
