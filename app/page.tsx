import type { Metadata } from "next";
import Link from "next/link";

import { loadThesisBundle } from "@/src/evidence/load-thesis-bundle";
import { siteDescription, siteName } from "@/src/lib/site";

export const metadata: Metadata = {
  title: siteName,
  description: siteDescription,
  alternates: { canonical: "/" },
};

const protocolQuestions = [
  ["A1", "항응고제 복용자와 비타민 K 관련 안전성"],
  ["A2", "신장결석 위험과 칼슘·비타민 D 관련 안전성"],
  ["B1", "흡연자와 베타카로틴 관련 안전성"],
  ["B2", "임신·수유와 영양성분 관련 안전성"],
  ["B3", "약물–영양성분 복용 간격 관련 안전성"],
] as const;

export default function Home() {
  const bundle = loadThesisBundle();
  const isEmpty = bundle.meta.claimCount === 0 && bundle.meta.ruleCount === 0;

  return (
    <main className="min-h-screen">
      <section className="border-b border-stone-200 bg-white px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-[1049px]">
          <p className="text-sm font-semibold text-blue-600">졸업논문 연구 시스템</p>
          <h1 className="mt-4 max-w-3xl break-keep text-4xl font-bold leading-[1.22] tracking-[-0.035em] text-stone-950 sm:text-6xl">
            검증된 근거만 서비스에 연결합니다
          </h1>
          <p className="mt-6 max-w-2xl break-keep text-lg leading-8 text-stone-600">
            문헌 검색부터 규칙 검증까지의 계보를 보존하고, 검증이 끝난 주장과
            규칙만 기본 화면에 노출하는 연구용 안전성 엔진입니다.
          </p>
        </div>
      </section>

      <section className="bg-[#f7f8fa] px-6 py-14 sm:py-20">
        <div className="mx-auto grid max-w-[1049px] gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-semibold text-stone-500">현재 공개 상태</p>
            <h2 className="mt-3 break-keep text-3xl font-bold tracking-[-0.025em] text-stone-950">
              {isEmpty ? "검증 전 결과는 보여 주지 않습니다" : "검증된 연구 번들을 사용 중입니다"}
            </h2>
            <p className="mt-4 max-w-xl break-keep text-base leading-7 text-stone-600">
              {isEmpty
                ? "현재 validated_thesis_scope에 확정된 근거 주장과 규칙이 없습니다. 따라서 개인별 안전성 판단이나 복약 지시를 제공하지 않습니다."
                : "현재 응답은 사람 검토와 시나리오 검증을 통과한 연구 번들에서만 생성됩니다."}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-stone-200 bg-stone-200">
            <div className="bg-white p-6">
              <dt className="text-sm text-stone-500">검증된 주장</dt>
              <dd className="mt-2 text-3xl font-bold tabular-nums text-stone-950">
                {bundle.meta.claimCount.toLocaleString("ko-KR")}
              </dd>
            </div>
            <div className="bg-white p-6">
              <dt className="text-sm text-stone-500">검증된 규칙</dt>
              <dd className="mt-2 text-3xl font-bold tabular-nums text-stone-950">
                {bundle.meta.ruleCount.toLocaleString("ko-KR")}
              </dd>
            </div>
            <div className="col-span-2 bg-white p-6">
              <dt className="text-sm text-stone-500">번들 범위</dt>
              <dd className="mt-2 break-all font-mono text-sm font-semibold text-blue-600">
                validated_thesis_scope
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="bg-white px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-[1049px]">
          <h2 className="text-3xl font-bold tracking-[-0.025em] text-stone-950">
            사전 정의 연구질문
          </h2>
          <div className="mt-8 divide-y divide-stone-200 border-y border-stone-200">
            {protocolQuestions.map(([id, question]) => (
              <div key={id} className="grid gap-2 py-5 sm:grid-cols-[4rem_1fr] sm:items-center">
                <span className="font-mono text-sm font-bold text-blue-600">{id}</span>
                <p className="break-keep text-base font-semibold leading-7 text-stone-900">
                  {question}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-3xl bg-[#f2f4f6] p-6 sm:p-8">
            <p className="font-semibold text-stone-950">과거 데모는 연구결과가 아닙니다</p>
            <p className="mt-2 max-w-2xl break-keep text-sm leading-6 text-stone-600">
              이전 저장소의 규칙과 검색 자료는 삭제하지 않고 legacy_unverified로 격리했습니다.
              재현·감사 목적으로만 별도 화면에서 확인할 수 있습니다.
            </p>
            <Link
              href="/legacy"
              rel="nofollow"
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white transition hover:bg-stone-700"
            >
              legacy_unverified 데모 보기
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
