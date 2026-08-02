import type { ReactNode } from "react";

/** 필수 한계는 본문에 두고, 용어를 풀어 쓰는 보조 설명에만 사용한다. */
export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="info-tip relative inline-block align-middle">
      <summary
        aria-label={`${label} 설명`}
        className="inline-flex min-h-11 min-w-11 list-none items-center justify-center rounded-full border border-stone-300 bg-white text-xs font-bold text-stone-700 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800"
      >
        <span aria-hidden="true">?</span>
      </summary>
      <div
        role="note"
        className="fixed inset-x-4 bottom-4 z-50 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-stone-300 bg-white p-4 text-left text-xs font-normal leading-5 text-stone-700 shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-12 sm:w-72"
      >
        {children}
      </div>
    </details>
  );
}
