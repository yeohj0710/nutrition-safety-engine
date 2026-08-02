"use client";

import { useEffect, useRef } from "react";

import "./globals.css";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <html lang="ko">
      <body>
        <main
          id="main-content"
          tabIndex={-1}
          className="app-page min-h-screen px-4 py-12 sm:px-6 sm:py-16"
        >
          <section
            role="alert"
            aria-labelledby="global-error-title"
            className="surface-card-strong page-shell-narrow rounded-3xl px-6 py-8 sm:px-9 sm:py-10"
          >
            <p className="eyebrow">화면 불러오기 오류</p>
            <h1
              id="global-error-title"
              ref={headingRef}
              tabIndex={-1}
              className="mt-3 text-2xl font-bold tracking-[-0.02em] text-foreground focus:outline-none sm:text-3xl"
            >
              화면 열기 실패
            </h1>
            <p className="measure-copy mt-4 text-sm leading-6 text-muted">
              잠시 후 다시 시도하세요. 같은 문제가 계속되면 페이지를 새로고침해
              주세요.
            </p>
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
            >
              다시 불러오기
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
