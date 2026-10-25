'use client';
import { useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';

import { RECITERS } from '@/constants';
import { selectedReciterAtom } from '@/jotai/atom';
import { Reciter, Riwaya } from '@/types';

type Props = {
  setIsOpen: (isOpen: boolean) => void;
};

export default function RecitersList({ setIsOpen }: Props) {
  const navigate = useRouter();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRiwaya, setSelectedRiwaya] = useState<Riwaya | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');

  const setSelectedReciter = useSetAtom(selectedReciterAtom);

  const filteredReciters = useMemo(() => {
    let list = RECITERS.filter((reciter) => {
      if (!reciter.name.includes(searchTerm)) return false;
      if (selectedRiwaya !== 'all' && reciter.riwaya !== selectedRiwaya) return false;
      return true;
    });
    if (sortBy === 'name') {
      list = [...list].sort((a, b) =>
        a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' })
      );
    } else {
      list = [...list].sort((a, b) => a.id - b.id);
    }
    return list;
  }, [searchTerm, selectedRiwaya, sortBy]);

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

        {/* Riwaya chips */}
        <div className="flex flex-row-reverse flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setSelectedRiwaya('all')}
            className={`rounded-full px-3 py-1 text-sm transition-colors duration-150 ${
              selectedRiwaya === 'all'
                ? 'bg-primary text-white'
                : 'bg-canvas-parchment text-ink-secondary hover:bg-hairline'
            }`}
          >
            جميع الروايات
          </button>
          {Object.values(Riwaya).map((riwaya) => (
            <button
              key={riwaya}
              onClick={() => setSelectedRiwaya(riwaya)}
              className={`rounded-full px-3 py-1 text-sm transition-colors duration-150 ${
                selectedRiwaya === riwaya
                  ? 'bg-primary text-white'
                  : 'bg-canvas-parchment text-ink-secondary hover:bg-hairline'
              }`}
            >
              {riwaya}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex flex-row-reverse items-center justify-end gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'id')}
            className="rounded border border-hairline bg-canvas p-1 text-sm text-ink"
          >
            <option value="name">ترتيب: الاسم</option>
            <option value="id">ترتيب: الرقم</option>
          </select>
          <span className="text-xs text-ink-secondary">{filteredReciters.length} قارئ</span>
        </div>

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