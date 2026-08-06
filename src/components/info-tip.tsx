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
      {/* 화면에 고정하고 팁 위치를 아예 안 본다.
          전에는 sm 이상에서 팁의 오른쪽 끝에 288px 말풍선을 붙였는데, 팁이
          왼쪽에서 304px 안쪽이면 말풍선이 화면 밖으로 잘렸다. 640~1090px 구간
          전체에서 팁 4개 중 2개가 잘렸다(태블릿에서 -19px, -56px 실측).
          왼쪽 정렬로 뒤집어도, 중앙 정렬로 바꿔도 못 고친다 — "조회 방식" 팁은
          오른쪽 끝에 있어 반대 방향을 요구한다. 팁마다 필요한 방향이 다르므로
          정적인 정렬로는 답이 없고, 방향을 재려면 클라이언트에서 위치를 읽어야
          한다. 화면 기준으로 두면 팁이 어디 있든 안 잘린다. */}
      <div
        role="note"
        className="fixed inset-x-4 bottom-4 z-50 mx-auto max-h-[calc(100dvh-2rem)] max-w-sm overflow-y-auto rounded-xl border border-border-subtle bg-surface p-4 text-left text-[0.8125rem] font-normal leading-5 text-muted shadow-lg"
      >
        {children}
      </div>
    </details>
  );
}
