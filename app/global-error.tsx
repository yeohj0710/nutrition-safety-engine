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
          className="app-page min-h-screen px-4 py-16 sm:px-6 sm:py-24"
        >
          <section
            role="alert"
            aria-labelledby="global-error-title"
            className="page-shell-narrow text-center"
          >
            <p className="eyebrow justify-center">화면 불러오기 오류</p>
            <h1
              id="global-error-title"
              ref={headingRef}
              tabIndex={-1}
              className="mt-4 text-[clamp(1.5rem,3.4vw,2.5rem)] font-bold leading-tight tracking-[-0.02em] text-foreground focus:outline-none"
            >
              화면을 열지 못했습니다.
            </h1>
            <p className="mx-auto mt-4 max-w-[40rem] text-[1.0625rem] leading-7 text-[#464c53]">
              잠시 후 다시 시도해 주세요. 같은 문제가 계속되면 페이지를 새로고침해 주세요.
            </p>
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="btn-primary mt-8"
            >
              다시 불러오기
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
