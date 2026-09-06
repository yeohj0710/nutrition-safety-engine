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
      className="app-page flex-1 px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="page-shell-narrow text-center">
        <section role="alert" aria-labelledby="route-error-title">
          <p className="eyebrow justify-center">문헌 불러오기 오류</p>
          <h1
            id="route-error-title"
            ref={headingRef}
            tabIndex={-1}
            className="mt-4 text-[clamp(1.5rem,3.4vw,2.5rem)] font-bold leading-tight tracking-[-0.02em] text-foreground focus:outline-none"
          >
            연구 자료를 불러오지 못했습니다.
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
      </div>
    </main>
  );
}
