import Link from "next/link";
import { notFound } from "next/navigation";

import { getKnowledgeIndex, getSourceDetail } from "@/src/lib/knowledge";
import {
  getEvidenceCheckHint,
  getEvidenceClaimLabel,
  getEvidenceLocatorText,
  getEvidenceSearchKeywords,
  getSourceReferenceLinks,
  getSourceTrustSummary,
} from "@/src/lib/references";

export default async function SourceDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const detail = getSourceDetail(id);

  if (!detail) {
    notFound();
  }

  const referenceLinks = getSourceReferenceLinks(detail.source);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f7f4ee_0%,_#f2efe7_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Source Detail</p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-950">{detail.source.title}</h1>
            <p className="mt-2 text-sm text-stone-600">{detail.source.id}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/sources" className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700">
              출처 목록
            </Link>
            <Link href="/" className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700">
              탐색기
            </Link>
          </div>
        </div>

        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-900">
              {getSourceTrustSummary(detail.source)}
            </span>
            {detail.source.year ? <span className="rounded-full bg-stone-100 px-3 py-1">{detail.source.year}</span> : null}
            {detail.source.jurisdiction ? (
              <span className="rounded-full bg-stone-100 px-3 py-1">{detail.source.jurisdiction}</span>
            ) : null}
            {detail.source.evidenceLevel ? (
              <span className="rounded-full bg-stone-100 px-3 py-1">{detail.source.evidenceLevel}</span>
            ) : null}
            <span className="rounded-full bg-stone-100 px-3 py-1">{detail.source.sourceType}</span>
          </div>
          <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="font-semibold text-stone-900">발행처</dt>
              <dd className="mt-1 text-stone-700">{detail.source.journalOrPublisher ?? "정보 없음"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-900">업데이트</dt>
              <dd className="mt-1 text-stone-700">{detail.source.updatedAt ?? "정보 없음"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-900">연결 규칙</dt>
              <dd className="mt-1 text-stone-700">{detail.linkedRules.length}건</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-900">연결 근거 청크</dt>
              <dd className="mt-1 text-stone-700">{detail.evidenceChunks.length}건</dd>
            </div>
          </dl>
          {referenceLinks.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {referenceLinks.map((link) => (
                <a
                  key={`${link.label}-${link.url}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-stone-200 px-3 py-1.5 text-sm text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-stone-950">연결된 규칙</h2>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
              {detail.linkedRules.length}건
            </span>
          </div>
          {detail.linkedRules.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">연결된 규칙이 없습니다.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {detail.linkedRules.map((rule) => (
                <article key={rule.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-stone-950">{rule.nutrientOrIngredient}</p>
                      <p className="mt-1 text-sm text-stone-700">{rule.messageShort}</p>
                      <p className="mt-2 text-xs text-stone-500">{rule.id}</p>
                    </div>
                    <Link
                      href={`/rules/${rule.id}`}
                      className="rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-700"
                    >
                      규칙 상세
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-stone-950">근거 청크</h2>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
              {detail.evidenceChunks.length}건
            </span>
          </div>
          {detail.evidenceChunks.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">연결된 근거 청크가 없습니다.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {detail.evidenceChunks.map((chunk) => (
                <article key={chunk.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {getEvidenceClaimLabel(chunk) ? (
                          <span className="rounded-full bg-stone-900 px-3 py-1 text-white">
                            {getEvidenceClaimLabel(chunk)}
                          </span>
                        ) : null}
                      </div>
                      <p className="font-semibold text-stone-950">{chunk.id}</p>
                      <p className="mt-1 text-sm text-stone-600">
                        {getEvidenceLocatorText(chunk) || "위치 미상"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700">
                    {chunk.summary ?? chunk.quote ?? chunk.chunkText ?? "발췌 내용 없음"}
                  </p>
                  <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-3 text-sm leading-6 text-stone-700">
                    {getEvidenceCheckHint(chunk, detail.source)}
                  </div>
                  {getEvidenceSearchKeywords(chunk).length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getEvidenceSearchKeywords(chunk).map((keyword) => (
                        <span key={`${chunk.id}-${keyword}`} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export async function generateStaticParams() {
  return getKnowledgeIndex().sources.map((source) => ({ id: source.id }));
}
