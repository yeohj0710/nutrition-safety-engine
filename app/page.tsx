import type {Metadata} from "next";
import manifest from "@/research/systematic_review_v30/manifest.json";
import core from "@/research/systematic_review_v30/core_manifest.json";
import {PersonalizedSafetyQuery} from "@/src/components/personalized-safety-query";
import {siteDescription,siteName} from "@/src/lib/site";
export const metadata:Metadata={title:siteName,description:siteDescription,alternates:{canonical:"/"}};
export const dynamic="force-dynamic";
export const revalidate=0;
export default function Home(){const perQuestion=Object.values(core.per_question);const coreRange=`질문마다 ${Math.min(...perQuestion)}~${Math.max(...perQuestion)}건`;const stats=[{label:"AI 선별 통과 문헌",value:manifest.records,note:"정규식 조건과 P2 AI 선별을 모두 통과한 PubMed 문헌"},{label:"용량이 보고된 문헌",value:manifest.with_dose,note:"초록에 mg·IU 등 복용량이 나온 문헌"},{label:"근거 문장을 확인한 문헌",value:manifest.records,note:"제목 또는 초록에서 근거 문장의 위치를 확인한 문헌"},{label:"핵심 근거 문헌",value:core.core_records,note:coreRange}];return <main id="main-content" tabIndex={-1} data-scope="validated_thesis_scope" className="app-page min-h-screen px-4 pt-4 pb-24 sm:px-6 sm:pb-36 lg:px-6 lg:pb-52"><div className="page-shell flex flex-col gap-4">
 <section className="surface-card rounded-[1.15rem] px-4 py-4"><h1 className="text-[1.25rem] font-bold leading-snug text-foreground">고위험 상황에서 확인하는 보충제 안전성</h1><p className="mt-1 text-sm leading-6 text-muted">수술 전후, 만성콩팥병, 임신, 간질환, 항응고 치료 상황에서 보충제 용량과 병용약, 기저질환을 문헌 근거와 비교해요.</p></section>
 <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{stats.map(s=><div key={s.label} className="surface-card rounded-[0.95rem] px-3.5 py-3"><p className="text-[0.72rem] font-semibold text-muted">{s.label}</p><p className="mt-1 text-[1.35rem] font-semibold leading-none tabular-nums">{s.value.toLocaleString("ko-KR")}</p><p className="mt-1.5 text-[0.76rem] leading-5 text-muted">{s.note}</p></div>)}</section>
 <section className="surface-card rounded-[1.15rem]" id="explorer"><PersonalizedSafetyQuery/></section>
 </div></main>}
