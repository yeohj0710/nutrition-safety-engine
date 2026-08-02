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

export default function Home() {
  const perQuestion = Object.values(core.per_question);
  const coreRange = `상황별 ${Math.min(...perQuestion)}~${Math.max(
    ...perQuestion,
  )}건`;

  const stats = [
    {
      label: "근거 후보 기록",
      value: manifest.records,
      note: "선별과 근거 게이트를 통과해 구조화한 PubMed 기록",
    },
    {
      label: "용량 보고 기록",
      value: manifest.with_dose,
      note: "초록에서 mg·IU 등 용량 표현을 확인한 기록",
    },
    {
      label: "초록 문장 확인",
      value: manifest.source_scope.abstract_only,
      note: `초록 문장 위치를 확인한 기록. ${manifest.source_scope.title_only}건은 제목만 확인`,
    },
    {
      label: "핵심 근거 기록",
      value: core.core_records,
      note: coreRange,
    },
  ];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-scope="ai_selected_thesis_scope_v40"
      className="app-page min-h-screen px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-12"
    >
      <div className="page-shell flex flex-col gap-12 sm:gap-16">
        <section aria-labelledby="page-title" className="pt-2 sm:pt-4">
          <span className="eyebrow">Evidence map · v4.0</span>
          <h1
            id="page-title"
            className="mt-3 max-w-[18ch] text-[clamp(2rem,6vw,3.5rem)] font-bold leading-[1.12] tracking-[-0.035em] text-foreground"
          >
            논문에서 보고된 조건을 빠르게 찾아보세요
          </h1>
          <p className="measure-copy mt-5 text-base leading-7 text-muted sm:text-lg sm:leading-8">
            수술 전후, 만성콩팥병, 임신, 간질환, 항응고 치료 중 하나를 고르면
            초록에 연령·약물·용량·성별·질환 표현이 있는 근거 기록을 좁혀
            보여줍니다.
          </p>
          <div className="mt-6 max-w-3xl rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm leading-6 text-blue-950">
            <p className="font-semibold">
              입력값과 논문 내용을 대조하는 도구가 아닙니다.
            </p>
            <p className="mt-1 text-blue-800">
              연구 자료에 해당 종류의 표현이 표시됐는지 찾는 탐색기입니다. 복용
              시작·중단·용량 변경이나 개인별 안전성을 판단하지 않습니다.
            </p>
          </div>
        </section>

        <section
          className="surface-card rounded-3xl px-4 py-6 sm:px-7 sm:py-8"
          id="explorer"
          aria-label="근거 기록 찾기"
        >
          <PersonalizedSafetyQuery />
        </section>

        <section aria-labelledby="research-scope-title">
          <div className="measure-copy">
            <span className="eyebrow">Research scope</span>
            <h2
              id="research-scope-title"
              className="mt-2 text-2xl font-bold tracking-[-0.02em] text-foreground"
            >
              이 연구가 다룬 자료
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              숫자는 논문 v4.0의 고정된 연구 산출물에서 불러옵니다. 같은 문헌이
              질문별 기록에 중복될 수 있으므로 기록 수와 고유 문헌 수는 다를 수
              있습니다.
            </p>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border-subtle bg-white px-5 py-5"
              >
                <dt className="text-sm font-semibold text-muted">
                  {stat.label}
                </dt>
                <dd className="mt-2 text-[1.75rem] font-bold leading-none tabular-nums tracking-[-0.03em] text-foreground">
                  {stat.value.toLocaleString("ko-KR")}
                </dd>
                <p className="mt-3 text-xs leading-5 text-muted">{stat.note}</p>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="limits-title"
          className="border-t border-border-subtle pt-8"
        >
          <h2 id="limits-title" className="text-base font-bold text-foreground">
            해석할 때 확인할 점
          </h2>
          <div className="measure-copy mt-3 space-y-3 text-sm leading-6 text-muted">
            <p>
              1층 결정적 분류기가 전체 기록을 분류했고, 2층에서 경계 기록을
              재판정했습니다. 사람 참조표준은 없으며, 이 화면의 기록 수는 임상적
              정확도나 효과 크기를 뜻하지 않습니다.
            </p>
            <p>
              자료원은 PubMed 하나이고 제목과 초록만 사용했습니다. 원문을
              확보하거나 개별 환자의 상태를 평가하지 않았습니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
