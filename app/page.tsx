import type {Metadata} from "next";
import manifest from "@/research/systematic_review_v3/manifest.json";
import core from "@/research/systematic_review_v3/core_manifest.json";
import {PersonalizedSafetyQuery} from "@/src/components/personalized-safety-query";
import {siteDescription,siteName} from "@/src/lib/site";
export const metadata:Metadata={title:siteName,description:siteDescription,alternates:{canonical:"/"}};
export const dynamic="force-dynamic";
export const revalidate=0;
export default function Home(){const perQuestion=Object.values(core.per_question);const coreRange=`질문마다 ${Math.min(...perQuestion)}~${Math.max(...perQuestion)}건`;const stats=[{label:"검색된 문헌",value:manifest.records,note:"성분과 안전성 결과가 함께 나온 문헌"},{label:"용량이 보고된 문헌",value:manifest.with_dose,note:"초록에 mg·IU 등 복용량이 나온 문헌"},{label:"무료 원문이 있는 문헌",value:manifest.with_fulltext_locator,note:"논문 본문을 바로 열 수 있는 문헌"},{label:"결과에 사용하는 문헌",value:core.core_records,note:coreRange}];return <main id="main-content" tabIndex={-1} data-scope="validated_thesis_scope" className="app-page min-h-screen px-4 py-4 sm:px-6 lg:px-6"><div className="page-shell flex flex-col gap-4">
 <section className="surface-card rounded-[1.15rem] px-4 py-4"><h1 className="text-[0.96rem] font-semibold text-foreground">항응고제 복용·신장질환 위험이 있을 때의 보충제 안전성</h1><p className="mt-1 text-sm leading-6 text-muted">복용량과 함께 먹는 약, 결석·신장 병력, 검사 결과를 문헌에 보고된 용량과 상호작용 결과와 비교합니다.</p></section>
 <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{stats.map(s=><div key={s.label} className="surface-card rounded-[0.95rem] px-3.5 py-3"><p className="text-[0.72rem] font-semibold text-muted">{s.label}</p><p className="mt-1 text-[1.35rem] font-semibold leading-none tabular-nums">{s.value.toLocaleString("ko-KR")}</p><p className="mt-1.5 text-[0.76rem] leading-5 text-muted">{s.note}</p></div>)}</section>
 <section className="surface-card rounded-[1.15rem]" id="explorer"><PersonalizedSafetyQuery/></section>
 </div></main>}
