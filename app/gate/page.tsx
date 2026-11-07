import type { Metadata } from "next";

import { safeNextPath } from "@/src/lib/site-gate";

export const metadata: Metadata = {
  title: "비밀번호 입력",
  robots: { index: false, follow: false },
};

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);
  return (
    <main id="main-content" className="site-shell flex flex-1 items-start justify-center py-16">
      <form
        action="/api/gate"
        method="post"
        className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--shadow-panel)]"
      >
        <h1 className="text-lg font-bold text-[var(--foreground)]">연구 누리집 열람</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          지도교수 검토가 끝날 때까지 열람을 제한합니다. 연구자에게 받은 비밀번호를 입력해 주세요.
        </p>
        <input type="hidden" name="next" value={nextPath} />
        <label htmlFor="gate-password" className="mt-5 block text-sm font-bold text-[var(--foreground)]">
          비밀번호
        </label>
        <input
          id="gate-password"
          name="password"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          required
          className="mt-2 w-full rounded-[var(--radius-card)] border border-[var(--border-input)] bg-white px-3 py-2.5 text-base text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
        />
        {error ? (
          <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
            비밀번호가 맞지 않습니다.
          </p>
        ) : null}
        <button
          type="submit"
          className="mt-5 w-full rounded-[var(--radius-card)] bg-[var(--accent)] px-4 py-2.5 text-base font-bold text-white transition-colors hover:bg-[var(--accent-strong)] active:scale-[0.99]"
        >
          들어가기
        </button>
      </form>
    </main>
  );
}
