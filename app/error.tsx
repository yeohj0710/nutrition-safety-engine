"use client";

import { useEffect, useRef } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error("[app-error]", {
      message: error.message,
      digest: error.digest ?? null,
    });
    headingRef.current?.focus();
  }, [error]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="app-page min-h-[60vh] px-4 py-12 sm:px-6 sm:py-16"
    >
      <div className="page-shell-narrow">
        <section
          role="alert"
          aria-labelledby="route-error-title"
          className="surface-card-strong rounded-3xl px-6 py-8 sm:px-9 sm:py-10"
        >
          <p className="eyebrow">문헌 불러오기 오류</p>
          <h1
            id="route-error-title"
            ref={headingRef}
            tabIndex={-1}
            className="mt-3 text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl"
          >
            연구 자료 불러오기 실패
          </h1>
          <p className="measure-copy mt-4 text-sm leading-6 text-muted">
            잠시 후 다시 시도하세요. 문제가 계속되면 페이지를 새로고침해 주세요.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            다시 불러오기
          </button>
        </section>
      </div>
    </main>
  );
}
