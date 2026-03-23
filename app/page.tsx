import Link from "next/link";

import { RuleExplorerClient } from "@/src/components/rule-explorer-client";
import { getExplorerMetadata } from "@/src/lib/knowledge";

export default function Home() {
  const metadata = getExplorerMetadata();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(213,230,214,0.7),_transparent_35%),linear-gradient(180deg,_#f7f4ee_0%,_#f2efe7_100%)] px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto mb-6 flex max-w-6xl items-center justify-between rounded-full border border-stone-200 bg-white/70 px-5 py-3 backdrop-blur">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Nutrition Safety Engine</p>
          <p className="text-sm text-stone-700">결정적 규칙과 로컬 근거를 탐색하는 데모</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link
            href="/sources"
            className="rounded-full border border-stone-200 px-4 py-2 text-stone-700 transition hover:border-stone-400"
          >
            출처 브라우저
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl">
        <RuleExplorerClient metadata={metadata} />
      </div>
    </main>
  );
}
