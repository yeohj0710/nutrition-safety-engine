import Link from "next/link";

import { SourceBrowserClient } from "@/src/components/source-browser-client";
import { getExplorerMetadata, getSourceBrowseData } from "@/src/lib/knowledge";

export default function SourcesPage() {
  const metadata = getExplorerMetadata();
  const sources = getSourceBrowseData();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f7f4ee_0%,_#f2efe7_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Sources</p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-950">출처 브라우저</h1>
            <p className="mt-2 text-sm text-stone-700">
              로컬 버전 관리된 출처와 연결된 규칙, 근거 청크를 함께 살펴볼 수 있습니다.
            </p>
          </div>
          <Link href="/" className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700">
            탐색기로 돌아가기
          </Link>
        </div>

        <SourceBrowserClient
          sources={sources}
          jurisdictions={metadata.jurisdictions}
          evidenceLevels={metadata.sourceEvidenceLevels}
        />
      </div>
    </main>
  );
}
