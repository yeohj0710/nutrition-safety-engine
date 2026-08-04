import type { ReactNode } from "react";

/** 필수 한계는 본문에 두고, 용어를 풀어 쓰는 보조 설명에만 사용한다. */
export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="info-tip relative inline-block align-middle">
      {/* 터치 영역은 44px 로 두되 info-hit 의 음수 여백으로 배치 크기만 20px 로
          되돌린다. 이 조정이 없으면 이 버튼이 들어간 줄만 44px 로 부풀어
          옆 타일과 숫자 높이가 어긋난다. */}
      <summary
        aria-label={`${label} 설명`}
        className="info-hit flex min-h-11 min-w-11 list-none items-center justify-center"
      >
        <span aria-hidden="true" className="info-tip-mark">
          ?
        </span>
      </summary>
      <div
        role="note"
        className="fixed inset-x-4 bottom-4 z-50 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-border-subtle bg-surface p-4 text-left text-xs font-normal leading-5 text-muted shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-7 sm:w-72"
      >
        {children}
      </div>
    </details>
  );
}
