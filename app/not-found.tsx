import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="app-page min-h-[60vh] px-4 py-12 sm:px-6 sm:py-16"
    >
      <div className="page-shell-narrow">
        <section className="surface-card-strong rounded-3xl px-6 py-8 sm:px-9 sm:py-10">
          <p className="eyebrow">페이지 없음</p>
          <h1 className="mt-3 text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">
            요청한 페이지를 찾을 수 없습니다
          </h1>
          <p className="measure-copy mt-4 text-sm leading-6 text-muted">
            주소가 바뀌었거나 현재 사이트에 없는 페이지입니다. 메인 화면에서
            근거 기록을 다시 찾아보세요.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            메인 화면으로 이동
          </Link>
        </section>
      </div>
    </main>
  );
}
