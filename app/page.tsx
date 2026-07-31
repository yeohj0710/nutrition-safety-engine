import type { Metadata } from "next";
import manifest from "@/research/systematic_review_v40/manifest.json";
import core from "@/research/systematic_review_v40/core_manifest.json";
import { PersonalizedSafetyQuery } from "@/src/components/personalized-safety-query";
import { siteDescription, siteName } from "@/src/lib/site";

export const metadata: Metadata = {
  title: siteName,
  description: siteDescription,
  alternates: { canonical: "/" },
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  const perQuestion = Object.values(core.per_question);
  const coreRange = `다섯 상황에 질문마다 ${Math.min(...perQuestion)}~${Math.max(
    ...perQuestion,
  )}건`;

  const stats = [
    {
      label: "근거 문헌",
      value: manifest.records,
      note: "AI가 선별한 뒤 근거 문장과 용량을 뽑아낼 수 있었던 PubMed 문헌",
    },
    {
      label: "용량이 보고된 문헌",
      value: manifest.with_dose,
      note: "초록에 mg·IU 등 복용량이 나온 문헌",
    },
    {
      label: "초록 근거 문장을 확인한 문헌",
      value: manifest.source_scope.abstract_only,
      note: `근거 문장의 위치까지 확인한 문헌. 나머지 ${manifest.source_scope.title_only}건은 초록이 없어 제목을 위치로 남겼습니다.`,
    },
    {
      label: "핵심 근거 문헌",
      value: core.core_records,
      note: coreRange,
    },
  ];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-scope="ai_selected_thesis_scope_v40"
      className="app-page min-h-screen px-4 pt-4 pb-24 sm:px-6 sm:pb-36 lg:px-6 lg:pb-52"
    >
      <div className="page-shell flex flex-col gap-4">
        <section className="surface-card rounded-[1.15rem] px-5 py-5 sm:px-6 sm:py-6">
          <span className="eyebrow">Evidence map · v4.0</span>
          <h1 className="mt-2 text-[1.35rem] font-bold leading-snug text-foreground sm:text-[1.6rem]">
            고위험 상황에서 확인하는 보충제 안전성
          </h1>
          <p className="measure-copy mt-2 text-sm leading-6 text-muted">
            수술 전후, 만성콩팥병, 임신, 간질환, 항응고 치료 상황에서 보충제
            용량과 병용약, 기저질환을 문헌 근거와 비교해요. 상황을 고르고 조건을
            적으면 그 조건을 실제로 보고한 문헌만 남습니다.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem] leading-5 text-muted">
            <li>· 복용 시작·중단·용량 변경을 판단하지 않습니다</li>
            <li>· 근거 문장은 초록의 몇 번째 문장인지까지 표시합니다</li>
            <li>· 같은 입력이면 같은 결과가 나옵니다</li>
          </ul>
        </section>

        <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="surface-card flex flex-col rounded-[0.95rem] px-3.5 py-3.5"
            >
              <p className="text-[0.72rem] font-semibold text-muted">
                {stat.label}
              </p>
              <p className="mt-1 text-[1.5rem] font-semibold leading-none tabular-nums text-foreground">
                {stat.value.toLocaleString("ko-KR")}
              </p>
              <p className="mt-2 text-[0.74rem] leading-5 text-muted">
                {stat.note}
              </p>
            </div>
          ))}
        </section>

        <section
          className="surface-card rounded-[1.15rem] px-4 py-5 sm:px-5"
          id="explorer"
        >
          <PersonalizedSafetyQuery />
        </section>

        <section className="surface-card rounded-[1.15rem] px-5 py-4">
          <p className="text-[0.78rem] font-semibold text-foreground">
            이 도구가 말하지 않는 것
          </p>
          <p className="measure-copy mt-1.5 text-[0.76rem] leading-5 text-muted">
            문헌 선별은 사람이 아니라 AI가 했고, 선별 품질은 사람 참조표준이
            아니라 같은 명세를 적용한 독립 맹검 채점과 비교해 측정했습니다.
            따라서 여기의 어떤 수치도 임상적 정확도를 뜻하지 않습니다. 제목과
            초록만 보았고 원문은 확보하지 않았으며, 자료원은 PubMed 하나입니다.
          </p>
        </section>
      </div>
    </main>
  );
}
