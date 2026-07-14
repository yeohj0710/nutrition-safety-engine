import type { Metadata } from "next";
import { PubMedScreeningPrereviewClient } from "@/src/components/pubmed-screening-prereview-client";
import { prereviewTotals, screeningPrereviewBundles } from "@/src/lib/pubmed-screening-prereview";

export const metadata: Metadata = { title: "PubMed 사전분류 검수", robots: { index: false, follow: false } };

export default function Page() {
  return <PubMedScreeningPrereviewClient bundles={screeningPrereviewBundles} uniqueRecords={prereviewTotals.uniqueRecords} />;
}
