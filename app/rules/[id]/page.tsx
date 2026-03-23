import Link from "next/link";
import { notFound } from "next/navigation";

import { RuleCard } from "@/src/components/rule-card";
import { buildReferenceBundle, getKnowledgeIndex, getRuleById } from "@/src/lib/knowledge";

export default async function RuleDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const rule = getRuleById(id);

  if (!rule) {
    notFound();
  }

  const bundle = buildReferenceBundle(rule);
  const mockMatch = {
    ruleId: rule.id,
    classification: "possibly_relevant" as const,
    matched: false,
    matchScore: 0.5,
    matchedBecause: ["규칙 상세 보기"],
    notEvaluatedBecauseMissing: [],
    needsMoreInfo: [],
    resolvedSeverity: rule.severity,
    resolvedMessage: rule.messageShort,
    supportingSources: bundle.supportingSources,
    supportingEvidenceChunks: bundle.supportingEvidenceChunks,
    rule,
    ingredient: bundle.ingredient,
    evaluation: {
      selectedIngredient: true,
      conditionResults: [],
      missingFields: [],
      excludedReasons: [],
    },
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f7f4ee_0%,_#f2efe7_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Rule Detail</p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-950">{rule.nutrientOrIngredient}</h1>
          </div>
          <Link href="/" className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700">
            탐색기로 돌아가기
          </Link>
        </div>

        <RuleCard match={mockMatch} />

        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-950">조건과 근거 연결</h2>
          <ul className="mt-4 space-y-3 text-sm text-stone-700">
            {rule.conditions.map((condition) => (
              <li key={condition.id} className="rounded-2xl bg-stone-50 px-4 py-3">
                <span className="font-medium text-stone-900">{condition.labelKo ?? condition.field}</span>
                <span className="ml-2">{JSON.stringify(condition.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

export async function generateStaticParams() {
  return getKnowledgeIndex().safetyRules.map((rule) => ({ id: rule.id }));
}
