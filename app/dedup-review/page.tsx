import type { Metadata } from "next";
import { DedupReviewClient } from "@/src/components/dedup-review-client";
import { dedupReviewBundles } from "@/src/lib/dedup-review";

export const metadata: Metadata = { title: "중복 문헌 검토", robots: { index: false, follow: false } };
export default function DedupReviewPage() { return <DedupReviewClient bundles={dedupReviewBundles} />; }
