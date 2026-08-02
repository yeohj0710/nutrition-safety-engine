import Image from "next/image";
import Link from "next/link";

import { projectAffiliation, projectAuthor } from "@/src/lib/project-identity";

export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition-transform focus-visible:translate-y-0"
      >
        본문 바로가기
      </a>
      <header className="border-b border-border-subtle bg-white/95 px-4 backdrop-blur sm:px-6">
        <div className="page-shell flex min-h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <Image
              src="/yonsei-logo.svg"
              alt="연세대학교"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              priority
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-foreground">
                영양성분 안전성 근거 연구
              </span>
              <span className="block truncate text-xs text-muted">
                {projectAffiliation}
              </span>
            </span>
          </Link>
          <span className="hidden shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:inline-flex">
            졸업논문 연구
          </span>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border-subtle bg-white px-4 py-8 sm:px-6">
        <div className="page-shell flex flex-col gap-2 text-xs leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>졸업논문 연구용 · 의료적 진단이나 처방을 대신하지 않습니다.</p>
          <p>
            {projectAffiliation} · {projectAuthor}
          </p>
        </div>
      </footer>
    </div>
  );
}
