import Link from "next/link";
import { notFound } from "next/navigation";

import { RuleCard } from "@/src/components/rule-card";
import { getKnowledgeIndex, getRuleDetail } from "@/src/lib/knowledge";

export default async function RuleDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const detail = getRuleDetail(id);

  if (!detail) {
    notFound();
  }

  const mockMatch = {
    ruleId: detail.rule.id,
    classification: "possibly_relevant" as const,
    matched: false,
    matchScore: 0.6,
    matchedBecause: ["규칙 상세 페이지에서 근거와 조건을 직접 검토할 수 있습니다."],
    notEvaluatedBecauseMissing: [],
    needsMoreInfo: [],
    resolvedSeverity: detail.rule.severity,
    resolvedMessage: detail.rule.messageShort,
    supportingSources: detail.supportingSources,
    supportingEvidenceChunks: detail.supportingEvidenceChunks,
    rule: detail.rule,
    ingredient: detail.ingredient,
    evaluation: {
      selectedIngredient: true,
      conditionResults: [],
      missingFields: [],
      excludedReasons: [],
    },
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f7f4ee_0%,_#f2efe7_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Rule Detail</p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-950">{detail.rule.nutrientOrIngredient}</h1>
            <p className="mt-2 text-sm text-stone-600">{detail.rule.id}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/" className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700">
              탐색기
            </Link>
            <Link
              href="/sources"
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700"
            >
              출처 브라우저
            </Link>
          </div>
        </div>

        <RuleCard match={mockMatch} defaultExpandedEvidence />

        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-950">규칙 조건</h2>
          {detail.rule.conditions.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">명시된 조건이 없는 일반 참고 규칙입니다.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm text-stone-700">
              {detail.rule.conditions.map((condition) => (
                <li key={condition.id} className="rounded-2xl bg-stone-50 px-4 py-3">
                  <span className="font-medium text-stone-900">{condition.labelKo ?? condition.field}</span>
                  <span className="ml-2">{JSON.stringify(condition.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-950">규칙 결과</h2>
          <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="font-semibold text-stone-900">짧은 메시지</dt>
              <dd className="mt-1 text-stone-700">{detail.rule.messageShort}</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-900">조치</dt>
              <dd className="mt-1 text-stone-700">{detail.rule.action}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="font-semibold text-stone-900">긴 설명</dt>
              <dd className="mt-1 text-stone-700">{detail.rule.messageLong}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-stone-950">지원 출처</h2>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
              {detail.supportingSources.length}건
            </span>
          </div>
          {detail.supportingSources.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">연결된 출처가 없습니다.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {detail.supportingSources.map((source) => (
                <article key={source.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-stone-950">{source.title}</p>
                      <p className="mt-1 text-sm text-stone-700">{source.journalOrPublisher ?? "발행 정보 없음"}</p>
                      <p className="mt-2 text-xs text-stone-500">{source.id}</p>
                    </div>
                    <Link
                      href={`/sources/${source.id}`}
                      className="rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-700"
                    >
                      출처 상세
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-stone-950">지원 근거 청크</h2>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
              {detail.supportingEvidenceChunks.length}건
            </span>
          </div>
          {detail.supportingEvidenceChunks.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">연결된 근거 청크가 없습니다.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {detail.supportingEvidenceChunks.map((chunk) => (
                <article key={chunk.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-stone-950">{chunk.id}</p>
                      <p className="mt-1 text-sm text-stone-600">
                        {chunk.locatorType ?? "위치"} {chunk.locatorValue ?? "미상"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700">
                    {chunk.summary ?? chunk.quote ?? chunk.chunkText ?? "발췌 내용 없음"}
                  </p>
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
  return getKnowledgeIndex().safetyRules.map((rule) => ({ id: rule.id }));
}
