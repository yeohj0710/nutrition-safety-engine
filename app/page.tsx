import type {Metadata} from "next";
import manifest from "@/research/systematic_review_v3/manifest.json";
import core from "@/research/systematic_review_v3/core_manifest.json";
import {PersonalizedSafetyQuery} from "@/src/components/personalized-safety-query";
import {siteDescription,siteName} from "@/src/lib/site";
export const metadata:Metadata={title:siteName,description:siteDescription,alternates:{canonical:"/"}};
export const dynamic="force-dynamic";
export const revalidate=0;
export default function Home(){const stats=[{label:"찾은 관련 문헌",value:manifest.records,note:"대상·성분·안전성 내용이 함께 확인된 자료"},{label:"용량을 확인한 문헌",value:manifest.with_dose,note:"초록에서 mg·IU 등 복용량을 확인한 자료"},{label:"원문 바로가기",value:manifest.with_fulltext_locator,note:"무료 공개 원문 위치가 연결된 자료"},{label:"중요 문헌",value:core.core_records,note:`5개 질문별 ${core.per_question.A1}건`}];return <main id="main-content" tabIndex={-1} data-scope="validated_thesis_scope" className="app-page min-h-screen px-4 py-4 sm:px-6 lg:px-6"><div className="page-shell flex flex-col gap-4">
 <section className="surface-card rounded-[1.15rem] px-4 py-4"><h1 className="text-[0.96rem] font-semibold text-foreground">항응고제·신장 고위험군 영양보충제 안전성 조회</h1><p className="mt-1 text-sm leading-6 text-muted">복용량, 병용 약물, 질환·결석 병력과 검사값을 근거 문헌의 확인 항목과 연결합니다.</p></section>
 <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{stats.map(s=><div key={s.label} className="surface-card rounded-[0.95rem] px-3.5 py-3"><p className="text-[0.72rem] font-semibold text-muted">{s.label}</p><p className="mt-1 text-[1.35rem] font-semibold leading-none tabular-nums">{s.value.toLocaleString("ko-KR")}</p><p className="mt-1.5 text-[0.76rem] leading-5 text-muted">{s.note}</p></div>)}</section>
 <section className="surface-card rounded-[1.15rem]" id="explorer"><PersonalizedSafetyQuery/></section>
 </div></main>}
