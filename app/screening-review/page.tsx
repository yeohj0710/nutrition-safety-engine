import type { Metadata } from "next";
import { ScreeningReviewClient } from "@/src/components/screening-review-client";
import { screeningBundles } from "@/src/lib/screening-review";
export const metadata:Metadata={title:"제목·초록 선별 검토",robots:{index:false,follow:false}};
export default function Page(){return <ScreeningReviewClient bundles={screeningBundles}/>}
