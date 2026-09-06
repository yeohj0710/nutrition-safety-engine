import Image from "next/image";
import Link from "next/link";

import { projectAffiliation, projectAuthor } from "@/src/lib/project-identity";

const navItems = [
  { href: "/#explorer", label: "근거 조회" },
  { href: "/#scope", label: "자료 규모" },
  { href: "/#guide", label: "이용 안내" },
  { href: "/#research", label: "연구 정보" },
];

export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-[var(--radius-card)] focus:bg-navy focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-white"
      >
        본문 바로가기
      </a>

      {/* 머리띠. 공공 누리집이 맨 위에 두는 한 줄을 같은 자리에 둔다.
          운영 주체를 그대로 적는다. */}
      <div className="masthead">
        <div className="site-shell masthead-inner">
          <Image
            src="/yonsei-logo.svg"
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
            className="masthead-mark"
          />
          <span>이 누리집은 {projectAffiliation}에서 운영하는 졸업논문 연구 누리집입니다.</span>
        </div>
      </div>

      <header className="site-header">
        <div className="site-shell site-header-top">
          <Link href="/" className="site-wordmark" aria-label="영양성분 안전성 근거 연구 홈">
            <Image
              src="/yonsei-logo.svg"
              alt=""
              aria-hidden="true"
              width={36}
              height={36}
              className="site-wordmark-logo"
              priority
            />
            <span className="min-w-0">
              <span className="site-wordmark-title">영양성분 안전성 근거</span>
              <span className="site-wordmark-sub">{projectAffiliation}</span>
            </span>
          </Link>
          <nav className="site-utility" aria-label="보조 메뉴">
            <Link href="/#research">연구 정보</Link>
            <a
              href="https://pubmed.ncbi.nlm.nih.gov/"
              target="_blank"
              rel="noreferrer"
            >
              PubMed
              <span className="sr-only"> 새 창</span>
            </a>
          </nav>
        </div>
        <div className="site-nav-row">
          <nav className="site-shell site-nav" aria-label="주요 메뉴">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="flex flex-1 flex-col">{children}</div>

      <footer className="site-footer">
        <div className="site-shell">
          <div className="site-footer-top">
            <div>
              <p className="site-footer-brand">
                <Image src="/yonsei-logo.svg" alt="" aria-hidden="true" width={32} height={32} />
                영양성분 안전성 근거 연구
              </p>
              <div className="site-footer-meta">
                <p>{projectAffiliation}</p>
                <p>
                  <b>연구 수행</b> {projectAuthor}
                </p>
                <p>
                  <b>자료 출처</b> PubMed(미국 국립의학도서관) 문헌 데이터베이스
                </p>
              </div>
            </div>
            <nav className="site-footer-links" aria-label="바닥글 메뉴">
              <Link href="/#guide">이용 안내 &rsaquo;</Link>
              <Link href="/#research">연구 정보 &rsaquo;</Link>
              <Link href="/#scope">자료 규모 &rsaquo;</Link>
            </nav>
          </div>
          <div className="site-footer-bottom">
            <p>졸업논문 연구용 누리집입니다. 의료적 진단이나 처방을 대신하지 않습니다.</p>
            <p>© Yonsei University College of Pharmacy, Clinical Pharmacy Lab.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
