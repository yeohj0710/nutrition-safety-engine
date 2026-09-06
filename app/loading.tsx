export default function Loading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      className="app-page flex-1"
    >
      <p role="status" className="sr-only">
        연구 자료를 불러오는 중입니다.
      </p>
      {/* 실제 화면과 같은 배치를 따라간다. 뼈대가 다르면 자료가 도착하는
          순간 요소 위치가 튄다. */}
      <div aria-hidden="true">
        <div className="hero">
          <div className="hero-inner px-4 sm:px-6">
            <div className="loading-skeleton mx-auto h-8 w-2/3 rounded" />
            <div className="loading-skeleton mx-auto mt-4 h-4 w-4/5 rounded" />
            <div className="loading-skeleton mt-6 h-32 w-full rounded-[0.75rem]" />
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="loading-skeleton h-11 w-full rounded" />
              ))}
            </div>
          </div>
        </div>
        <div className="page-shell page-stack px-4 py-8 sm:px-6">
          <section className="card">
            <div className="loading-skeleton h-5 w-40 rounded" />
            <div className="loading-skeleton mt-3 h-4 w-full rounded" />
          </section>
        </div>
        <div className="stat-band">
          <div className="site-shell">
            <div className="loading-skeleton h-7 w-32 rounded" />
            <div className="stat-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="stat-item">
                  <div className="loading-skeleton mx-auto h-4 w-20 rounded" />
                  <div className="loading-skeleton mx-auto mt-3 h-8 w-24 rounded" />
                  <div className="loading-skeleton mt-3 h-3 w-full rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
