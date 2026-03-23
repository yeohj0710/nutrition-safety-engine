import Link from "next/link";

import { getKnowledgeIndex } from "@/src/lib/knowledge";

export default function SourcesPage() {
  const knowledgeIndex = getKnowledgeIndex();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f7f4ee_0%,_#f2efe7_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Sources</p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-950">참고 출처 목록</h1>
          </div>
          <Link href="/" className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700">
            탐색기로 돌아가기
          </Link>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-5 py-4">제목</th>
                <th className="px-5 py-4">유형</th>
                <th className="px-5 py-4">관할권</th>
                <th className="px-5 py-4">근거 수준</th>
                <th className="px-5 py-4">링크</th>
              </tr>
            </thead>
            <tbody>
              {knowledgeIndex.sources.map((source) => (
                <tr key={source.id} className="border-t border-stone-100 align-top">
                  <td className="px-5 py-4">
                    <p className="font-medium text-stone-900">{source.title}</p>
                    <p className="mt-1 text-xs text-stone-500">{source.id}</p>
                  </td>
                  <td className="px-5 py-4 text-stone-700">{source.sourceType}</td>
                  <td className="px-5 py-4 text-stone-700">{source.jurisdiction ?? "-"}</td>
                  <td className="px-5 py-4 text-stone-700">{source.evidenceLevel ?? "-"}</td>
                  <td className="px-5 py-4 text-stone-700">
                    {source.urlOrIdentifier ? (
                      <a href={source.urlOrIdentifier} target="_blank" rel="noreferrer" className="text-stone-900 underline underline-offset-4">
                        열기
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
