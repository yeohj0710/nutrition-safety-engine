import type { Metadata } from "next";
import finalManifest from "@/research/final/manifest.json";
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
  const final = finalManifest.results;
  const counts = final.screening_counts;
  const repair = final.posthoc_correction.metadata_repair;

  const stats = [
    {
      label: "PubMed 수집 문헌",
      value: final.corpus_rows,
      unit: "건",
      note: `서로 다른 논문 ${numberFormat(repair.unique_papers)}편, 한 논문이 여러 상황에 걸리면 따로 셈`,
    },
    {
      label: "AI 선별 관련 문헌",
      value: counts.retain,
      unit: "건",
      note: "해당 상황의 사람에게 보충제를 쓴 내용이 확인된 문헌",
    },
    {
      label: "조회 대상 문헌",
      value: correction.candidates,
      unit: "건",
      note: `그 가운데 초록에 양(mg, IU 등)이 적힌 문헌 ${numberFormat(correction.candidate_dose_rows)}건`,
    },
    {
      label: "AI 검토 연구",
      value: correction.core_records,
      unit: "건",
      note: "주제, 결과 요약, 한국어 번역을 한 번 더 확인한 연구",
    },
  ];

  const guides = [
    {
      title: "조회 방식",
      body: "다섯 상황 가운데 하나를 고르면 그 상황에서 다시 검토한 연구부터 보여 줍니다. 나이, 다른 약, 복용량, 성별, 지병을 고르면 제목이나 초록에 그 내용이 나오는 연구만 남깁니다. 같은 조건에서는 늘 같은 목록이 나옵니다.",
    },
    {
      title: "AI의 역할",
      body: "AI는 수집한 문헌을 고르는 일, 적어 주신 문장에서 상황을 읽는 일, 찾은 연구를 쉬운 말로 설명하는 일을 맡습니다. 어떤 연구가 목록에 오를지는 AI가 아니라 미리 정한 규칙이 정합니다.",
    },
    {
      title: "자료 범위",
      body: "PubMed 제목과 초록을 2026년 8월 6일에 수집하였고, 출판일자와 언어는 제한하지 않았습니다. 문헌 선별에는 사람의 판정이 들어가지 않았습니다.",
    },
    {
      title: "이용 범위",
      body: "연구를 찾아보는 도구입니다. 적어 주신 나이나 양을 연구 대상과 하나하나 맞춰 보지 않으며, 먹어도 되는지나 얼마나 먹을지는 정해 주지 않습니다. 복용은 의사나 약사와 상의하세요.",
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
        <div className="page-shell px-4 sm:px-6">
          <div className="section-head">
            <h2 id="scope-title" className="section-title">
              자료 규모
            </h2>
            <p className="section-sub">2026년 9월 5일 사후 정정 반영</p>
          </div>
          <dl className="stat-grid">
            {stats.map((stat) => (
              <div key={stat.label} className="stat-item">
                <dt className="stat-label">{stat.label}</dt>
                <dd className="stat-value">
                  {numberFormat(stat.value)}
                  <small>{stat.unit}</small>
                </dd>
                <dd className="stat-note">{stat.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="guide" aria-labelledby="guide-title" className="scroll-mt-16 pt-10 sm:pt-14">
        <div className="page-shell px-4 sm:px-6">
          <div className="section-head">
            <h2 id="guide-title" className="section-title">
              이용 안내
            </h2>
          </div>
          <dl className="row-list">
            {guides.map((guide) => (
              <div key={guide.title}>
                <dt>{guide.title}</dt>
                <dd>{guide.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="research" aria-labelledby="research-title" className="scroll-mt-16 py-10 sm:py-14">
        <div className="page-shell px-4 sm:px-6">
          <div className="section-head">
            <h2 id="research-title" className="section-title">
              연구 정보
            </h2>
          </div>
          <dl className="row-list">
            <div>
              <dt>연구 주제</dt>
              <dd>개인맞춤 영양소 안전성 기준 제공 시스템 개발</dd>
            </div>
            <div>
              <dt>연구 수행</dt>
              <dd>연세대학교 약학대학 임상약학연구실 여형준, 지도교수 장민정</dd>
            </div>
            <div>
              <dt>임상 상황</dt>
              <dd>수술, 시술, 마취 전후 / 신질환과 투석 / 임신과 수유 / 간질환과 간독성 / 항응고와 출혈</dd>
            </div>
            <div>
              <dt>선별과 검증</dt>
              <dd>
                OpenAI Codex 에이전트가 수집 문헌 전체를 선별하고, Anthropic Claude 에이전트가 표본{" "}
                {numberFormat(final.sample_rows)}행을 선별 결과를 모르는 상태로 다시 판정하였습니다. 두 판정의
                일치도는 {final.ai_comparison.agreement_vs_ai_reference}%였습니다(사후 정정 전 기준).
              </dd>
            </div>
            <div>
              <dt>사후 정정</dt>
              <dd>
                원본 기록 대조와 재검토 {numberFormat(correction.reviewed_rows)}행을 거쳐{" "}
                {numberFormat(correction.label_changes)}행의 판정을 고치고, 빠졌던{" "}
                {numberFormat(correction.restored_rows_screened)}행을 새로 판정하였습니다.
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
