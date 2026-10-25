'use client';
import { useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';

import { RECITERS } from '@/constants';
import { selectedReciterAtom } from '@/jotai/atom';
import { Reciter, ReciterTag, Riwaya } from '@/types';

type Props = {
  setIsOpen: (isOpen: boolean) => void;
};

const ALL_TAGS: ReciterTag[] = [
  'p2p',
  'web-seed',
  'http-fallback',
  'p2p-only',
  'archive.org',
  'mp3quran.net',
  'islamhouse.com',
];

const TAG_LABEL: Record<ReciterTag, string> = {
  p2p: 'P2P',
  mp3: 'MP3',
  'web-seed': 'ويب سيد',
  'http-fallback': 'HTTP',
  'p2p-only': 'P2P فقط',
  'archive.org': 'archive.org',
  'mp3quran.net': 'mp3quran',
  'islamhouse.com': 'islamhouse',
};

export default function RecitersList({ setIsOpen }: Props) {
  const navigate = useRouter();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRiwaya, setSelectedRiwaya] = useState<Riwaya | 'all'>('all');
  const [selectedTags, setSelectedTags] = useState<Set<ReciterTag>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');

  const setSelectedReciter = useSetAtom(selectedReciterAtom);

  const toggleTag = (tag: ReciterTag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const filteredReciters = useMemo(() => {
    let list = RECITERS.filter((reciter) => {
      if (!reciter.name.includes(searchTerm)) return false;
      if (selectedRiwaya !== 'all' && reciter.riwaya !== selectedRiwaya) return false;
      if (selectedTags.size > 0) {
        const tags = reciter.tags || [];
        for (const t of selectedTags) {
          if (!tags.includes(t)) return false;
        }
      }
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
  }, [searchTerm, selectedRiwaya, selectedTags, sortBy]);

  const selectedReciterClickHandler = (reciter: Reciter) => {
    setIsOpen(false);
    setSearchTerm('');
    navigate.push(`/reciter/${reciter.id}`);
  };

  return (
    <section className="w-full">
      <div className="mx-auto flex flex-col gap-2 p-2">
        <input
          type="search"
          placeholder="ابحث عن القارئ"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="mb-2 w-full rounded-lg border border-gray-200 bg-background p-2 text-right shadow-md dark:border-gray-400"
        />

        {/* Riwaya chips */}
        <div className="mb-2 flex flex-row-reverse flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setSelectedRiwaya('all')}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              selectedRiwaya === 'all'
                ? 'bg-brand-CTA-blue-500 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            جميع الروايات
          </button>
          {Object.values(Riwaya).map((riwaya) => (
            <button
              key={riwaya}
              onClick={() => setSelectedRiwaya(riwaya)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                selectedRiwaya === riwaya
                  ? 'bg-brand-CTA-blue-500 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {riwaya}
            </button>
          ))}
        </div>

        {/* Tag chips */}
        <div className="mb-2 flex flex-row-reverse flex-wrap items-center justify-center gap-1">
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                selectedTags.has(tag)
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {TAG_LABEL[tag]}
            </button>
          ))}
          {selectedTags.size > 0 && (
            <button
              onClick={() => setSelectedTags(new Set())}
              className="rounded-full px-2 py-0.5 text-xs text-red-500 hover:bg-red-50"
            >
              مسح
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="mb-2 flex flex-row-reverse items-center justify-end gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'id')}
            className="rounded border border-gray-200 bg-background p-1 text-sm"
          >
            <option value="name">ترتيب: الاسم</option>
            <option value="id">ترتيب: الرقم</option>
          </select>
          <span className="text-xs text-gray-500">{filteredReciters.length} قارئ</span>
        </div>

        {filteredReciters.map((reciter) => (
          <button
            key={reciter.id}
            className="w-full cursor-pointer rounded-lg border border-gray-200 p-2 shadow-md transition-transform hover:scale-[1.02] dark:border-gray-400"
            onClick={() => selectedReciterClickHandler(reciter)}
          >
            <div className="flex flex-row-reverse items-center justify-between">
              <h2 className="font-semibold text-right text-lg">{reciter.name}</h2>
              <span className="text-xs text-gray-400">#{reciter.id}</span>
            </div>
            <p className="mb-1 text-right text-sm">{`برواية ${reciter.riwaya}`}</p>
            <div className="flex flex-row-reverse flex-wrap gap-1">
              {(reciter.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                >
                  {TAG_LABEL[tag]}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
