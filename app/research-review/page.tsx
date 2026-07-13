import type { Metadata } from "next";

import { ResearchReviewClient } from "@/src/components/research-review-client";
import { professorApprovalBundles } from "@/src/lib/research-review";

export const metadata: Metadata = {
  title: "연구 검토·승인",
  description: "연구 담당자가 근거 자료를 확인하고 단계별 결정을 기록하는 내부 검토 화면",
  robots: { index: false, follow: false },
};

export default function ResearchReviewPage() {
  return <ResearchReviewClient tasks={professorApprovalBundles} />;
}
