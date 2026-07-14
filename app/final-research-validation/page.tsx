import type { Metadata } from "next";
import { FinalResearchValidationClient } from "@/src/components/final-research-validation-client";
import { finalValidationBundles, finalValidationEvidence } from "@/src/lib/final-research-validation";

export const metadata: Metadata = { title: "최종 연구 권고안 통합 승인", robots: { index: false, follow: false } };
export default function Page() { return <FinalResearchValidationClient bundles={finalValidationBundles} evidence={finalValidationEvidence} />; }
