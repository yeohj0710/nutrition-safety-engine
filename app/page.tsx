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
  const lowest = Math.min(...perQuestion);
  const highest = Math.max(...perQuestion);
  const coreRange =
    lowest === highest ? `상황별 ${lowest}건씩` : `상황별 ${lowest}~${highest}건`;

  const stats = [
    {
      label: "근거 후보 기록",
      value: manifest.records,
      note: "선별과 근거 게이트를 통과한 PubMed 기록",
    },
    {
      label: "용량 보고 기록",
      value: manifest.with_dose,
      note: "초록에 mg·IU 등 용량 표현이 있는 기록",
    },
    {
      label: "초록 문장 확인",
      value: manifest.source_scope.abstract_only,
      note: `초록에서 문장 위치를 확인한 기록 · 제목만 ${manifest.source_scope.title_only}건`,
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
      className="app-page flex-1 px-4 py-4 sm:px-6 sm:py-6"
    >
      <div className="page-shell page-stack">
        <section aria-labelledby="page-title" className="card">
          <h1
            id="page-title"
            className="text-[1.25rem] font-bold leading-snug text-foreground"
          >
            고위험 상황에서 확인하는 보충제 안전성 근거
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            수술 전후, 만성콩팥병, 임신, 간질환, 항응고 치료 중 하나를 고르면
            초록에 연령·약물·용량·성별·질환 표현이 있는 근거 기록을 좁혀
            보여줍니다.
          </p>
          <p className="mt-3 text-[0.8rem] leading-6 text-muted">
            <span className="font-semibold text-foreground">
              입력값과 논문 내용을 대조하는 도구가 아닙니다.
            </span>{" "}
            연구 자료에 그 종류의 표현이 표시됐는지 찾아 줍니다. 복용
            시작·중단·용량 변경이나 개인별 안전성은 판단하지 않습니다.
          </p>
        </section>

        <section
          aria-label="연구 자료 규모"
          className="grid gap-[var(--stack-gap)] sm:grid-cols-2 lg:grid-cols-4"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="card flex flex-col">
              <p className="text-[0.72rem] font-semibold text-muted">
                {stat.label}
              </p>
              <p className="mt-2 text-[1.5rem] font-semibold leading-none tabular-nums text-foreground">
                {stat.value.toLocaleString("ko-KR")}
              </p>
              <p className="mt-2 text-[0.76rem] leading-5 text-muted">
                {stat.note}
              </p>
            </div>
          ))}
        </section>

        <section id="explorer" aria-label="근거 기록 찾기">
          <PersonalizedSafetyQuery />
        </section>

        <section aria-labelledby="limits-title" className="card">
          <h2
            id="limits-title"
            className="text-[0.95rem] font-bold text-foreground"
          >
            해석할 때 확인할 점
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-[0.8rem] leading-6 text-muted">
            <li>
              전량 분류에서 결정적 분류기가 전체 기록을 분류했고, 재판정에서
              경계 기록을 다시 판정했습니다. 사람 참조표준은 없습니다.
            </li>
            <li>
              화면의 기록 수는 임상적 정확도나 효과 크기를 뜻하지 않습니다.
            </li>
            <li>
              자료원은 PubMed 하나이고 제목과 초록만 사용했습니다. 원문을
              확보하거나 개별 환자의 상태를 평가하지 않았습니다.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
