"use client";
import { useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";

import { RECITERS } from "@/constants";
import { selectedReciterAtom } from "@/jotai/atom";
import { MagnetlinkSource, Reciter } from "@/types";
import { cn } from "@/utils/cn";

type Props = {
  setIsOpen: (isOpen: boolean) => void;
};

// Builds once from the current list: every source that has at least one reciter.
const AVAILABLE_SOURCES: MagnetlinkSource[] = Array.from(
  new Set(RECITERS.map((reciter) => reciter.source)),
);

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

  const setSelectedReciter = useSetAtom(selectedReciterAtom);

  const filteredReciters = useMemo(() => {
    return RECITERS.filter((reciter) => reciter.name.includes(searchTerm))
      .filter(
        (reciter) => sourceFilter === "all" || reciter.source === sourceFilter,
      )
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [searchTerm, sourceFilter]);

  const selectedReciterClickHandler = (reciter: Reciter) => {
    setIsOpen(false);
    setSearchTerm("");
    setSourceFilter("all");
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
          {AVAILABLE_SOURCES.map((source) => (
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
