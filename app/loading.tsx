export default function Loading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      className="app-page min-h-[60vh] px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-12"
    >
      <p role="status" className="sr-only">
        연구 자료를 불러오는 중입니다.
      </p>
      <div aria-hidden="true" className="page-shell flex flex-col gap-12 sm:gap-16">
        <section className="pt-2 sm:pt-4">
          <div className="loading-skeleton h-4 w-36 rounded" />
          <div className="loading-skeleton mt-5 h-11 w-full max-w-xl rounded-xl" />
          <div className="loading-skeleton mt-3 h-11 w-3/4 max-w-md rounded-xl" />
          <div className="loading-skeleton mt-6 h-5 w-full max-w-2xl rounded" />
          <div className="loading-skeleton mt-2 h-5 w-4/5 max-w-xl rounded" />
        </section>

        <section className="surface-card rounded-3xl px-4 py-6 sm:px-7 sm:py-8">
          <div className="loading-skeleton h-7 w-48 rounded-lg" />
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="loading-skeleton h-20 rounded-2xl" />
            ))}
          </div>
          <div className="loading-skeleton mt-8 h-12 w-full rounded-xl sm:w-44" />
        </section>
      </div>
    </main>
  );
}
