export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="app-page min-h-screen px-4 pt-4 pb-24 sm:px-6 sm:pb-36 lg:px-6 lg:pb-52"
    >
      <div className="page-shell flex animate-pulse flex-col gap-4">
        <div className="surface-card rounded-[1.15rem] px-4 py-4">
          <div className="h-5 w-3/4 rounded-full bg-stone-200/80" />
          <div className="mt-2 h-4 w-full rounded-full bg-stone-200/60" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="surface-card rounded-[0.95rem] px-3.5 py-3"
            >
              <div className="h-3 w-2/3 rounded-full bg-stone-200/70" />
              <div className="mt-2 h-6 w-14 rounded-md bg-stone-200/80" />
              <div className="mt-2 h-3 w-full rounded-full bg-stone-200/60" />
            </div>
          ))}
        </div>
        <div className="surface-card h-[540px] rounded-[1.15rem]" />
      </div>
    </main>
  );
}
