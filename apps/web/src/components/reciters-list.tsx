'use client';
import { useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';

import { RECITERS } from '@/constants';
import { selectedReciterAtom } from '@/jotai/atom';
import { Reciter } from '@/types';

type Props = {
  setIsOpen: (isOpen: boolean) => void;
};

export default function RecitersList({ setIsOpen }: Props) {
  const navigate = useRouter();
  const [searchTerm, setSearchTerm] = useState<string>('');

  const setSelectedReciter = useSetAtom(selectedReciterAtom);

  const filteredReciters = useMemo(() => {
    return RECITERS.filter((reciter) =>
      reciter.name.includes(searchTerm)
    ).sort((a, b) => a.id - b.id);
  }, [searchTerm]);

  const selectedReciterClickHandler = (reciter: Reciter) => {
    setIsOpen(false);
    setSearchTerm('');
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

        <span className="text-xs text-ink-secondary">{filteredReciters.length} قارئ</span>

        {filteredReciters.map((reciter) => (
          <button
            key={reciter.id}
            className="w-full cursor-pointer rounded-lg border border-hairline bg-canvas p-3 shadow-premium transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.98]"
            onClick={() => selectedReciterClickHandler(reciter)}
          >
            <div className="flex flex-row-reverse items-center justify-between">
              <h2 className="text-right text-lg font-semibold text-ink">{reciter.name}</h2>
              <span className="text-xs text-ink-secondary">#{reciter.id}</span>
            </div>
            <p className="mb-1 text-right text-sm text-ink-secondary">{`برواية ${reciter.riwaya}`}</p>
          </button>
        ))}
      </div>
    </section>
  );
}