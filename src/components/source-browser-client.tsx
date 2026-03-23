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

      return [source.title, source.id, source.sourceType, source.journalOrPublisher ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [deferredSearch, evidenceLevel, jurisdiction, sources]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_220px]">
          <label className="space-y-1 text-sm text-stone-700">
            <span>출처 검색</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="제목, ID, 발행처 검색"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:border-stone-400"
            />
          </label>
          <label className="space-y-1 text-sm text-stone-700">
            <span>관할권</span>
            <select
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:border-stone-400"
            >
              <option value="">전체</option>
              {jurisdictions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-stone-700">
            <span>근거 수준</span>
            <select
              value={evidenceLevel}
              onChange={(event) => setEvidenceLevel(event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:border-stone-400"
            >
              <option value="">전체</option>
              {evidenceLevels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {filteredSources.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-stone-300 bg-white/70 p-8 text-center text-sm text-stone-600">
          검색 조건에 맞는 출처가 없습니다.
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSources.map((source) => (
            <article key={source.id} className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {source.year ? (
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">{source.year}</span>
                    ) : null}
                    {source.jurisdiction ? (
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">
                        {source.jurisdiction}
                      </span>
                    ) : null}
                    {source.evidenceLevel ? (
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">
                        {source.evidenceLevel}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">{source.sourceType}</span>
                  </div>
                  <h2 className="text-xl font-semibold text-stone-950">{source.title}</h2>
                  <p className="text-sm text-stone-600">{source.id}</p>
                  <p className="text-sm text-stone-700">{source.journalOrPublisher ?? "발행 정보 없음"}</p>
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <div className="text-sm text-stone-600">
                    규칙 {source.linkedRuleCount}건 · 근거 청크 {source.linkedChunkCount}건
                  </div>
                  <Link
                    href={`/sources/${source.id}`}
                    className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
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
