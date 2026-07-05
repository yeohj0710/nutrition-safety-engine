import Image from "next/image";
import Link from "next/link";

import {
  projectAffiliation,
  projectAuthor,
  projectSignature,
} from "@/src/lib/project-identity";

export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="site-masthead rounded-[0.75rem] border-l-4 border-emerald-700 px-4 py-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <Link
                href="/"
                className="grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 text-sm font-medium text-foreground transition duration-200 hover:text-emerald-900"
              >
                <span className="site-brand-mark rounded-[0.65rem]">
                  <Image
                    src="/yonsei-logo.svg"
                    alt="연세대학교 로고"
                    width={42}
                    height={42}
                    className="h-10 w-10 object-contain"
                    priority
                  />
                </span>
                <span className="min-w-0">
                  <span className="site-topbar-label">상담 기준 자료</span>
                  <span className="block truncate">{projectAffiliation}</span>
                  <span className="mt-0.5 block text-sm font-normal leading-5 text-muted">
                    {projectSignature}
                  </span>
                </span>
              </Link>

              <div className="grid gap-1 rounded-[0.55rem] border border-emerald-900/15 bg-emerald-50/70 px-3 py-2 text-sm lg:min-w-[18rem]">
                <span className="site-topbar-label">작성자</span>
                <span className="font-semibold leading-5 text-emerald-950">
                  {projectAuthor}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="px-4 pb-5 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="site-footer-panel rounded-[0.55rem] border-l-4 border-emerald-700 px-4 py-2.5 text-xs text-muted">
            <div className="grid gap-1 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <p className="truncate">{projectSignature}</p>
              <p className="truncate md:text-right">
                {projectAffiliation} / {projectAuthor}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
