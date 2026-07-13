import type { Metadata } from "next";
import { NextStepReviewClient } from "@/src/components/next-step-review-client";
export const metadata: Metadata = { title: "다음 연구 단계 승인", robots: { index: false, follow: false } };
export default function NextStepReviewPage() { return <NextStepReviewClient />; }
