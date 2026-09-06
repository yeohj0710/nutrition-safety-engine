import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="app-page flex-1 px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="page-shell-narrow text-center">
        <p className="eyebrow justify-center">페이지 없음</p>
        <h1 className="mt-4 text-[clamp(1.5rem,3.4vw,2.5rem)] font-bold leading-tight tracking-[-0.02em] text-foreground">
          요청하신 페이지를 찾을 수 없습니다.
        </h1>
        <p className="mx-auto mt-4 max-w-[40rem] text-[1.0625rem] leading-7 text-[#464c53]">
          주소가 잘못 입력되었거나, 페이지가 옮겨졌거나 삭제되어 요청하신 페이지를 찾을 수 없습니다.
          메인 화면에서 근거 기록을 다시 조회할 수 있습니다.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/#guide" className="btn-tertiary">
            이용 안내
          </Link>
          <Link href="/" className="btn-primary">
            메인 화면으로
          </Link>
        </div>
      </div>
    </main>
  );
}
