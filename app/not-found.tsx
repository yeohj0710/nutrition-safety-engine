import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f7f4ee_0%,_#f2efe7_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Not Found</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-950">요청한 규칙 또는 출처를 찾을 수 없습니다.</h1>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          링크가 변경되었거나 데이터 인덱스에 포함되지 않은 항목일 수 있습니다.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/" className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white">
            탐색기로 이동
          </Link>
          <Link
            href="/sources"
            className="rounded-full border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700"
          >
            출처 브라우저
          </Link>
        </div>
      </div>
    </main>
  );
}
