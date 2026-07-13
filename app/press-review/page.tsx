import type { Metadata } from "next";

import { PressReviewClient } from "@/src/components/press-review-client";
import { pressReviewBundles } from "@/src/lib/press-review";

export const metadata: Metadata = {
  title: "PRESS 검색식 검토",
  description: "사전검토된 검색식 권고안을 질문별로 확인하고 승인하는 내부 화면",
  robots: { index: false, follow: false },
};

export default function PressReviewPage() {
  return <PressReviewClient bundles={pressReviewBundles} />;
}
