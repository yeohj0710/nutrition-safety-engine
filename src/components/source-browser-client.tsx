"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

type SourceBrowseItem = {
  id: string;
  title: string;
  sourceType: string;
  year: number | null;
  jurisdiction: string | null;
  evidenceLevel: string | null;
  journalOrPublisher: string | null;
  linkedRuleCount: number;
  linkedChunkCount: number;
};

const controlClassName =
  "min-h-12 w-full rounded-[1.2rem] border border-border-subtle bg-white/80 px-4 py-3 text-sm text-foreground outline-none transition duration-200 placeholder:text-muted hover:border-stone-300 hover:bg-white focus:border-accent focus:bg-white";

function formatLabel(value: string | null) {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

export function SourceBrowserClient({
  sources,
  jurisdictions,
  evidenceLevels,
}: {
  sources: SourceBrowseItem[];
  jurisdictions: string[];
  evidenceLevels: string[];
}) {
  const [search, setSearch] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [evidenceLevel, setEvidenceLevel] = useState("");
  const deferredSearch = useDeferredValue(search);

  const filteredSources = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();

    return sources.filter((source) => {
      if (jurisdiction && source.jurisdiction !== jurisdiction) {
        return false;
      }

      if (evidenceLevel && source.evidenceLevel !== evidenceLevel) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [
        source.title,
        source.id,
        source.sourceType,
        source.journalOrPublisher ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [deferredSearch, evidenceLevel, jurisdiction, sources]);

  const hasFilters = Boolean(search || jurisdiction || evidenceLevel);

  return (
    <div className="space-y-5">
      <section className="surface-card rounded-[2rem] px-5 py-5 md:px-6 md:py-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Browse and verify</p>
              <h2 className="mt-4 font-display text-[clamp(1.9rem,3vw,2.9rem)] leading-[0.98] tracking-[-0.04em] text-foreground">
                필요한 출처만 빠르게 좁혀 보세요
              </h2>
              <p className="measure-copy mt-3 text-sm leading-7 text-muted">
                제목, 출처 ID, 발행 기관으로 검색하고 관할권과 근거 수준별로 걸러서
                확인할 수 있습니다. 각 항목에는 연결된 규칙 수와 근거 청크 수가 함께
                표시됩니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border-subtle bg-white/82 px-4 py-2 text-sm text-foreground">
                검색 결과 {filteredSources.length}건
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setJurisdiction("");
                  setEvidenceLevel("");
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-subtle bg-white/82 px-4 py-2 text-sm font-medium text-foreground transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:bg-white disabled:opacity-50"
                disabled={!hasFilters}
              >
                필터 초기화
              </button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_13rem_14rem]">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">
                출처 검색
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="예: probiotic, FDA, SRC-US"
                className={controlClassName}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">
                관할권
              </span>
              <select
                value={jurisdiction}
                onChange={(event) => setJurisdiction(event.target.value)}
                className={controlClassName}
              >
                <option value="">전체</option>
                {jurisdictions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">
                근거 수준
              </span>
              <select
                value={evidenceLevel}
                onChange={(event) => setEvidenceLevel(event.target.value)}
                className={controlClassName}
              >
                <option value="">전체</option>
                {evidenceLevels.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item) ?? item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {filteredSources.length === 0 ? (
        <section className="surface-card rounded-[2rem] px-6 py-10 text-center">
          <p className="font-display text-3xl tracking-[-0.04em] text-foreground">
            조건에 맞는 출처가 없습니다
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted">
            검색어를 조금 더 넓게 입력하거나 관할권과 근거 수준 필터를 해제하면
            더 많은 자료를 확인할 수 있습니다.
          </p>
        </section>
      ) : (
        <div className="grid gap-4">
          {filteredSources.map((source) => (
            <article
              key={source.id}
              className="surface-card rounded-[1.8rem] px-5 py-5 transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:bg-white/92"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {source.year ? (
                      <span className="rounded-full border border-border-subtle bg-white/82 px-3 py-1 text-muted">
                        {source.year}
                      </span>
                    ) : null}
                    {source.jurisdiction ? (
                      <span className="rounded-full border border-border-subtle bg-white/82 px-3 py-1 text-muted">
                        {source.jurisdiction}
                      </span>
                    ) : null}
                    {source.evidenceLevel ? (
                      <span className="rounded-full bg-accent-soft px-3 py-1 text-accent-strong">
                        {formatLabel(source.evidenceLevel) ?? source.evidenceLevel}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-border-subtle bg-white/82 px-3 py-1 text-muted">
                      {formatLabel(source.sourceType) ?? source.sourceType}
                    </span>
                  </div>

                  <div>
                    <h3 className="max-w-4xl font-display text-[clamp(1.6rem,2.4vw,2.3rem)] leading-[1.02] tracking-[-0.04em] text-foreground">
                      {source.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted">{source.id}</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
                    <div className="rounded-[1.25rem] border border-border-subtle bg-white/75 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        발행 기관
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {source.journalOrPublisher ?? "발행 기관 정보가 아직 없습니다."}
                      </p>
                    </div>

                    <div className="rounded-[1.25rem] border border-border-subtle bg-white/75 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        연결 범위
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        규칙 {source.linkedRuleCount}건
                        <br />
                        근거 청크 {source.linkedChunkCount}건
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-start">
                  <Link
                    href={`/sources/${source.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-accent-strong"
                  >
                    출처 상세
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
