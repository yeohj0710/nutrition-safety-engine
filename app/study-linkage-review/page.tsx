import type { Metadata } from "next";
import { StudyLinkageReviewClient } from "@/src/components/study-linkage-review-client";
import { studyLinkageReviewBundles, studyLinkageTotals } from "@/src/lib/study-linkage-review";

export const metadata: Metadata = { title: "연구 단위 연결 사전검토", robots: { index: false, follow: false } };
export default function Page() { return <StudyLinkageReviewClient bundles={studyLinkageReviewBundles} reportCount={studyLinkageTotals.unique_reports} />; }
