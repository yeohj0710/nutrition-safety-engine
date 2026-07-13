import type { Metadata } from "next";
import { DedupReviewClient } from "@/src/components/dedup-review-client";
import { dedupReviewBundles } from "@/src/lib/dedup-review";

export const metadata: Metadata = { title: "중복 문헌 2차 검수", robots: { index: false, follow: false } };
export default function DedupReviewRound2Page() { return <DedupReviewClient bundles={dedupReviewBundles} reviewRound={2} />; }
