import type { Metadata } from "next";
import manifest from "@/research/systematic_review/manifest.json";
import core from "@/research/systematic_review/core_manifest.json";
import correction from "@/research/final/site-summary.json";
import { PersonalizedSafetyQuery } from "@/src/components/personalized-safety-query";
import { siteDescription, siteName } from "@/src/lib/site";

export const metadata: Metadata = {
  title: siteName,
  description: siteDescription,
  alternates: { canonical: "/" },
};

const numberFormat = (value: number) => value.toLocaleString("ko-KR");

export default function Home() {
  const perQuestion = Object.values(core.per_question);
  const lowest = Math.min(...perQuestion);
  const highest = Math.max(...perQuestion);
  const coreRange =
    lowest === highest ? `상황별 ${lowest}건씩` : `상황별 ${lowest}~${highest}건`;

  const stats = [
    {
      label: "문헌 후보",
      value: manifest.records,
      note: "AI 선별과 키워드 조건을 통과한 PubMed 문헌",
    },
    {
      label: "용량 기재 문헌",
      value: manifest.with_dose,
      note: "초록에 mg, IU 같은 양이 적힌 문헌",
    },
    {
      label: "초록 확인 후보",
      value: manifest.source_scope.abstract_only,
      note: `초록 문장을 표시한 후보. 제목만 있는 후보 ${numberFormat(manifest.source_scope.title_only)}건`,
    },
    {
      label: "상황별 핵심 근거",
      value: core.core_records,
      note: `${coreRange}. 주제와 핵심 문장을 다시 검토한 문헌`,
    },
  ];

  const guides = [
    {
      title: "조회 방식",
      body: "다섯 임상 상황 가운데 하나를 고르고, 선택한 조건이 초록에 나온 문헌만 남깁니다. 문장으로 적으면 AI가 상황과 조건으로 옮기고, 조회 자체는 규칙 파일이 정한 순서로 돕니다.",
    },
    {
      title: "자료 범위",
      body: "자료는 PubMed에서 모았습니다. 선별과 문헌 연결에는 제목과 초록만 사용하며, 출판일자 제한 없이 모았기 때문에 오래전에 자리 잡은 상호작용 근거도 함께 들어 있습니다.",
    },
    {
      title: "판단 범위",
      body: "문헌 전체를 인공지능 에이전트가 판정해서 골랐고 사람이 만든 정답지는 없습니다. 화면에 나온 건수는 그만큼 맞다거나 효과가 크다는 뜻이 아니며, 개별 환자 상태를 평가하지 않습니다.",
    },
  ];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-scope="posthoc_corrected_research"
      className="app-page flex-1"
    >
      <PersonalizedSafetyQuery />

      <section id="scope" aria-labelledby="scope-title" className="stat-band scroll-mt-16">
        <div className="site-shell">
          <div className="section-head">
            <h2 id="scope-title" className="section-title">
              자료 규모
            </h2>
            <p className="section-sub">문헌 재수집 트랙, 사후 정정 반영</p>
          </div>
          <p className="mt-3 max-w-[64ch] text-[0.9375rem] leading-7 text-[#464c53]">
            조건은 초록에 그 항목이 나오는지만 확인합니다. 입력값과 논문 내용을 대조하는 도구가 아닙니다.
          </p>
          <dl className="stat-grid">
            {stats.map((stat) => (
              <div key={stat.label} className="stat-item">
                <dt className="stat-label">{stat.label}</dt>
                <dd className="stat-value">{numberFormat(stat.value)}</dd>
                <dd className="stat-note">{stat.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="guide" aria-labelledby="guide-title" className="scroll-mt-16 py-10 sm:py-14">
        <div className="site-shell">
          <div className="section-head">
            <h2 id="guide-title" className="section-title">
              이용 안내
            </h2>
            <p className="section-sub">조회 전에 확인할 세 가지</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {guides.map((guide, index) => (
              <article key={guide.title} className="card">
                <p className="flex items-center gap-2 text-[0.9375rem] font-bold text-navy">
                  <span className="ref-badge bg-navy text-white">{index + 1}</span>
                  {guide.title}
                </p>
                <p className="mt-3 text-[0.9375rem] leading-7 text-foreground">{guide.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="research"
        aria-labelledby="research-title"
        className="scroll-mt-16 border-t border-border-subtle bg-surface-elevated py-10 sm:py-14"
      >
        <div className="site-shell">
          <div className="section-head">
            <h2 id="research-title" className="section-title">
              연구 정보
            </h2>
            <p className="section-sub">최종 자료 검토 기록</p>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <article className="card">
              <h3 className="text-base font-bold">사후 정정 내역</h3>
              <ul className="gov-list mt-3 text-[0.9375rem] leading-7">
                <li>
                  사유 오류와 주제 적합성 검토 {numberFormat(correction.reviewed_rows)}행을 반영해{" "}
                  {numberFormat(correction.label_changes)}행의 판정을 정정했습니다.
                </li>
                <li>
                  핵심 근거 {numberFormat(core.core_records)}건의 주제, 요약, 번역을 다시 확인했습니다.
                </li>
                <li>
                  전체 후보 목록은 AI가 선별한 탐색 자료이며 핵심 근거와 검토 범위가 다릅니다.
                </li>
                <li>
                  정정 전 AI 채점 일치도는 74.79%입니다. 선별과 채점의 기준 차이를 포함한 과거 평가이며,
                  정정 후 성능이나 임상적 정확도를 뜻하지 않습니다.
                </li>
              </ul>
            </article>
            <article className="card">
              <h3 className="text-base font-bold">연구 개요</h3>
              <dl className="mt-3 grid gap-2 text-[0.9375rem] leading-7">
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 font-bold text-[#464c53]">연구 주제</dt>
                  <dd>개인맞춤 영양소 안전성 기준 제공 시스템 개발</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 font-bold text-[#464c53]">임상 상황</dt>
                  <dd>수술 전후, 신질환, 임신과 수유, 간질환, 항응고 치료</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 font-bold text-[#464c53]">조회 조건</dt>
                  <dd>연령, 병용 약물, 용량, 성별, 기저 질환</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 font-bold text-[#464c53]">자료 출처</dt>
                  <dd>PubMed 제목과 초록</dd>
                </div>
              </dl>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
