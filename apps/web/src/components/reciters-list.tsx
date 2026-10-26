"use client";
import { useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";

import { useReciters } from "@/hooks/use-reciters";
import { selectedReciterAtom } from "@/jotai/atom";
import { MagnetlinkSource, Reciter } from "@/types";
import { cn } from "@/utils/cn";

type Props = {
  setIsOpen: (isOpen: boolean) => void;
};


/** True when a reciter can play over plain HTTP without peers: an itqan playlist, or web seeds in the magnet. */
const hasHttpFallback = (reciter: Reciter): boolean =>
  (!reciter.magnet && (reciter.itqanPlaylist?.length ?? 0) > 0) ||
  /&ws=/.test(reciter.magnet);

export default function RecitersList({ setIsOpen }: Props) {
  const navigate = useRouter();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<MagnetlinkSource | "all">(
    "all",
  );
  const [httpFilter, setHttpFilter] = useState<boolean>(false);

  const setSelectedReciter = useSetAtom(selectedReciterAtom);
  const { reciters } = useReciters();

  // The source filter only offers badges the current list actually has.
  const availableSources = useMemo(
    () => Array.from(new Set(reciters.map((reciter) => reciter.source))),
    [reciters],
  );

  const filteredReciters = useMemo(() => {
    return reciters.filter((reciter) => reciter.name.includes(searchTerm))
      .filter(
        (reciter) => sourceFilter === "all" || reciter.source === sourceFilter,
      )
      .filter((reciter) => !httpFilter || hasHttpFallback(reciter))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [reciters, searchTerm, sourceFilter, httpFilter]);

  const selectedReciterClickHandler = (reciter: Reciter) => {
    setIsOpen(false);
    setSearchTerm("");
    setSourceFilter("all");
    setHttpFilter(false);
    navigate.push(`/reciter/${reciter.id}`);
  };

  return (
    <section className="w-full">
      <div className="mx-auto flex flex-col gap-3 p-2">
        <input
          type="search"
          placeholder="ابحث عن القارئ"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-lg border border-hairline bg-canvas p-2 text-right text-ink shadow-premium"
        />

        <div className="flex flex-wrap justify-start gap-2" role="filter">
          <button
            onClick={() => setSourceFilter("all")}
            className={cn(
              "cursor-pointer rounded-md border border-hairline px-3 py-1 text-xs transition-colors",
              sourceFilter === "all"
                ? "bg-ink text-canvas"
                : "bg-canvas text-ink-secondary hover:text-ink",
            )}
          >
            الكل
          </button>
          {availableSources.map((source) => (
            <button
              key={source}
              onClick={() => setSourceFilter(source)}
              className={cn(
                "cursor-pointer rounded-md border border-hairline px-3 py-1 text-xs transition-colors",
                sourceFilter === source
                  ? "bg-ink text-canvas"
                  : "bg-canvas text-ink-secondary hover:text-ink",
              )}
            >
              {source}
            </button>
          ))}
        </div>

        {/* HTTP filter: reciters with an HTTP fallback (playlist link or web seeds) */}
        <div className="flex flex-wrap justify-start gap-2">
          <button
            onClick={() => setHttpFilter((v) => !v)}
            aria-pressed={httpFilter}
            className={cn(
              "cursor-pointer rounded-md border border-hairline px-3 py-1 text-xs transition-colors",
              httpFilter
                ? "bg-ink text-canvas"
                : "bg-canvas text-ink-secondary hover:text-ink",
            )}
          >
            HTTP
          </button>
        </div>

        <span className="text-xs text-ink-secondary">
          {filteredReciters.length} قارئ
        </span>

        {filteredReciters.map((reciter) => (
          <button
            key={reciter.id}
            className="w-full cursor-pointer rounded-lg border border-hairline bg-canvas p-3 shadow-premium transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.98]"
            onClick={() => selectedReciterClickHandler(reciter)}
          >
            <div className="flex flex-row-reverse flex-wrap items-center justify-between gap-2">
              <h2 className="text-right text-lg font-semibold text-ink">
                {reciter.name}
              </h2>
              <div className="flex flex-wrap items-center justify-start gap-1">
                <span
                  className="rounded border border-hairline bg-canvas px-1.5 py-0.5 text-[10px] text-ink-secondary"
                  title="مصدر الملفات"
                >
                  {reciter.source}
                </span>
                {hasHttpFallback(reciter) && (
                  <span
                    className="rounded border border-hairline bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-ink"
                    title="يعمل من روابط HTTP عندما لا يوجد أقران (P2P)"
                  >
                    HTTP
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
