import Image from "next/image";
import Link from "next/link";

import {
  projectAffiliation,
  projectAuthor,
  projectSignature,
} from "@/src/lib/project-identity";

export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="px-5 py-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 text-sm">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/yonsei-logo.svg"
              alt="연세대학교 로고"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 object-contain"
              priority
            />
            <span className="truncate text-stone-900">{projectSignature}</span>
          </Link>
          <span className="hidden text-stone-500 md:block">
            {projectAffiliation} / {projectAuthor}
          </span>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="px-5 py-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl justify-between gap-4 border-t border-stone-200 pt-5 text-xs text-stone-500">
          <span>{projectSignature}</span>
          <span className="hidden md:inline">{projectAuthor}</span>
        </div>
      </footer>
    </div>
  );
}
