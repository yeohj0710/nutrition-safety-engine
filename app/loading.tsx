export default function Loading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      className="app-page flex-1 px-4 py-4 sm:px-6 sm:py-6"
    >
      <p role="status" className="sr-only">
        연구 자료를 불러오는 중입니다.
      </p>
      {/* 실제 화면과 같은 카드 배치를 그대로 따라간다. 뼈대가 다르면
          자료가 도착하는 순간 카드 위치가 튄다. */}
      <div aria-hidden="true" className="page-shell page-stack">
        <section className="card">
          <div className="loading-skeleton h-6 w-3/5 max-w-md rounded" />
          <div className="loading-skeleton mt-3 h-4 w-full rounded" />
          <div className="loading-skeleton mt-2 h-4 w-4/5 rounded" />
        </section>

        <section className="grid gap-[var(--stack-gap)] sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card">
              <div className="loading-skeleton h-3 w-20 rounded" />
              <div className="loading-skeleton mt-2 h-6 w-16 rounded" />
              <div className="loading-skeleton mt-2 h-3 w-full rounded" />
            </div>
          ))}
        </section>

        <section className="card">
          <div className="loading-skeleton h-5 w-64 max-w-full rounded" />
          <div className="loading-skeleton mt-4 h-20 w-full rounded-[var(--radius-control)]" />
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, column) => (
              <div key={column} className="grid gap-2">
                <div className="loading-skeleton h-4 w-40 rounded" />
                {Array.from({ length: 5 }).map((_, row) => (
                  <div
                    key={row}
                    className="loading-skeleton h-16 rounded-[var(--radius-control)]"
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
