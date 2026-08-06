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
      label: "모아 둔 근거",
      value: manifest.records,
      note: "선별과 근거 검사를 통과한 PubMed 문헌",
    },
    {
      label: "먹은 양이 적힌 것",
      value: manifest.with_dose,
      note: "초록에 mg·IU 처럼 양이 적힌 문헌",
    },
    {
      label: "초록까지 확인",
      value: manifest.source_scope.abstract_only,
      note: `초록에서 문장 자리까지 확인한 문헌 · 제목만 본 것 ${manifest.source_scope.title_only}건`,
    },
    {
      label: "상황별 핵심 근거",
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
            수술 전후, 콩팥, 임신, 간, 항응고제 다섯 가운데 하나를 고르면 나이·약·
            용량·남녀·앓는 병 이야기가 나온 문헌만 좁혀 보여드립니다.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted">
            <span className="font-semibold text-foreground">
              입력값과 논문 내용을 대조하는 도구가 아닙니다.
            </span>{" "}
            그 이야기가 초록에 나왔는지만 찾아 드립니다. 먹기 시작할지 끊을지, 양을
            얼마로 할지, 이 사람에게 안전한지는 판단하지 않습니다.
          </p>
        </section>

        <section
          aria-label="연구 자료 규모"
          className="grid gap-[var(--stack-gap)] sm:grid-cols-2 lg:grid-cols-4"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="card flex flex-col">
              <p className="text-[0.8125rem] font-semibold text-muted">
                {stat.label}
              </p>
              <p className="mt-2 text-[1.5rem] font-semibold leading-none tabular-nums text-foreground">
                {stat.value.toLocaleString("ko-KR")}
              </p>
              <p className="mt-2 text-[0.8125rem] leading-5 text-muted">
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
            className="text-base font-bold text-foreground"
          >
            읽으실 때 같이 봐 주실 것
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-muted">
            <li>
              전량 분류에서 결정적 분류기가 문헌 전체를 갈랐고, 재판정에서 경계에
              놓인 것을 다시 봤습니다. 사람이 만든 정답지는 없습니다.
            </li>
            <li>
              화면에 나온 건수는 그만큼 맞다거나 효과가 크다는 뜻이 아닙니다.
            </li>
            <li>
              자료는 PubMed 한 곳에서만 모았고 제목과 초록만 봤습니다. 원문을
              구하거나 개별 환자 상태를 따져 보지 않았습니다.
            </li>
            <li>
              2022년 1월 뒤에 나온 문헌만 모았습니다. 그보다 앞서 자리 잡은
              상호작용이나 안전성 근거는 이 화면에 나오지 않습니다.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
